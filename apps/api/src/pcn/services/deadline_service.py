"""Judicial deadlines (Art. 138/139 CPC) and Agenda event services."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.errors import NotFound
from pcn.domain.deadlines import calculate_judicial_deadline
from pcn.models.event import Event
from pcn.models.user import User
from pcn.repositories.client_repository import ClientRepository
from pcn.repositories.event_repository import EventRepository
from pcn.repositories.user_repository import UserRepository
from pcn.schemas.event import (
    EventCreate,
    EventUpdate,
    JudicialDeadlineCalculateRequest,
    JudicialDeadlineCalculateResponse,
)


class DeadlineService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.event_repo = EventRepository(session)
        self.user_repo = UserRepository(session)
        self.client_repo = ClientRepository(session)

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
        resolved_owner_id = user.id
        if data.owner_id and data.owner_id.strip():
            found_owner = await self.user_repo.get_by_id_or_alias(data.owner_id.strip())
            if found_owner:
                resolved_owner_id = found_owner.id

        resolved_client_id = None
        if data.client_id and data.client_id.strip():
            found_client = await self.client_repo.get_by_id_or_name(data.client_id.strip())
            if found_client:
                resolved_client_id = found_client.id

        event = Event(
            title=data.title.strip(),
            description=data.description.strip() if data.description else None,
            starts_at=data.starts_at,
            ends_at=data.ends_at,
            owner_id=resolved_owner_id,
            client_id=resolved_client_id,
            task_id=None,
            location=data.location,
            is_deadline=data.is_deadline,
            is_urgent_judicial=data.is_urgent_judicial,
        )
        await self.event_repo.add(event)
        await self.session.commit()
        return await self.event_repo.get_by_id_with_relations(event.id) or event

    async def update_event(self, user: User, event_id: str, data: EventUpdate) -> Event:
        """Updates an existing agenda event."""
        event = await self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFound("Registo da agenda não encontrado.")

        if data.title is not None:
            event.title = data.title.strip()
        if data.description is not None:
            event.description = data.description.strip() if data.description else None
        if data.starts_at is not None:
            event.starts_at = data.starts_at
        if data.ends_at is not None:
            event.ends_at = data.ends_at
        if data.owner_id is not None and data.owner_id.strip():
            found_owner = await self.user_repo.get_by_id_or_alias(data.owner_id.strip())
            if found_owner:
                event.owner_id = found_owner.id
        if data.client_id is not None:
            if data.client_id.strip():
                found_client = await self.client_repo.get_by_id_or_name(data.client_id.strip())
                event.client_id = found_client.id if found_client else None
            else:
                event.client_id = None
        if data.location is not None:
            event.location = data.location
        if data.is_deadline is not None:
            event.is_deadline = data.is_deadline
        if data.is_urgent_judicial is not None:
            event.is_urgent_judicial = data.is_urgent_judicial

        await self.session.commit()
        return await self.event_repo.get_by_id_with_relations(event.id) or event

    async def delete_event(self, user: User, event_id: str) -> None:
        """Deletes an agenda event."""
        event = await self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFound("Registo da agenda não encontrado.")
        await self.event_repo.delete(event)
        await self.session.commit()

    async def list_events_for_range(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        owner_id: str | None = None,
    ) -> Sequence[Event]:
        return await self.event_repo.list_for_range(start_time, end_time, owner_id)
