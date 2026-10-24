"""Authentication Service: Argon2id verification, brute-force lockout, TOTP, and refresh token rotation."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.clock import system_clock
from pcn.core.config import Settings, get_settings
from pcn.core.errors import AuthenticationError, BusinessRuleViolation, Conflict, TokenError
from pcn.core.security import (
    JwtService,
    TokenScope,
    TokenType,
    TotpService,
    burn_password_check,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    validate_password_policy,
    verify_password,
)
from pcn.domain.enums import AuditAction
from pcn.models.audit_log import AuditLog
from pcn.models.user import RefreshToken, User
from pcn.repositories.user_repository import RefreshTokenRepository, UserRepository
from pcn.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MfaVerifyRequest,
    RefreshResponse,
    TwoFASetupResponse,
)

LOCKED_MESSAGE = "Conta temporariamente bloqueada devido a tentativas excessivas. Tente mais tarde."


def as_utc(value: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; treat stored naive datetimes as UTC."""
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def is_locked(user: User, now: datetime) -> bool:
    locked_until = as_utc(user.locked_until)
    return locked_until is not None and locked_until > now


def scope_for(user: User) -> TokenScope:
    """SETUP until the user has a personal password AND 2FA enabled; FULL afterwards."""
    if user.must_change_password or not user.is_totp_enabled:
        return TokenScope.SETUP
    return TokenScope.FULL


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.user_repo = UserRepository(session)
        self.refresh_repo = RefreshTokenRepository(session)
        self.jwt = JwtService(self.settings)
        self.totp = TotpService(self.settings)

    async def _audit(
        self,
        action: AuditAction,
        actor_id: str | None,
        entity_id: str | None = None,
        ip: str | None = None,
        meta: str | None = None,
    ) -> None:
        self.session.add(
            AuditLog(
                actor_id=actor_id,
                action=action,
                entity="user",
                entity_id=entity_id,
                ip_address=ip,
                metadata_json=meta,
            )
        )

    async def _register_failure(self, user: User, now: datetime, client_ip: str | None) -> None:
        user.failed_login_attempts += 1
        await self._audit(AuditAction.LOGIN_FAILURE, user.id, user.id, client_ip)
        if user.failed_login_attempts >= self.settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=self.settings.LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
            await self._audit(AuditAction.ACCOUNT_LOCKED, user.id, user.id, client_ip)
        await self.session.commit()

    def _access_token_for(self, user: User, now: datetime) -> str:
        return self.jwt.create_access_token(
            user_id=user.id, role=user.role.value, scope=scope_for(user), now=now
        )

    def _login_response(self, user: User, access_token: str) -> LoginResponse:
        return LoginResponse(
            access_token=access_token,
            expires_in=self.jwt.access_ttl_seconds,
            must_change_password=user.must_change_password,
            must_setup_2fa=not user.is_totp_enabled,
            user_id=user.id,
            role=user.role,
            name=user.name,
        )

    async def login(
        self, req: LoginRequest, client_ip: str | None = None
    ) -> tuple[LoginResponse, str | None]:
        """Handles primary credentials check. Returns (LoginResponse, raw_refresh_token_if_issued)."""
        now = system_clock.now()
        user = await self.user_repo.get_by_email(req.email)

        if not user or not user.is_active:
            burn_password_check(req.password)
            raise AuthenticationError("Credenciais inválidas.")

        # Lockout is checked BEFORE the password, so a locked account rejects even the right one.
        if is_locked(user, now):
            burn_password_check(req.password)
            raise AuthenticationError(LOCKED_MESSAGE, code="account_locked")

        is_valid, new_hash = verify_password(req.password, user.password_hash)
        if not is_valid:
            await self._register_failure(user, now, client_ip)
            raise AuthenticationError("Credenciais inválidas. Verifique o utilizador e a palavra-passe.")

        if new_hash:
            user.password_hash = new_hash

        if user.is_totp_enabled:
            # Password is right, but the account is only cleared after the TOTP code.
            mfa_token = self.jwt.create_mfa_token(user_id=user.id, now=now)
            await self.session.commit()
            return (
                LoginResponse(requires_2fa=True, mfa_token=mfa_token, user_id=user.id),
                None,
            )

        # No 2FA yet → SETUP scope (password change and/or 2FA enrolment only).
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        access_token = self._access_token_for(user, now)
        raw_refresh, _ = await self._issue_refresh_token(user.id, client_ip=client_ip)
        await self._audit(AuditAction.LOGIN_SUCCESS, user.id, user.id, client_ip)
        await self.session.commit()
        return self._login_response(user, access_token), raw_refresh

    async def verify_mfa_login(
        self, req: MfaVerifyRequest, client_ip: str | None = None
    ) -> tuple[LoginResponse, str]:
        """Validates TOTP with the temporary mfa_token and issues access + refresh tokens."""
        now = system_clock.now()
        claims = self.jwt.decode(req.mfa_token, expected=TokenType.MFA)
        user = await self.user_repo.get_by_id(claims.subject)
        if not user or not user.is_active or not user.is_totp_enabled or not user.totp_secret_enc:
            raise AuthenticationError("Utilizador inválido.")

        if is_locked(user, now):
            raise AuthenticationError(LOCKED_MESSAGE, code="account_locked")

        secret = self.totp.decrypt(user.totp_secret_enc)
        matched_step = self.totp.verify(secret, req.code, now, user.totp_last_step)
        if matched_step is None:
            await self._register_failure(user, now, client_ip)
            raise AuthenticationError("Código de autenticação inválido ou expirado.")

        user.totp_last_step = matched_step
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now

        access_token = self._access_token_for(user, now)
        raw_refresh, _ = await self._issue_refresh_token(user.id, client_ip=client_ip)
        await self._audit(AuditAction.LOGIN_SUCCESS, user.id, user.id, client_ip)
        await self.session.commit()
        return self._login_response(user, access_token), raw_refresh

    async def _issue_refresh_token(
        self, user_id: str, family_id: str | None = None, client_ip: str | None = None
    ) -> tuple[str, RefreshToken]:
        now = system_clock.now()
        raw_token = generate_refresh_token()
        record = RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_token),
            family_id=family_id or str(uuid.uuid4()),
            expires_at=now + timedelta(days=self.settings.REFRESH_TOKEN_EXPIRE_DAYS),
            created_ip=client_ip,
        )
        await self.refresh_repo.add(record)
        return raw_token, record

    async def refresh_access_token(
        self, raw_refresh_token: str, client_ip: str | None = None
    ) -> tuple[RefreshResponse, str]:
        """Rotates refresh token. Detects token reuse to prevent replay attacks."""
        now = system_clock.now()
        record = await self.refresh_repo.get_by_hash(hash_refresh_token(raw_refresh_token))

        if not record:
            raise TokenError("Token de atualização inválido.")

        if record.revoked_at is not None:
            # Token reuse detected! Potential breach: revoke the whole family immediately.
            await self.refresh_repo.revoke_family(record.family_id, revoked_at=now)
            await self._audit(AuditAction.REFRESH_REUSE, record.user_id, record.user_id, client_ip)
            await self.session.commit()
            raise TokenError("Violação de segurança detectada. Sessão terminada.")

        expires_at = as_utc(record.expires_at)
        if expires_at is None or expires_at < now:
            raise TokenError("Sessão expirada. Efetue novo login.")

        user = await self.user_repo.get_by_id(record.user_id)
        if not user or not user.is_active:
            raise AuthenticationError("Utilizador inativo.")

        record.revoked_at = now
        new_access = self._access_token_for(user, now)
        new_refresh, _ = await self._issue_refresh_token(
            user.id, family_id=record.family_id, client_ip=client_ip
        )
        await self.session.commit()
        return (
            RefreshResponse(access_token=new_access, expires_in=self.jwt.access_ttl_seconds),
            new_refresh,
        )

    def issue_keepalive_token(self, user: User) -> RefreshResponse:
        """Issues a fresh access token for an active authenticated session."""
        now = system_clock.now()
        new_access = self._access_token_for(user, now)
        return RefreshResponse(
            access_token=new_access,
            expires_in=self.jwt.access_ttl_seconds,
        )

    async def logout(self, raw_refresh_token: str | None, client_ip: str | None = None) -> None:
        """Revokes the server-side session (whole refresh family), not just the cookie."""
        if not raw_refresh_token:
            return
        record = await self.refresh_repo.get_by_hash(hash_refresh_token(raw_refresh_token))
        if not record:
            return
        await self.refresh_repo.revoke_family(record.family_id, revoked_at=system_clock.now())
        await self._audit(AuditAction.LOGOUT, record.user_id, record.user_id, client_ip)
        await self.session.commit()

    async def setup_2fa(self, user: User) -> TwoFASetupResponse:
        """Generates a pending secret and QR Code. Only allowed while 2FA is not active yet."""
        if user.is_totp_enabled:
            raise Conflict(
                "O 2FA já está ativo. Para trocar de dispositivo peça à Direção para repor o 2FA.",
                code="mfa_already_enabled",
            )
        secret = self.totp.generate_secret()
        user.totp_secret_enc = self.totp.encrypt(secret)
        user.totp_last_step = None
        await self.session.commit()

        uri = self.totp.provisioning_uri(secret, user.email)
        return TwoFASetupResponse(secret=secret, qr_svg_data_uri=self.totp.qr_svg_data_uri(uri))

    async def verify_and_enable_2fa(
        self, user: User, code: str, client_ip: str | None = None
    ) -> tuple[LoginResponse, str]:
        """Confirms the first code, activates 2FA and issues a fresh session with the new scope."""
        if user.is_totp_enabled:
            raise Conflict("O 2FA já está ativo.", code="mfa_already_enabled")
        if not user.totp_secret_enc:
            raise BusinessRuleViolation("Configuração de 2FA não iniciada.")

        now = system_clock.now()
        secret = self.totp.decrypt(user.totp_secret_enc)
        step = self.totp.verify(secret, code, now, last_used_step=None)
        if step is None:
            raise BusinessRuleViolation("Código 2FA incorreto ou expirado.", code="invalid_mfa_code")

        user.is_totp_enabled = True
        user.totp_last_step = step
        await self.refresh_repo.revoke_all_for_user(user.id, revoked_at=now)
        access_token = self._access_token_for(user, now)
        raw_refresh, _ = await self._issue_refresh_token(user.id, client_ip=client_ip)
        await self._audit(AuditAction.MFA_ENABLED, user.id, user.id, client_ip)
        await self.session.commit()
        return self._login_response(user, access_token), raw_refresh

    async def change_password(
        self, user: User, req: ChangePasswordRequest, client_ip: str | None = None
    ) -> tuple[LoginResponse, str]:
        """Changes the password (full policy), ends other sessions and issues a fresh one."""
        is_valid, _ = verify_password(req.current_password, user.password_hash)
        if not is_valid:
            raise AuthenticationError("Palavra-passe atual incorreta.")

        validate_password_policy(req.new_password)
        same, _ = verify_password(req.new_password, user.password_hash)
        if same:
            raise BusinessRuleViolation(
                "A nova palavra-passe tem de ser diferente da atual.", code="password_reused"
            )

        now = system_clock.now()
        user.password_hash = hash_password(req.new_password)
        user.must_change_password = False
        user.failed_login_attempts = 0
        user.locked_until = None
        await self.refresh_repo.revoke_all_for_user(user.id, revoked_at=now)
        access_token = self._access_token_for(user, now)
        raw_refresh, _ = await self._issue_refresh_token(user.id, client_ip=client_ip)
        await self._audit(AuditAction.PASSWORD_CHANGED, user.id, user.id, client_ip)
        await self.session.commit()
        return self._login_response(user, access_token), raw_refresh
