"""User provisioning endpoints (restricted to Admin / Managing Partner)."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import require_admin
from pcn.core.database import get_session
from pcn.models.user import User
from pcn.schemas.user import UserCreate, UserCreateResponse, UserRead, UserUpdate
from pcn.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Gestão de Utilizadoras"])


@router.get("", response_model=list[UserRead])
async def list_users(
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[UserRead]:
    user_svc = UserService(session)
    users = await user_svc.list_users()
    return [UserRead.model_validate(u) for u in users]


@router.post("", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserCreateResponse:
    user_svc = UserService(session)
    return await user_svc.create_lawyer_account(admin, body)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    body: UserUpdate,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserRead:
    user_svc = UserService(session)
    user = await user_svc.update_user(admin, user_id, body)
    return UserRead.model_validate(user)


@router.post("/{user_id}/reset-password", response_model=dict[str, str])
async def reset_password(
    user_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    user_svc = UserService(session)
    temp_pass = await user_svc.reset_password(admin, user_id)
    return {"temporary_password": temp_pass}


@router.post("/{user_id}/reset-mfa", response_model=dict[str, str])
async def reset_mfa(
    user_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    user_svc = UserService(session)
    await user_svc.reset_mfa(admin, user_id)
    return {"message": "Autenticação de dois fatores reposta com sucesso."}
