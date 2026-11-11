"""Real-time (polling) notifications: task redistribution notices with individual ACK."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import require_full_access
from pcn.core.database import get_session
from pcn.models.base import utc_now
from pcn.models.notification import TaskRedistributionNotice
from pcn.models.user import User
from pcn.repositories.user_repository import UserRepository

router = APIRouter(prefix="/notifications", tags=["Notificações"])

RETENTION_DAYS = 30
MAX_LIST = 80


class RedistributionCreate(BaseModel):
    task_id: str = Field(min_length=1, max_length=64)
    task_title: str = Field(min_length=1, max_length=300)
    client_name: str = Field(default="", max_length=300)
    from_user_id: str = Field(min_length=1, max_length=36)
    to_user_id: str = Field(min_length=1, max_length=36)


class RedistributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    task_title: str
    client_name: str
    from_user_id: str | None
    from_user_name: str
    to_user_id: str | None
    to_user_name: str
    target_user_id: str
    role_in_change: str
    changed_by: str
    created_at: datetime
    acknowledged_at: datetime | None


@router.get("/redistributions", response_model=list[RedistributionRead])
async def list_my_redistributions(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[TaskRedistributionNotice]:
    """Avisos de redistribuição dirigidos à utilizadora autenticada (polled em tempo real)."""
    since = datetime.now(UTC) - timedelta(days=RETENTION_DAYS)
    stmt = (
        select(TaskRedistributionNotice)
        .where(
            TaskRedistributionNotice.target_user_id == user.id,
            TaskRedistributionNotice.created_at >= since,
        )
        .order_by(TaskRedistributionNotice.created_at.desc())
        .limit(MAX_LIST)
    )
    return list((await session.execute(stmt)).scalars().all())


@router.get("/redistributions/tasks", response_model=list[str])
async def list_redistributed_task_ids(
    _user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[str]:
    """Devolve os IDs de tarefas redistribuídas recentemente para exibir o badge Redistribuída."""
    since = datetime.now(UTC) - timedelta(days=RETENTION_DAYS)
    stmt = (
        select(TaskRedistributionNotice.task_id)
        .where(TaskRedistributionNotice.created_at >= since)
        .distinct()
    )
    return list((await session.execute(stmt)).scalars().all())


@router.post(
    "/redistributions",
    response_model=list[RedistributionRead],
    status_code=status.HTTP_201_CREATED,
)
async def create_redistribution_notices(
    body: RedistributionCreate,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[TaskRedistributionNotice]:
    """Cria um aviso para a advogada anterior e outro para a nova responsável (com deduplicação)."""
    if body.from_user_id == body.to_user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Origem e destino são iguais.")

    recent_cutoff = datetime.now(UTC) - timedelta(seconds=30)
    existing_stmt = select(TaskRedistributionNotice).where(
        TaskRedistributionNotice.task_id == body.task_id,
        TaskRedistributionNotice.from_user_id == body.from_user_id,
        TaskRedistributionNotice.to_user_id == body.to_user_id,
        TaskRedistributionNotice.created_at >= recent_cutoff,
    )
    existing = list((await session.execute(existing_stmt)).scalars().all())
    if existing:
        for item in existing:
            if body.task_title.strip():
                item.task_title = body.task_title.strip()
            if body.client_name.strip():
                item.client_name = body.client_name.strip()
        await session.commit()
        return existing

    repo = UserRepository(session)
    from_user = await repo.get_by_id(body.from_user_id)
    to_user = await repo.get_by_id(body.to_user_id)
    if not from_user or not to_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilizadora não encontrada.")

    now = utc_now()
    common = {
        "task_id": body.task_id,
        "task_title": body.task_title.strip(),
        "client_name": body.client_name.strip(),
        "from_user_id": from_user.id,
        "from_user_name": from_user.name,
        "to_user_id": to_user.id,
        "to_user_name": to_user.name,
        "changed_by": user.name,
        "created_at": now,
    }
    notices = [
        TaskRedistributionNotice(
            **common, target_user_id=from_user.id, role_in_change="previous_owner"
        ),
        TaskRedistributionNotice(
            **common, target_user_id=to_user.id, role_in_change="new_owner"
        ),
    ]
    session.add_all(notices)
    await session.commit()
    return notices


@router.post("/redistributions/{notice_id}/ack", response_model=RedistributionRead)
async def acknowledge_redistribution(
    notice_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskRedistributionNotice:
    """ACK (OK) — apenas a destinatária pode confirmar o seu próprio aviso."""
    notice = await session.get(TaskRedistributionNotice, notice_id)
    if notice is None or notice.target_user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aviso não encontrado.")
    if notice.acknowledged_at is None:
        notice.acknowledged_at = utc_now()
        await session.commit()
    return notice
