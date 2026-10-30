"""User provisioning and CRUD endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import get_current_user, is_admin, require_admin, require_full_access
from pcn.core.database import get_session
from pcn.models.user import User
from pcn.schemas.user import UserCreate, UserCreateResponse, UserRead, UserUpdate
from pcn.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Gestão de Utilizadoras"])


@router.get("", response_model=list[UserRead])
async def list_users(
    _current_user: Annotated[User, Depends(require_full_access)],
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


@router.patch("/me/profile", response_model=UserRead)
async def update_my_profile(
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserRead:
    """Permite que cada utilizadora atualize os seus próprios dados de perfil (nome, e-mail, palavra-passe, perfil se admin)."""
    safe_body = UserUpdate(
        name=body.name,
        email=body.email,
        password=body.password,
        role=body.role if is_admin(current_user) else None,
    )
    user_svc = UserService(session)
    user = await user_svc.update_user(current_user, current_user.id, safe_body)
    return UserRead.model_validate(user)


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


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    user_svc = UserService(session)
    await user_svc.delete_user(admin, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{user_id}/unlock", response_model=UserRead)
async def unlock_user(
    user_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserRead:
    """Desbloqueia uma conta bloqueada por tentativas de login falhadas."""
    user = await UserService(session).unlock_user(admin, user_id)
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
