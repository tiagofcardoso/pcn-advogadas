"""Time tracking and live stopwatch endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import require_full_access
from pcn.core.database import get_session
from pcn.models.user import User
from pcn.schemas.task import TaskRead
from pcn.schemas.time_session import ActiveTimerResponse
from pcn.services.task_service import TaskService

router = APIRouter(prefix="/timer", tags=["Motor de Tempo / Cronómetro"])


@router.get("/active", response_model=ActiveTimerResponse)
async def get_active_timer(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ActiveTimerResponse:
    """Retorna o cronómetro em execução para a advogada autenticada, calculado pelo relógio do servidor."""
    task_svc = TaskService(session)
    return await task_svc.get_active_timer(user.id)


@router.post("/{task_id}/start", response_model=TaskRead)
async def start_timer(
    task_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    """Inicia a contagem de tempo. Pausa automaticamente qualquer outro cronómetro ativo da mesma advogada."""
    task_svc = TaskService(session)
    task = await task_svc.start_timer(user, task_id)
    return TaskRead.model_validate(task)


@router.post("/{task_id}/pause", response_model=TaskRead)
async def pause_timer(
    task_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    """Pausa a contagem de tempo e soma os segundos acumulados na tarefa."""
    task_svc = TaskService(session)
    task = await task_svc.pause_timer(user, task_id)
    return TaskRead.model_validate(task)


@router.post("/{task_id}/complete", response_model=TaskRead)
async def complete_task(
    task_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    """Conclui a tarefa, encerra o cronómetro ativo e disponibiliza-a imediatamente para a Nota de Honorários."""
    task_svc = TaskService(session)
    task = await task_svc.complete_task(user, task_id)
    return TaskRead.model_validate(task)
