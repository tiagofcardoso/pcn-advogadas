"""Authentication endpoints: login, 2FA/TOTP setup and verification, token refresh."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import get_current_user
from pcn.core.config import Settings, get_settings
from pcn.core.database import get_session
from pcn.core.rate_limit import auth_rate_limit, limiter
from pcn.models.user import User
from pcn.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MfaVerifyRequest,
    RefreshResponse,
    TwoFASetupResponse,
    TwoFAVerifyRequest,
    UserProfileResponse,
)
from pcn.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Autenticação"])


def _set_refresh_cookie(response: Response, raw_token: str, settings: Settings) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=raw_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit(auth_rate_limit)
async def login(
    request: Request,
    credentials: LoginRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> LoginResponse:
    client_ip = request.client.host if request.client else None
    auth_svc = AuthService(session, settings)
    login_resp, refresh_token = await auth_svc.login(credentials, client_ip=client_ip)

    if refresh_token:
        _set_refresh_cookie(response, refresh_token, settings)

    return login_resp


@router.post("/2fa/verify-login", response_model=LoginResponse)
@limiter.limit(auth_rate_limit)
async def verify_mfa_login(
    request: Request,
    body: MfaVerifyRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> LoginResponse:
    client_ip = request.client.host if request.client else None
    auth_svc = AuthService(session, settings)
    login_resp, refresh_token = await auth_svc.verify_mfa_login(body, client_ip=client_ip)

    _set_refresh_cookie(response, refresh_token, settings)
    return login_resp


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit(auth_rate_limit)
async def refresh_tokens(
    request: Request,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
    refresh_cookie: Annotated[str | None, Cookie(alias="pcn_refresh")] = None,
) -> RefreshResponse:
    if not refresh_cookie:
        from pcn.core.errors import TokenError

        raise TokenError("Cookie de sessão em falta.")

    client_ip = request.client.host if request.client else None
    auth_svc = AuthService(session, settings)
    refresh_resp, new_refresh = await auth_svc.refresh_access_token(
        refresh_cookie, client_ip=client_ip
    )
    _set_refresh_cookie(response, new_refresh, settings)
    return refresh_resp


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    _clear_refresh_cookie(response, settings)


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserProfileResponse:
    return UserProfileResponse.model_validate(current_user)


@router.post("/2fa/setup", response_model=TwoFASetupResponse)
async def setup_2fa(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TwoFASetupResponse:
    auth_svc = AuthService(session)
    return await auth_svc.setup_2fa(current_user)


@router.post("/2fa/verify", status_code=status.HTTP_200_OK)
async def verify_2fa(
    body: TwoFAVerifyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    auth_svc = AuthService(session)
    await auth_svc.verify_and_enable_2fa(current_user, body.code)
    return {"message": "Autenticação de dois fatores (2FA) ativada com sucesso."}


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    body: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    auth_svc = AuthService(session)
    await auth_svc.change_password(current_user, body)
    return {"message": "Palavra-passe atualizada com sucesso."}
