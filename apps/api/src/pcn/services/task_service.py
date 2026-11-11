"""Task and Timer Service implementing State Pattern and race-condition free time tracking."""

import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.clock import system_clock
from pcn.core.errors import Conflict, NotFound, PermissionDenied
from pcn.domain.enums import ADMIN_ROLES, AuditAction, TaskAction, TaskStatus
from pcn.domain.task_state import next_status
from pcn.models.audit_log import AuditLog
from pcn.models.task import Task
from pcn.models.task_time_session import TaskTimeSession
from pcn.models.user import User
from pcn.repositories.client_repository import ClientRepository, TaskTypeRepository
from pcn.repositories.task_repository import TaskRepository
from pcn.repositories.time_session_repository import TimeSessionRepository
from pcn.repositories.user_repository import UserRepository
from pcn.schemas.task import TaskCreate, TaskUpdate, TimerSyncItem
from pcn.schemas.time_session import ActiveTimerResponse

# States a lawyer may move her own task into (no archive/backlog/pool).
_LAWYER_STATUSES = frozenset(
    {TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.PAUSED, TaskStatus.COMPLETED}
)

_ALLOWED_META_KEYS = frozenset(
    {
        "v6_status",
        "priority",
        "request_date",
        "origin",
        "communication_ref",
        "start_date",
        "entity",
        "process_reference",
        "follow_up_date",
        "waiting_started_at",
        "waiting_total_seconds",
        "waiting_periods",
        "documented_expenses",
        "undocumented_expenses",
    }
)


def _merge_task_meta(task: Task, patch: dict[str, Any] | None) -> None:
    """Safely merges sanitized operational metadata into Task.metadata_json."""
    if not patch or not isinstance(patch, dict):
        return
    current = dict(task.meta)
    for key, val in patch.items():
        if key in _ALLOWED_META_KEYS:
            current[key] = val
    task.metadata_json = json.dumps(current, ensure_ascii=False)


def _close_open_waiting_if_any(meta: dict[str, Any], now: datetime) -> None:
    """Closes an open external waiting period and accumulates elapsed seconds."""
    started_raw = meta.get("waiting_started_at")
    if not started_raw or not isinstance(started_raw, str):
        return
    try:
        parsed_start = datetime.fromisoformat(started_raw.replace("Z", "+00:00"))
        if parsed_start.tzinfo is None:
            parsed_start = parsed_start.replace(tzinfo=UTC)
        now_utc = now if now.tzinfo else now.replace(tzinfo=UTC)
        elapsed = max(0, int((now_utc - parsed_start).total_seconds()))
        meta["waiting_total_seconds"] = int(meta.get("waiting_total_seconds") or 0) + elapsed
        periods = list(meta.get("waiting_periods") or [])
        reason = str(meta.get("v6_status") or "A aguardar")
        periods.append(
            {
                "id": f"wp_{int(now_utc.timestamp())}",
                "reason": reason,
                "started_at": parsed_start.isoformat(),
                "ended_at": now_utc.isoformat(),
            }
        )
        meta["waiting_periods"] = periods[-25:]
    except (TypeError, ValueError):
        pass
    meta["waiting_started_at"] = None


