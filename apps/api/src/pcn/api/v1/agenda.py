"""Agenda, court commitments, and Portuguese Judicial Deadlines endpoints."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import is_admin, require_admin, require_full_access
from pcn.core.config import get_settings
from pcn.core.database import get_session
from pcn.models.calendar_feed import CalendarFeedConfig
from pcn.models.user import User
from pcn.schemas.event import (
    EventCreate,
    EventRead,
    EventUpdate,
    JudicialDeadlineCalculateRequest,
    JudicialDeadlineCalculateResponse,
)
from pcn.services.deadline_service import DeadlineService
from pcn.services.google_ics_service import (
    fetch_google_ics_events,
    mask_ics_url,
    validate_google_ics_url,
)

router = APIRouter(prefix="/agenda", tags=["Agendas, Prazos e Calculadora Judicial"])


@router.post("/calculate-deadline", response_model=JudicialDeadlineCalculateResponse)
async def calculate_judicial_deadline_endpoint(
    body: JudicialDeadlineCalculateRequest,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JudicialDeadlineCalculateResponse:
    """Calcula a data limite de um prazo judicial segundo o art. 138.º e 139.º do CPC português
    (contagem contínua, suspensão em férias judiciais, passagem para o 1º dia útil e 3 dias de multa).
    """
    svc = DeadlineService(session)
    return svc.calculate_deadline(body)


@router.get("/events", response_model=list[EventRead])
async def list_events(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
    start_time: datetime | None = Query(None, description="Início do intervalo (ISO-8601, opcional)"),
    end_time: datetime | None = Query(None, description="Fim do intervalo (ISO-8601, opcional)"),
) -> list[EventRead]:
    if start_time is not None and start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=UTC)
    if end_time is not None and end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=UTC)
    svc = DeadlineService(session)
    owner_filter = None if is_admin(user) else user.id
    events = await svc.list_events_for_range(start_time, end_time, owner_filter)
    return [EventRead.model_validate(e) for e in events]


@router.post("/events", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EventRead:
    svc = DeadlineService(session)
    event = await svc.create_event(user, body)
    return EventRead.model_validate(event)


@router.patch("/events/{event_id}", response_model=EventRead)
async def update_event(
    event_id: str,
    body: EventUpdate,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EventRead:
    svc = DeadlineService(session)
    event = await svc.update_event(user, event_id, body)
    return EventRead.model_validate(event)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    svc = DeadlineService(session)
    await svc.delete_event(user, event_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Sincronização Automática Google Calendar (.ics -> App) ──


class GoogleIcsConfigUpdate(BaseModel):
    ics_url: str = Field(default="", max_length=2000)


class GoogleIcsConfigRead(BaseModel):
    configured: bool
    ics_url_masked: str | None = None
    updated_at: datetime | None = None


class GoogleIcsEventItem(BaseModel):
    uid: str
    title: str
    subtitle: str | None = None
    date: str
    time: str
    type: str


class GoogleIcsEventsResponse(BaseModel):
    configured: bool
    synced_at: datetime
    error: str | None = None
    events: list[GoogleIcsEventItem] = Field(default_factory=list)


async def _resolve_ics_url(session: AsyncSession) -> tuple[str | None, datetime | None]:
    res = await session.execute(
        select(CalendarFeedConfig).where(CalendarFeedConfig.id == "default")
    )
    cfg = res.scalar_one_or_none()
    if cfg and cfg.ics_url:
        return cfg.ics_url, cfg.updated_at
    env_url = get_settings().GOOGLE_CALENDAR_ICS_URL
    return (env_url.strip() if env_url else None), None


@router.get("/google-ics/config", response_model=GoogleIcsConfigRead)
async def get_google_ics_config(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> GoogleIcsConfigRead:
    url, updated_at = await _resolve_ics_url(session)
    return GoogleIcsConfigRead(
        configured=bool(url),
        ics_url_masked=mask_ics_url(url),
        updated_at=updated_at,
    )


@router.put("/google-ics/config", response_model=GoogleIcsConfigRead)
async def update_google_ics_config(
    body: GoogleIcsConfigUpdate,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> GoogleIcsConfigRead:
    validated_url = validate_google_ics_url(body.ics_url)
    res = await session.execute(
        select(CalendarFeedConfig).where(CalendarFeedConfig.id == "default")
    )
    cfg = res.scalar_one_or_none()
    if not cfg:
        cfg = CalendarFeedConfig(
            id="default",
            ics_url=validated_url or None,
            updated_by=admin.name,
        )
        session.add(cfg)
    else:
        cfg.ics_url = validated_url or None
        cfg.updated_by = admin.name
    await session.commit()
    await session.refresh(cfg)
    return GoogleIcsConfigRead(
        configured=bool(cfg.ics_url),
        ics_url_masked=mask_ics_url(cfg.ics_url),
        updated_at=cfg.updated_at,
    )


@router.get("/google-ics/events", response_model=GoogleIcsEventsResponse)
async def list_google_ics_events(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
    force_refresh: bool = Query(False),
) -> GoogleIcsEventsResponse:
    url, _ = await _resolve_ics_url(session)
    now_utc = datetime.now(UTC)
    if not url:
        return GoogleIcsEventsResponse(configured=False, synced_at=now_utc, events=[])
    try:
        parsed = await fetch_google_ics_events(url, force_refresh=force_refresh)
        return GoogleIcsEventsResponse(
            configured=True,
            synced_at=now_utc,
            events=[
                GoogleIcsEventItem(
                    uid=e.uid,
                    title=e.title,
                    subtitle=e.subtitle,
                    date=e.date,
                    time=e.time,
                    type=e.event_type,
                )
                for e in parsed
            ],
        )
    except Exception as exc:
        return GoogleIcsEventsResponse(
            configured=True,
            synced_at=now_utc,
            error=f"Não foi possível ler o calendário Google (.ics): {exc}",
            events=[],
        )
