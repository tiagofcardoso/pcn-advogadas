"""Authentication endpoints: login, 2FA/TOTP setup and verification, token refresh."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import get_current_user
from pcn.core.config import Settings, get_settings
from pcn.core.database import get_session
from pcn.core.errors import TokenError
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


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _set_refresh_cookie(response: Response, raw_token: str, settings: Settings) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=raw_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        path=f"{settings.API_V1_PREFIX}/auth",
    )


def _clear_refresh_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path=f"{settings.API_V1_PREFIX}/auth",
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
    client_ip = _client_ip(request)
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
    client_ip = _client_ip(request)
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
        raise TokenError("Cookie de sessão em falta.")

    client_ip = _client_ip(request)
    auth_svc = AuthService(session, settings)
    refresh_resp, new_refresh = await auth_svc.refresh_access_token(
        refresh_cookie, client_ip=client_ip
    )
    _set_refresh_cookie(response, new_refresh, settings)
    return refresh_resp


@router.post("/keepalive", response_model=RefreshResponse)
async def keepalive_token(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RefreshResponse:
    return AuthService(session, settings).issue_keepalive_token(current_user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
    refresh_cookie: Annotated[str | None, Cookie(alias="pcn_refresh")] = None,
) -> None:
    await AuthService(session, settings).logout(refresh_cookie, client_ip=_client_ip(request))
    _clear_refresh_cookie(response, settings)


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserProfileResponse:
    return UserProfileResponse.model_validate(current_user)


# The routes below accept the SETUP scope: they are the first-login flow itself.


@router.post("/2fa/setup", response_model=TwoFASetupResponse)
@limiter.limit(auth_rate_limit)
async def setup_2fa(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TwoFASetupResponse:
    return await AuthService(session).setup_2fa(current_user)


@router.post("/2fa/verify", response_model=LoginResponse)
@limiter.limit(auth_rate_limit)
async def verify_2fa(
    request: Request,
    body: TwoFAVerifyRequest,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> LoginResponse:
    auth_svc = AuthService(session, settings)
    login_resp, refresh_token = await auth_svc.verify_and_enable_2fa(
        current_user, body.code, client_ip=_client_ip(request)
    )
    _set_refresh_cookie(response, refresh_token, settings)
    return login_resp


@router.post("/change-password", response_model=LoginResponse)
@limiter.limit(auth_rate_limit)
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> LoginResponse:
    auth_svc = AuthService(session, settings)
    login_resp, refresh_token = await auth_svc.change_password(
        current_user, body, client_ip=_client_ip(request)
    )
    _set_refresh_cookie(response, refresh_token, settings)
    return login_resp
