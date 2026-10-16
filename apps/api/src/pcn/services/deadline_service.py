"""Judicial deadlines (Art. 138/139 CPC) and Agenda event services."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from pcn.domain.deadlines import calculate_judicial_deadline
from pcn.models.event import Event
from pcn.models.user import User
from pcn.repositories.event_repository import EventRepository
from pcn.schemas.event import (
    EventCreate,
    JudicialDeadlineCalculateRequest,
    JudicialDeadlineCalculateResponse,
)


class DeadlineService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.event_repo = EventRepository(session)

    def calculate_deadline(
        self, req: JudicialDeadlineCalculateRequest
    ) -> JudicialDeadlineCalculateResponse:
        """Calculates exact judicial deadline according to Portuguese Civil Procedure Code."""
        res = calculate_judicial_deadline(
            start_date=req.start_date,
            days=req.days,
            is_urgent=req.is_urgent,
        )
        return JudicialDeadlineCalculateResponse(
            start_date=res.start_date,
            days_count=res.days_count,
            is_urgent=res.is_urgent,
            final_deadline=res.final_deadline,
            penalty_day_1=res.penalty_day_1,
            penalty_day_2=res.penalty_day_2,
            penalty_day_3=res.penalty_day_3,
            suspended_vacation_days=res.suspended_vacation_days,
        )

    async def create_event(self, user: User, data: EventCreate) -> Event:
        """Creates an agenda commitment or judicial deadline event."""
        event = Event(
            title=data.title.strip(),
            description=data.description.strip() if data.description else None,
            starts_at=data.starts_at,
            ends_at=data.ends_at,
            owner_id=user.id,
            client_id=data.client_id,
            task_id=data.task_id,
            location=data.location,
            is_deadline=data.is_deadline,
            is_urgent_judicial=data.is_urgent_judicial,
        )
        await self.event_repo.add(event)
        await self.session.commit()
        return event

    async def list_events_for_range(
        self, start_time: datetime, end_time: datetime, owner_id: str | None = None
    ) -> Sequence[Event]:
        return await self.event_repo.list_for_range(start_time, end_time, owner_id)
