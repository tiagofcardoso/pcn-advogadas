"""Task and Board endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import require_admin, require_full_access
from pcn.core.database import get_session
from pcn.core.errors import NotFound
from pcn.domain.enums import TaskStatus
from pcn.models.user import User
from pcn.repositories.task_repository import TaskRepository
from pcn.schemas.task import (
    BoardSummaryResponse,
    TaskAssignRequest,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)
from pcn.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Tarefas e Quadros Kanban"])


# ── Quadros Kanban ──


@router.get("/boards/direction", response_model=list[TaskRead])
async def get_direction_board(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
    status: TaskStatus | None = None,
    lawyer_id: str | None = None,
    client_id: str | None = None,
) -> list[TaskRead]:
    """Painel de Direção / Quadro Geral de Tarefas."""
    repo = TaskRepository(session)
    tasks = await repo.list_direction_tasks(status=status, lawyer_id=lawyer_id, client_id=client_id)
    return [TaskRead.model_validate(t) for t in tasks]


@router.get("/boards/pool", response_model=list[TaskRead])
async def get_shared_pool(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[TaskRead]:
    """Quadro Partilhado / Pool de tarefas livres para auto-atribuição."""
    repo = TaskRepository(session)
    tasks = await repo.list_pool_tasks()
    return [TaskRead.model_validate(t) for t in tasks]


@router.get("/boards/me", response_model=list[TaskRead])
async def get_personal_board(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[TaskRead]:
    """Quadro Pessoal da Advogada autenticada."""
    repo = TaskRepository(session)
    tasks = await repo.list_personal_tasks(user.id)
    return [TaskRead.model_validate(t) for t in tasks]


@router.get("/boards/summary", response_model=BoardSummaryResponse)
async def get_boards_summary(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BoardSummaryResponse:
    repo = TaskRepository(session)
    lawyer_filter = None if user.role.value == "admin_lawyer" else user.id
    counts = await repo.count_by_status(lawyer_filter)
    return BoardSummaryResponse(
        backlog_count=counts.get(TaskStatus.BACKLOG, 0),
        pool_count=counts.get(TaskStatus.POOL, 0),
        assigned_count=counts.get(TaskStatus.ASSIGNED, 0),
        in_progress_count=counts.get(TaskStatus.IN_PROGRESS, 0),
        paused_count=counts.get(TaskStatus.PAUSED, 0),
        completed_count=counts.get(TaskStatus.COMPLETED, 0),
    )


# ── CRUD e Transições de Tarefas ──


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    task_svc = TaskService(session)
    task = await task_svc.create_task(user, body)
    return TaskRead.model_validate(task)


@router.get("/search", response_model=list[TaskRead])
async def search_tasks(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
    q: str | None = Query(
        None, description="Pesquisa por termo no título/descrição (ex: 'negativa')"
    ),
    task_type_id: str | None = None,
    lawyer_id: str | None = None,
    client_id: str | None = None,
) -> list[TaskRead]:
    repo = TaskRepository(session)
    tasks = await repo.search_tasks(
        query=q, task_type_id=task_type_id, lawyer_id=lawyer_id, client_id=client_id
    )
    return [TaskRead.model_validate(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    repo = TaskRepository(session)
    task = await repo.get_by_id_with_relations(task_id)
    if not task:
        raise NotFound("Tarefa não encontrada.")
    return TaskRead.model_validate(task)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    task_svc = TaskService(session)
    task = await task_svc.update_task(user, task_id, body)
    return TaskRead.model_validate(task)


@router.post("/{task_id}/publish", response_model=TaskRead)
async def publish_task(
    task_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    task_svc = TaskService(session)
    task = await task_svc.publish_to_pool(admin, task_id)
    return TaskRead.model_validate(task)


@router.post("/{task_id}/claim", response_model=TaskRead)
async def claim_task(
    task_id: str,
    lawyer: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    task_svc = TaskService(session)
    task = await task_svc.claim_task(lawyer, task_id)
    return TaskRead.model_validate(task)


@router.post("/{task_id}/assign", response_model=TaskRead)
async def assign_task(
    task_id: str,
    body: TaskAssignRequest,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    task_svc = TaskService(session)
    task = await task_svc.assign_task(admin, task_id, body.assigned_to)
    return TaskRead.model_validate(task)


@router.post("/{task_id}/archive", response_model=TaskRead)
async def archive_task(
    task_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    """Move completed task to archived."""
    task_svc = TaskService(session)
    task = await task_svc.archive_task(user, task_id)
    return TaskRead.model_validate(task)


@router.post("/{task_id}/restore", response_model=TaskRead)
async def restore_task(
    task_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRead:
    """Restore an archived task back to completed."""
    task_svc = TaskService(session)
    task = await task_svc.restore_task(user, task_id)
    return TaskRead.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Permanently delete a task."""
    task_svc = TaskService(session)
    await task_svc.delete_task(user, task_id)
