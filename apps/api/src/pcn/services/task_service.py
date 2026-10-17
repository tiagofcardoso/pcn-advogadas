"""Task and Timer Service implementing State Pattern and race-condition free time tracking."""

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.clock import system_clock
from pcn.core.errors import Conflict, NotFound, PermissionDenied
from pcn.domain.enums import AuditAction, TaskAction, TaskStatus, UserRole
from pcn.domain.task_state import next_status
from pcn.models.audit_log import AuditLog
from pcn.models.task import Task
from pcn.models.task_time_session import TaskTimeSession
from pcn.models.user import User
from pcn.repositories.client_repository import ClientRepository, TaskTypeRepository
from pcn.repositories.task_repository import TaskRepository
from pcn.repositories.time_session_repository import TimeSessionRepository
from pcn.repositories.user_repository import UserRepository
from pcn.schemas.task import TaskCreate, TaskUpdate
from pcn.schemas.time_session import ActiveTimerResponse


class TaskService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.task_repo = TaskRepository(session)
        self.client_repo = ClientRepository(session)
        self.task_type_repo = TaskTypeRepository(session)
        self.session_repo = TimeSessionRepository(session)
        self.user_repo = UserRepository(session)

    async def _audit(
        self, action: AuditAction, actor_id: str, task_id: str, meta: str | None = None
    ) -> None:
        self.session.add(
            AuditLog(
                actor_id=actor_id,
                action=action,
                entity="task",
                entity_id=task_id,
                metadata_json=meta,
            )
        )

    async def create_task(self, creator: User, data: TaskCreate) -> Task:
        """Creates a new task. Can be placed in backlog, pool, or assigned directly."""
        client = None
        if data.client_id and data.client_id.strip():
            client = await self.client_repo.get_by_id_or_name(data.client_id.strip())

        if not client:
            all_clients = await self.client_repo.list_all(limit=2)
            if len(all_clients) == 1:
                client = all_clients[0]
            else:
                raise NotFound("Cliente não encontrado. Por favor, selecione um cliente válido.")

        task_type = await self.task_type_repo.get_by_id_or_name(data.task_type_id)
        if not task_type:
            all_types = await self.task_type_repo.list_all()
            if all_types:
                task_type = all_types[0]
            else:
                raise NotFound("Tipo de tarefa não encontrado.")

        initial_status = TaskStatus.BACKLOG
        assigned_to = None

        if data.assigned_to:
            assignee = await self.user_repo.get_by_id_or_alias(data.assigned_to)
            if assignee:
                assigned_to = assignee.id
                initial_status = TaskStatus.ASSIGNED
            else:
                assigned_to = data.assigned_to
                initial_status = TaskStatus.ASSIGNED
        elif data.publish_to_pool:
            initial_status = TaskStatus.POOL

        task = Task(
            client_id=client.id,
            task_type_id=task_type.id,
            title=data.title.strip(),
            description=data.description.strip() if data.description else None,
            status=initial_status,
            created_by=creator.id,
            assigned_to=assigned_to,
            due_date=data.due_date,
            is_urgent_deadline=data.is_urgent_deadline,
        )
        await self.task_repo.add(task)
        await self.session.flush()

        await self._audit(
            AuditAction.TASK_TRANSITION,
            creator.id,
            task.id,
            f"Created with status: {initial_status}",
        )
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def update_task(self, user: User, task_id: str, data: TaskUpdate) -> Task:
        task = await self.task_repo.get_by_id_with_relations(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        # Lawyers can only update tasks assigned to them (and cannot change fee_amount)
        if user.role != UserRole.ADMIN and task.assigned_to != user.id:
            raise PermissionDenied("Não tem permissão para editar esta tarefa.")

        if data.title is not None:
            task.title = data.title.strip()
        if data.description is not None:
            task.description = data.description.strip() if data.description else None
        if data.client_id is not None:
            task.client_id = data.client_id
        if data.task_type_id is not None:
            task.task_type_id = data.task_type_id
        if data.due_date is not None:
            task.due_date = data.due_date
        if data.is_urgent_deadline is not None:
            task.is_urgent_deadline = data.is_urgent_deadline
        if data.status is not None:
            task.status = data.status
            if data.status == TaskStatus.COMPLETED and not task.completed_at:
                task.completed_at = system_clock.now()

        # Fee amount can only be edited by Admin/Patrícia
        if data.fee_amount is not None and user.role == UserRole.ADMIN:
            task.fee_amount = float(data.fee_amount)

        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def publish_to_pool(self, admin_user: User, task_id: str) -> Task:
        """Admin publishes a backlog task to the shared pool."""
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        task.status = next_status(task.status, TaskAction.PUBLISH)
        task.assigned_to = None
        await self._audit(AuditAction.TASK_TRANSITION, admin_user.id, task.id, "Published to pool")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def claim_task(self, lawyer: User, task_id: str) -> Task:
        """Lawyer claims an unassigned task from the shared pool (with row lock)."""
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        if task.status != TaskStatus.POOL:
            raise Conflict("A tarefa já não está disponível no quadro partilhado.")

        task.status = next_status(task.status, TaskAction.CLAIM)
        task.assigned_to = lawyer.id
        await self._audit(
            AuditAction.TASK_TRANSITION, lawyer.id, task.id, f"Claimed by {lawyer.name}"
        )
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def assign_task(self, admin_user: User, task_id: str, lawyer_id: str | None) -> Task:
        """Admin assigns or reassigns task to a lawyer."""
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        if lawyer_id is None:
            # Move to pool or backlog
            task.status = TaskStatus.POOL
            task.assigned_to = None
        else:
            assignee = await self.user_repo.get_by_id_or_alias(lawyer_id)
            resolved_id = assignee.id if assignee else lawyer_id
            if task.status == TaskStatus.POOL or task.status == TaskStatus.BACKLOG:
                task.status = TaskStatus.ASSIGNED
            task.assigned_to = resolved_id

        await self._audit(
            AuditAction.TASK_TRANSITION, admin_user.id, task.id, f"Assigned to {task.assigned_to}"
        )
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    @staticmethod
    def _calc_seconds(now: datetime, started_at: datetime) -> int:
        from datetime import UTC

        n = now if now.tzinfo else now.replace(tzinfo=UTC)
        s = started_at if started_at.tzinfo else started_at.replace(tzinfo=UTC)
        return max(0, int((n - s).total_seconds()))

    async def _close_active_session_for_task(self, task: Task, now: datetime) -> None:
        """Closes any already running session for this specific task and accumulates duration."""
        active_session = await self.session_repo.get_active_session_for_task(task.id)
        if active_session:
            duration = self._calc_seconds(now, active_session.started_at)
            active_session.ended_at = now
            active_session.duration_seconds = duration
            active_session.active_marker = None
            task.total_duration_seconds += duration

    async def start_timer(self, user: User, task_id: str) -> Task:
        """Starts time tracking for a task without auto-pausing other tasks."""
        now = system_clock.now()
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        # Close any existing open session on this same task before starting a fresh one
        await self._close_active_session_for_task(task, now)

        # State machine transition
        if task.status != TaskStatus.IN_PROGRESS:
            task.status = next_status(task.status, TaskAction.START)

        # Open new session for this task (active_marker=None allows multiple concurrent tasks)
        session_user_id = task.assigned_to or user.id
        new_session = TaskTimeSession(
            task_id=task.id,
            user_id=session_user_id,
            started_at=now,
            active_marker=None,
        )
        await self.session_repo.add(new_session)

        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Timer started")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def pause_timer(self, user: User, task_id: str) -> Task:
        """Pauses time tracking for a task."""
        now = system_clock.now()
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        if task.status == TaskStatus.IN_PROGRESS:
            task.status = next_status(task.status, TaskAction.PAUSE)
        else:
            task.status = TaskStatus.PAUSED

        await self._close_active_session_for_task(task, now)

        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Timer paused")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def complete_task(self, user: User, task_id: str) -> Task:
        """Completes a task and consolidates final duration."""
        now = system_clock.now()
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        if task.status != TaskStatus.COMPLETED:
            task.status = next_status(task.status, TaskAction.COMPLETE)
        task.completed_at = now

        await self._close_active_session_for_task(task, now)

        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Task completed")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def archive_task(self, user: User, task_id: str) -> Task:
        """Archives a completed task so it leaves the active board."""
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        task.status = TaskStatus.ARCHIVED
        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Task archived")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def restore_task(self, user: User, task_id: str) -> Task:
        """Restores an archived task back to completed."""
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        task.status = TaskStatus.COMPLETED
        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Task restored from archive")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def delete_task(self, user: User, task_id: str) -> bool:
        """Deletes a task permanently with audit log."""
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, f"Task deleted: {task.title}")
        await self.task_repo.delete(task)
        await self.session.commit()
        return True

    async def get_active_timer(self, user_id: str) -> ActiveTimerResponse:
        """Returns the active timer and elapsed seconds computed against server clock."""
        now = system_clock.now()
        session = await self.session_repo.get_active_session_for_user(user_id)
        if not session or not session.task:
            return ActiveTimerResponse(is_active=False, server_time=now)

        elapsed = int((now - session.started_at).total_seconds())
        client_name = session.task.client.name if session.task.client else None

        return ActiveTimerResponse(
            is_active=True,
            task_id=session.task.id,
            task_title=session.task.title,
            client_name=client_name,
            started_at=session.started_at,
            server_time=now,
            elapsed_seconds=max(0, elapsed),
            total_accumulated_seconds=session.task.total_duration_seconds + max(0, elapsed),
        )
