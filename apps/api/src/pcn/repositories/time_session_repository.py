"""Task Time Session repository."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pcn.models.task_time_session import TaskTimeSession
from pcn.repositories.base import BaseRepository


class TimeSessionRepository(BaseRepository[TaskTimeSession]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(TaskTimeSession, session)

    async def get_active_session_for_user(self, user_id: str) -> TaskTimeSession | None:
        """Returns the currently running session for this user, if any."""
        result = await self.session.execute(
            select(TaskTimeSession)
            .where(
                TaskTimeSession.user_id == user_id,
                TaskTimeSession.active_marker == 1,
            )
            .options(selectinload(TaskTimeSession.task))
        )
        return result.scalar_one_or_none()

    async def list_by_task(self, task_id: str) -> Sequence[TaskTimeSession]:
        result = await self.session.execute(
            select(TaskTimeSession)
            .where(TaskTimeSession.task_id == task_id)
            .order_by(TaskTimeSession.started_at.asc())
        )
        return result.scalars().all()
