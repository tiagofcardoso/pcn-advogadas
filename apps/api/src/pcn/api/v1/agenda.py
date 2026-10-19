"""Agenda, court commitments, and Portuguese Judicial Deadlines endpoints."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import is_admin, require_full_access
from pcn.core.database import get_session
from pcn.models.user import User
from pcn.schemas.event import (
    EventCreate,
    EventRead,
    JudicialDeadlineCalculateRequest,
    JudicialDeadlineCalculateResponse,
)
from pcn.services.deadline_service import DeadlineService

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
    start_time: datetime = Query(..., description="Início do intervalo (ISO-8601)"),
    end_time: datetime = Query(..., description="Fim do intervalo (ISO-8601)"),
) -> list[EventRead]:
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