class TaskService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.task_repo = TaskRepository(session)
        self.client_repo = ClientRepository(session)
        self.task_type_repo = TaskTypeRepository(session)
        self.session_repo = TimeSessionRepository(session)
        self.user_repo = UserRepository(session)

    @staticmethod
    def _ensure_owner_or_admin(user: User, task: Task) -> None:
        """Lawyers only work on tasks assigned to them; Direção/Master on any task."""
        if user.role in ADMIN_ROLES:
            return
        if task.assigned_to != user.id:
            raise PermissionDenied("Só pode trabalhar nas tarefas atribuídas a si.")

    @staticmethod
    def _ensure_admin(user: User) -> None:
        if user.role not in ADMIN_ROLES:
            raise PermissionDenied("Ação reservada à Direção do escritório.")

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
        raw_cid = (data.client_id or "").strip()
        if raw_cid:
            client = await self.client_repo.get_by_id_or_name(raw_cid)
            if not client:
                default_clients_info = {
                    "cli_1": ("Empresa Exemplo, Lda.", "501234567", "PCN 0042", "contacto@empresaexemplo.pt"),
                    "cli_2": ("Cliente Demonstração", "509876543", "PCN 0015", "geral@clientedemo.pt"),
                    "cli_3": ("Sociedade Modelo, S.A.", "508112233", "PCN 0031", "administracao@sociedademodelo.pt"),
                }
                c_data = default_clients_info.get(raw_cid)
                if c_data:
                    cname, cnif, cproc, cemail = c_data
                    client = await self.client_repo.get_by_id_or_name(cname)
                    if not client:
                        from pcn.models.client import Client
                        client = Client(
                            id=raw_cid,
                            name=cname,
                            nif=cnif,
                            process_reference=cproc,
                            email=cemail,
                        )
                        await self.client_repo.add(client)
                        await self.session.flush()

        if not client:
            all_clients = await self.client_repo.list_all(limit=2)
            if len(all_clients) >= 1:
                client = all_clients[0]
            else:
                from pcn.models.client import Client
                client = Client(
                    id="cli_3",
                    name="Sociedade Modelo, S.A.",
                    nif="508112233",
                    process_reference="PCN 0031",
                    email="administracao@sociedademodelo.pt",
                )
                await self.client_repo.add(client)
                await self.session.flush()

        task_type = None
        if data.task_type_name and data.task_type_name.strip():
            clean_tname = data.task_type_name.strip()
            task_type = await self.task_type_repo.get_by_name(clean_tname)
            if not task_type:
                from pcn.models.client import TaskType
                task_type = TaskType(
                    name=clean_tname,
                    description=None,
                    hourly_rate=float(data.hourly_rate) if data.hourly_rate is not None else 120.00,
                    default_billable=True,
                    color="#92006F",
                )
                await self.task_type_repo.add(task_type)
                await self.session.flush()
            elif data.hourly_rate is not None:
                task_type.hourly_rate = float(data.hourly_rate)
                await self.session.flush()

        if not task_type:
            task_type = await self.task_type_repo.get_by_id_or_name(data.task_type_id)

        if not task_type:
            default_types_info = {
                "tp_1": ("Certidões e Registos", 90.0, "#92006F"),
                "tp_2": ("Peças Processuais", 150.0, "#59083E"),
                "tp_3": ("Consultoria e Reuniões", 120.0, "#C5A467"),
                "tp_4": ("Audiências e Julgamentos", 180.0, "#28202A"),
                "tp_5": ("Análise Documental", 110.0, "#7A005D"),
            }
            t_info = default_types_info.get(data.task_type_id)
            if t_info:
                tname, trate, tcolor = t_info
                task_type = await self.task_type_repo.get_by_name(tname)
                if not task_type:
                    from pcn.models.client import TaskType
                    task_type = TaskType(
                        id=data.task_type_id,
                        name=tname,
                        hourly_rate=float(data.hourly_rate) if data.hourly_rate is not None else trate,
                        default_billable=True,
                        color=tcolor,
                    )
                    await self.task_type_repo.add(task_type)
                    await self.session.flush()

        if not task_type:
            all_types = await self.task_type_repo.list_all()
            if all_types:
                task_type = all_types[0]
            else:
                from pcn.models.client import TaskType
                fallback_name = (data.task_type_id or "Serviço Jurídico Geral").strip()
                if fallback_name.startswith("tp_") or fallback_name.startswith("cat_"):
                    fallback_name = "Serviço Jurídico Geral"
                task_type = TaskType(
                    name=fallback_name,
                    hourly_rate=float(data.hourly_rate) if data.hourly_rate is not None else 120.00,
                    default_billable=True,
                    color="#92006F",
                )
                await self.task_type_repo.add(task_type)
                await self.session.flush()

        initial_status = TaskStatus.BACKLOG
        assigned_to = None

        if data.assigned_to:
            assignee = await self.user_repo.get_by_id_or_alias(data.assigned_to)
            if assignee:
                assigned_to = assignee.id
                initial_status = TaskStatus.ASSIGNED
            else:
                assigned_to = creator.id
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
        _merge_task_meta(task, data.meta)
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
        now = system_clock.now()
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        # All authenticated lawyers can update working task details in Gestão de Tarefas
        if user.role not in ADMIN_ROLES:
            if data.client_id is not None and data.client_id != task.client_id:
                raise PermissionDenied("Apenas a Direção pode mudar o cliente da tarefa.")
            if data.task_type_id is not None and data.task_type_id != task.task_type_id:
                raise PermissionDenied("Apenas a Direção pode mudar o tipo de serviço.")
            if data.status is not None and data.status not in _LAWYER_STATUSES:
                raise PermissionDenied("Apenas a Direção pode mover a tarefa para este estado.")

        previous_status = task.status

        if data.title is not None:
            task.title = data.title.strip()
        if data.description is not None:
            task.description = data.description.strip() if data.description else None
        if data.client_id is not None:
            resolved_client = await self.client_repo.get_by_id_or_name(data.client_id)
            if resolved_client:
                task.client_id = resolved_client.id
        if data.task_type_name and data.task_type_name.strip():
            clean_tname = data.task_type_name.strip()
            resolved_tt = await self.task_type_repo.get_by_name(clean_tname)
            if not resolved_tt:
                from pcn.models.client import TaskType
                resolved_tt = TaskType(
                    name=clean_tname,
                    hourly_rate=float(data.hourly_rate) if data.hourly_rate is not None else 120.00,
                    default_billable=True,
                    color="#92006F",
                )
                await self.task_type_repo.add(resolved_tt)
                await self.session.flush()
            elif data.hourly_rate is not None:
                resolved_tt.hourly_rate = float(data.hourly_rate)
                await self.session.flush()
            task.task_type_id = resolved_tt.id
        elif data.task_type_id is not None:
            resolved_tt = await self.task_type_repo.get_by_id_or_name(data.task_type_id)
            if resolved_tt:
                if data.hourly_rate is not None:
                    resolved_tt.hourly_rate = float(data.hourly_rate)
                    await self.session.flush()
                task.task_type_id = resolved_tt.id
        if data.due_date is not None:
            task.due_date = data.due_date
        if data.is_urgent_deadline is not None:
            task.is_urgent_deadline = data.is_urgent_deadline
        if data.total_duration_seconds is not None:
            task.total_duration_seconds = data.total_duration_seconds
        if data.meta is not None:
            _merge_task_meta(task, data.meta)

        if data.status is not None:
            if data.status == TaskStatus.IN_PROGRESS:
                open_sessions = await self.session_repo.get_active_sessions_for_task(task.id)
                if not open_sessions:
                    await self.session_repo.add(
                        TaskTimeSession(
                            task_id=task.id,
                            user_id=task.assigned_to or user.id,
                            started_at=now,
                            active_marker=None,
                        )
                    )
            elif previous_status == TaskStatus.IN_PROGRESS and data.status != TaskStatus.IN_PROGRESS:
                await self._close_active_session_for_task(
                    task, now, data.total_duration_seconds
                )

            task.status = data.status
            if data.status == TaskStatus.COMPLETED and not task.completed_at:
                task.completed_at = now

        # Fee amount can only be edited by Admin/Patrícia
        if data.fee_amount is not None and user.role in ADMIN_ROLES:
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

    async def assign_task(self, actor: User, task_id: str, lawyer_id: str | None) -> Task:
        """Assigns or reassigns task to a lawyer and records redistribution notices if changed."""
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        prev_assigned_to = task.assigned_to

        if lawyer_id is None:
            # Move to pool or backlog
            task.status = TaskStatus.POOL
            task.assigned_to = None
        else:
            assignee = await self.user_repo.get_by_id_or_alias(lawyer_id)
            resolved_id = assignee.id if assignee else actor.id
            if task.status == TaskStatus.POOL or task.status == TaskStatus.BACKLOG:
                task.status = TaskStatus.ASSIGNED
            task.assigned_to = resolved_id

            if prev_assigned_to and prev_assigned_to != resolved_id:
                prev_user = await self.user_repo.get_by_id(prev_assigned_to)
                new_user = assignee or await self.user_repo.get_by_id(resolved_id)
                client_obj = await self.client_repo.get_by_id(task.client_id)
                if prev_user and new_user:
                    from pcn.models.base import utc_now
                    from pcn.models.notification import TaskRedistributionNotice

                    now = utc_now()
                    common = {
                        "task_id": task.id,
                        "task_title": task.title,
                        "client_name": client_obj.name if client_obj else "",
                        "from_user_id": prev_user.id,
                        "from_user_name": prev_user.name,
                        "to_user_id": new_user.id,
                        "to_user_name": new_user.name,
                        "changed_by": actor.name,
                        "created_at": now,
                    }
                    self.session.add_all(
                        [
                            TaskRedistributionNotice(
                                **common,
                                target_user_id=prev_user.id,
                                role_in_change="previous_owner",
                            ),
                            TaskRedistributionNotice(
                                **common,
                                target_user_id=new_user.id,
                                role_in_change="new_owner",
                            ),
                        ]
                    )

        await self._audit(
            AuditAction.TASK_TRANSITION, actor.id, task.id, f"Assigned to {task.assigned_to}"
        )
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    @staticmethod
    def _calc_seconds(now: datetime, started_at: datetime) -> int:
        from datetime import UTC

        n = now if now.tzinfo else now.replace(tzinfo=UTC)
        s = started_at if started_at.tzinfo else started_at.replace(tzinfo=UTC)
        return max(0, int((n - s).total_seconds()))

    async def _close_active_session_for_task(
        self,
        task: Task,
        now: datetime,
        client_duration_seconds: int | None = None,
    ) -> None:
        """Closes all open sessions for this specific task and accumulates duration into PostgreSQL."""
        open_sessions = await self.session_repo.get_active_sessions_for_task(task.id)
        if open_sessions:
            primary = open_sessions[0]
            duration = self._calc_seconds(now, primary.started_at)
            primary.ended_at = now
            primary.duration_seconds = (primary.duration_seconds or 0) + duration
            primary.active_marker = None
            task.total_duration_seconds = (task.total_duration_seconds or 0) + duration

            for dup in open_sessions[1:]:
                dup.ended_at = now
                dup.duration_seconds = dup.duration_seconds or 0
                dup.active_marker = None

        if (
            client_duration_seconds is not None
            and client_duration_seconds > (task.total_duration_seconds or 0)
        ):
            task.total_duration_seconds = client_duration_seconds

    async def start_timer(self, user: User, task_id: str) -> Task:
        """Starts time tracking for a task without auto-pausing other tasks."""
        now = system_clock.now()
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        self._ensure_owner_or_admin(user, task)

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
            duration_seconds=0,
            active_marker=None,
        )
        await self.session_repo.add(new_session)

        meta = dict(task.meta)
        _close_open_waiting_if_any(meta, now)
        meta["v6_status"] = "Em curso"
        _merge_task_meta(task, meta)

        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Timer started")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def pause_timer(
        self,
        user: User,
        task_id: str,
        client_duration_seconds: int | None = None,
    ) -> Task:
        """Pauses time tracking for a task."""
        now = system_clock.now()
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        self._ensure_owner_or_admin(user, task)

        if task.status == TaskStatus.IN_PROGRESS:
            task.status = next_status(task.status, TaskAction.PAUSE)
        else:
            task.status = TaskStatus.PAUSED

        await self._close_active_session_for_task(task, now, client_duration_seconds)
        _merge_task_meta(task, {"v6_status": "Pausada"})

        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Timer paused")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def complete_task(
        self,
        user: User,
        task_id: str,
        client_duration_seconds: int | None = None,
    ) -> Task:
        """Completes a task and consolidates final duration."""
        now = system_clock.now()
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        self._ensure_owner_or_admin(user, task)

        if task.status != TaskStatus.COMPLETED:
            task.status = next_status(task.status, TaskAction.COMPLETE)
        task.completed_at = now

        await self._close_active_session_for_task(task, now, client_duration_seconds)

        meta = dict(task.meta)
        _close_open_waiting_if_any(meta, now)
        meta["v6_status"] = "Concluída"
        _merge_task_meta(task, meta)

        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Task completed")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def sync_timers(self, user: User, items: list[TimerSyncItem]) -> list[Task]:
        """Checkpoints all active sessions and syncs client durations into PostgreSQL."""
        await self.task_repo.checkpoint_active_sessions()
        now = system_clock.now()
        updated_tasks: list[Task] = []

        for item in items:
            task = await self.task_repo.get_by_id_for_update(item.task_id)
            if not task:
                continue
            if user.role not in ADMIN_ROLES and task.assigned_to != user.id:
                continue
            if item.total_duration_seconds > (task.total_duration_seconds or 0):
                delta = item.total_duration_seconds - (task.total_duration_seconds or 0)
                task.total_duration_seconds = item.total_duration_seconds
                open_sessions = await self.session_repo.get_active_sessions_for_task(task.id)
                if open_sessions:
                    primary = open_sessions[0]
                    primary.duration_seconds = (primary.duration_seconds or 0) + delta
                    primary.started_at = now
                elif task.status == TaskStatus.IN_PROGRESS:
                    await self.session_repo.add(
                        TaskTimeSession(
                            task_id=task.id,
                            user_id=task.assigned_to or user.id,
                            started_at=now,
                            duration_seconds=delta,
                            active_marker=None,
                        )
                    )
            updated_tasks.append(task)

        await self.session.commit()
        result: list[Task] = []
        for t in updated_tasks:
            reloaded = await self.task_repo.get_by_id_with_relations(t.id)
            if reloaded:
                result.append(reloaded)
        return result

    async def archive_task(self, user: User, task_id: str) -> Task:
        """Archives a completed task so it leaves the active board."""
        self._ensure_admin(user)
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        task.status = TaskStatus.ARCHIVED
        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Task archived")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def restore_task(self, user: User, task_id: str) -> Task:
        """Restores an archived task back to completed."""
        self._ensure_admin(user)
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        task.status = TaskStatus.COMPLETED
        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, "Task restored from archive")
        await self.session.commit()
        return await self.task_repo.get_by_id_with_relations(task.id)  # type: ignore[return-value]

    async def delete_task(self, user: User, task_id: str) -> bool:
        """Deletes a task permanently with audit log."""
        self._ensure_admin(user)
        task = await self.task_repo.get_by_id_for_update(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")
        await self._audit(AuditAction.TASK_TRANSITION, user.id, task.id, f"Task deleted: {task.title}")
        await self.task_repo.delete(task)
        await self.session.commit()
        return True

    async def get_active_timer(self, user_id: str) -> ActiveTimerResponse:
        """Returns the active timer and elapsed seconds computed against server clock."""
        await self.task_repo.checkpoint_active_sessions()
        now = system_clock.now()
        session = await self.session_repo.get_active_session_for_user(user_id)
        if not session or not session.task:
            return ActiveTimerResponse(is_active=False, server_time=now)

        elapsed = self._calc_seconds(now, session.started_at)
        client_name = session.task.client.name if session.task.client else None

        return ActiveTimerResponse(
            is_active=True,
            task_id=session.task.id,
            task_title=session.task.title,
            client_name=client_name,
            started_at=session.started_at,
            server_time=now,
            elapsed_seconds=(session.duration_seconds or 0) + elapsed,
            total_accumulated_seconds=(session.task.total_duration_seconds or 0) + elapsed,
        )
