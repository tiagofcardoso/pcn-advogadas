"""Event and AuditLog repositories."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pcn.models.audit_log import AuditLog
from pcn.models.event import Event
from pcn.repositories.base import BaseRepository


class EventRepository(BaseRepository[Event]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Event, session)

    async def list_for_range(
        self,
        start_time: datetime,
        end_time: datetime,
        owner_id: str | None = None,
    ) -> Sequence[Event]:
        query = (
            select(Event)
            .where(Event.starts_at >= start_time, Event.starts_at <= end_time)
            .order_by(Event.starts_at.asc())
            .options(selectinload(Event.client), selectinload(Event.owner))
        )
        if owner_id:
            query = query.where(Event.owner_id == owner_id)

        result = await self.session.execute(query)
        return result.scalars().all()


class AuditRepository(BaseRepository[AuditLog]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AuditLog, session)

    async def list_recent(self, limit: int = 100) -> Sequence[AuditLog]:
        result = await self.session.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        )
        return result.scalars().all()
