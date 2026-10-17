"""Task repository with board filters, locking, and search."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pcn.domain.enums import TaskStatus
from pcn.models.task import Task
from pcn.repositories.base import BaseRepository


class TaskRepository(BaseRepository[Task]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Task, session)

    def _default_options(self):
        return (
            selectinload(Task.client),
            selectinload(Task.task_type),
            selectinload(Task.assignee),
            selectinload(Task.time_sessions),
        )

    async def checkpoint_active_sessions(self) -> None:
        """Flushes elapsed time of all currently running tasks into tasks.total_duration_seconds in PostgreSQL."""
        from datetime import UTC

        from pcn.core.clock import system_clock
        from pcn.models.task_time_session import TaskTimeSession

        now = system_clock.now()
        n = now if now.tzinfo else now.replace(tzinfo=UTC)

        result = await self.session.execute(
            select(Task)
            .where(Task.status == TaskStatus.IN_PROGRESS)
            .options(selectinload(Task.time_sessions))
        )
        running_tasks = result.scalars().all()
        if not running_tasks:
            return

        dirty = False
        for task in running_tasks:
            open_sessions = [s for s in task.time_sessions if s.ended_at is None]
            if open_sessions:
                open_sessions.sort(key=lambda s: s.started_at, reverse=True)
                primary = open_sessions[0]
                s_time = (
                    primary.started_at
                    if primary.started_at.tzinfo
                    else primary.started_at.replace(tzinfo=UTC)
                )
                elapsed = max(0, int((n - s_time).total_seconds()))
                if elapsed > 0:
                    task.total_duration_seconds = (task.total_duration_seconds or 0) + elapsed
                    primary.duration_seconds = (primary.duration_seconds or 0) + elapsed
                    primary.started_at = now
                    dirty = True
                for dup in open_sessions[1:]:
                    dup.ended_at = now
                    dup.duration_seconds = dup.duration_seconds or 0
                    dup.active_marker = None
                    dirty = True
            else:
                ref_time = task.updated_at if task.updated_at else now
                r_time = ref_time if ref_time.tzinfo else ref_time.replace(tzinfo=UTC)
                elapsed = max(0, int((n - r_time).total_seconds()))
                if elapsed > 0:
                    task.total_duration_seconds = (task.total_duration_seconds or 0) + elapsed
                new_session = TaskTimeSession(
                    task_id=task.id,
                    user_id=task.assigned_to or task.created_by,
                    started_at=now,
                    duration_seconds=elapsed,
                    active_marker=None,
                )
                self.session.add(new_session)
                dirty = True

        if dirty:
            await self.session.commit()

    async def get_by_id_with_relations(self, id_: str) -> Task | None:
        result = await self.session.execute(
            select(Task).where(Task.id == id_).options(*self._default_options())
        )
        return result.scalar_one_or_none()

    async def get_by_id_for_update(self, id_: str) -> Task | None:
        """Locks row with SELECT ... FOR UPDATE to prevent race conditions during claim/timer."""
        result = await self.session.execute(
            select(Task).where(Task.id == id_).with_for_update().options(*self._default_options())
        )
        return result.scalar_one_or_none()

    async def list_pool_tasks(self) -> Sequence[Task]:
        """Tasks published to the shared pool awaiting a lawyer."""
        result = await self.session.execute(
            select(Task)
            .where(Task.status == TaskStatus.POOL)
            .order_by(Task.created_at.desc())
            .options(*self._default_options())
        )
        return result.scalars().all()

    async def list_personal_tasks(self, lawyer_id: str) -> Sequence[Task]:
        """Lawyer's personal tasks."""
        await self.checkpoint_active_sessions()
        result = await self.session.execute(
            select(Task)
            .where(Task.assigned_to == lawyer_id)
            .order_by(Task.updated_at.desc())
            .options(*self._default_options())
        )
        return result.scalars().all()

    async def list_direction_tasks(
        self,
        status: TaskStatus | None = None,
        lawyer_id: str | None = None,
        client_id: str | None = None,
    ) -> Sequence[Task]:
        """Admin/Direction board showing tasks with optional filters."""
        await self.checkpoint_active_sessions()
        query = select(Task).order_by(Task.updated_at.desc()).options(*self._default_options())
        if status:
            query = query.where(Task.status == status)
        if lawyer_id:
            query = query.where(Task.assigned_to == lawyer_id)
        if client_id:
            query = query.where(Task.client_id == client_id)

        result = await self.session.execute(query)
        return result.scalars().all()

    async def list_unbilled_completed_tasks(self, client_id: str) -> Sequence[Task]:
        """Completed tasks for a client that have not yet been assigned to a fee note."""
        result = await self.session.execute(
            select(Task)
            .where(
                Task.client_id == client_id,
                Task.status == TaskStatus.COMPLETED,
                Task.fee_note_id.is_(None),
            )
            .order_by(Task.completed_at.asc())
            .options(*self._default_options())
        )
        return result.scalars().all()

    async def search_tasks(
        self,
        query: str | None = None,
        task_type_id: str | None = None,
        lawyer_id: str | None = None,
        client_id: str | None = None,
    ) -> Sequence[Task]:
        """Search tasks by query string (case-insensitive substring match) and filters."""
        await self.checkpoint_active_sessions()
        stmt = select(Task).order_by(Task.updated_at.desc()).options(*self._default_options())

        if query:
            pattern = f"%{query.strip()}%"
            stmt = stmt.where((Task.title.ilike(pattern)) | (Task.description.ilike(pattern)))
        if task_type_id:
            stmt = stmt.where(Task.task_type_id == task_type_id)
        if lawyer_id:
            stmt = stmt.where(Task.assigned_to == lawyer_id)
        if client_id:
            stmt = stmt.where(Task.client_id == client_id)

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_status(self, lawyer_id: str | None = None) -> dict[TaskStatus, int]:
        stmt = select(Task.status, func.count(Task.id)).group_by(Task.status)
        if lawyer_id:
            stmt = stmt.where(Task.assigned_to == lawyer_id)

        result = await self.session.execute(stmt)
        counts = {status: count for status, count in result.all()}
        return {s: counts.get(s, 0) for s in TaskStatus}
