"""Authentication Service: Argon2id verification, brute-force lockout, TOTP, and refresh token rotation."""

from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.clock import system_clock
from pcn.core.config import Settings, get_settings
from pcn.core.errors import AuthenticationError, BusinessRuleViolation, TokenError
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

    async def login(
        self, req: LoginRequest, client_ip: str | None = None
    ) -> tuple[LoginResponse, str | None]:
        """Handles primary credentials check. Returns (LoginResponse, raw_refresh_token_if_full_login)."""
        now = system_clock.now()
        user = await self.user_repo.get_by_email(req.email)

        if not user or not user.is_active:
            burn_password_check(req.password)
            raise AuthenticationError("Credenciais inválidas.")

        # Verify password with Argon2
        is_valid, new_hash = verify_password(req.password, user.password_hash)
        if not is_valid:
            if user.locked_until and user.locked_until > now:
                raise AuthenticationError(
                    "Conta temporariamente bloqueada devido a tentativas excessivas. Tente mais tarde."
                )
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= self.settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=self.settings.LOCKOUT_MINUTES)
                await self._audit(AuditAction.ACCOUNT_LOCKED, user.id, user.id, client_ip)
            await self.session.commit()
            raise AuthenticationError("Credenciais inválidas. Verifique o utilizador e a palavra-passe.")

        if new_hash:
            user.password_hash = new_hash

        # Reset failed attempts and any temporary lockout upon valid password
        user.failed_login_attempts = 0
        user.locked_until = None

        # Check if MFA is enabled
        if user.is_totp_enabled:
            # Issue short-lived MFA token (cannot access any regular endpoint)
            mfa_token = self.jwt.create_mfa_token(user_id=user.id, now=now)
            await self.session.commit()
            return (
                LoginResponse(
                    requires_2fa=True,
                    mfa_token=mfa_token,
                    user_id=user.id,
                ),
                None,
            )

        # Full login (or pending mandatory initial setup)
        scope = TokenScope.SETUP if user.must_change_password else TokenScope.FULL
        access_token = self.jwt.create_access_token(
            user_id=user.id, role=user.role.value, scope=scope, now=now
        )

        user.last_login_at = now
        raw_refresh, _ = await self._issue_refresh_token(user.id, client_ip=client_ip)

        await self._audit(AuditAction.LOGIN_SUCCESS, user.id, user.id, client_ip)
        await self.session.commit()

        return (
            LoginResponse(
                access_token=access_token,
                expires_in=self.jwt.access_ttl_seconds,
                must_change_password=user.must_change_password,
                user_id=user.id,
                role=user.role,
                name=user.name,
            ),
            raw_refresh,
        )

    async def verify_mfa_login(
        self, req: MfaVerifyRequest, client_ip: str | None = None
    ) -> tuple[LoginResponse, str]:
        """Validates TOTP with the temporary mfa_token and issues access + refresh tokens."""
        now = system_clock.now()
        claims = self.jwt.decode(req.mfa_token, expected=TokenType.MFA)
        user = await self.user_repo.get_by_id(claims.subject)
        if not user or not user.is_active or not user.totp_secret_enc:
            raise AuthenticationError("Utilizador inválido.")

        secret = self.totp.decrypt(user.totp_secret_enc)
        matched_step = self.totp.verify(secret, req.code, now, user.totp_last_step)
        if matched_step is None:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= self.settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=self.settings.LOCKOUT_MINUTES)
                await self._audit(AuditAction.ACCOUNT_LOCKED, user.id, user.id, client_ip)
            await self.session.commit()
            raise AuthenticationError("Código de autenticação inválido ou expirado.")

        user.totp_last_step = matched_step
        user.failed_login_attempts = 0
        user.last_login_at = now

        scope = TokenScope.SETUP if user.must_change_password else TokenScope.FULL
        access_token = self.jwt.create_access_token(
            user_id=user.id, role=user.role.value, scope=scope, now=now
        )
        raw_refresh, _ = await self._issue_refresh_token(user.id, client_ip=client_ip)

        await self._audit(AuditAction.LOGIN_SUCCESS, user.id, user.id, client_ip)
        await self.session.commit()

        return (
            LoginResponse(
                access_token=access_token,
                expires_in=self.jwt.access_ttl_seconds,
                must_change_password=user.must_change_password,
                user_id=user.id,
                role=user.role,
                name=user.name,
            ),
            raw_refresh,
        )

    async def _issue_refresh_token(
        self, user_id: str, family_id: str | None = None, client_ip: str | None = None
    ) -> tuple[str, RefreshToken]:
        import uuid

        now = system_clock.now()
        raw_token = generate_refresh_token()
        token_hash = hash_refresh_token(raw_token)
        family = family_id or str(uuid.uuid4())
        expires_at = now + timedelta(days=self.settings.REFRESH_TOKEN_EXPIRE_DAYS)

        record = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            family_id=family,
            expires_at=expires_at,
            created_ip=client_ip,
        )
        await self.refresh_repo.add(record)
        return raw_token, record

    async def refresh_access_token(
        self, raw_refresh_token: str, client_ip: str | None = None
    ) -> tuple[RefreshResponse, str]:
        """Rotates refresh token. Detects token reuse to prevent replay attacks."""
        now = system_clock.now()
        token_hash = hash_refresh_token(raw_refresh_token)
        record = await self.refresh_repo.get_by_hash(token_hash)

        if not record:
            raise TokenError("Token de atualização inválido.")

        if record.revoked_at is not None:
            # Token reuse detected! Potential breach: revoke the whole family immediately.
            await self.refresh_repo.revoke_family(record.family_id, revoked_at=now)
            await self._audit(AuditAction.REFRESH_REUSE, record.user_id, record.user_id, client_ip)
            await self.session.commit()
            raise TokenError("Violação de segurança detectada. Sessão terminada.")

        if record.expires_at < now:
            raise TokenError("Sessão expirada. Efetue novo login.")

        # Revoke current token and issue replacement within same family
        record.revoked_at = now
        user = await self.user_repo.get_by_id(record.user_id)
        if not user or not user.is_active:
            raise AuthenticationError("Utilizador inativo.")

        scope = TokenScope.SETUP if user.must_change_password else TokenScope.FULL
        new_access = self.jwt.create_access_token(
            user_id=user.id, role=user.role.value, scope=scope, now=now
        )
        new_refresh, _ = await self._issue_refresh_token(
            user.id, family_id=record.family_id, client_ip=client_ip
        )
        await self.session.commit()

        return (
            RefreshResponse(
                access_token=new_access,
                expires_in=self.jwt.access_ttl_seconds,
            ),
            new_refresh,
        )

    async def setup_2fa(self, user: User) -> TwoFASetupResponse:
        """Generates temporary secret and QR Code for authenticator app."""
        secret = self.totp.generate_secret()
        user.totp_secret_enc = self.totp.encrypt(secret)
        await self.session.commit()

        uri = self.totp.provisioning_uri(secret, user.email)
        svg_data = self.totp.qr_svg_data_uri(uri)
        return TwoFASetupResponse(secret=secret, qr_svg_data_uri=svg_data)

    async def verify_and_enable_2fa(self, user: User, code: str) -> None:
        """Confirms first code to permanently activate 2FA."""
        if not user.totp_secret_enc:
            raise BusinessRuleViolation("Configuração de 2FA não iniciada.")

        now = system_clock.now()
        secret = self.totp.decrypt(user.totp_secret_enc)
        step = self.totp.verify(secret, code, now, last_used_step=None)
        if step is None:
            raise BusinessRuleViolation("Código 2FA incorreto ou expirado.")

        user.is_totp_enabled = True
        user.totp_last_step = step
        await self._audit(AuditAction.MFA_ENABLED, user.id, user.id)
        await self.session.commit()

    async def change_password(self, user: User, req: ChangePasswordRequest) -> None:
        """Changes user password with policy validation."""
        is_valid, _ = verify_password(req.current_password, user.password_hash)
        if not is_valid:
            raise AuthenticationError("Palavra-passe atual incorreta.")

        if len(req.new_password.strip()) < 6:
            raise BusinessRuleViolation(
                "A nova palavra-passe deve conter pelo menos 6 caracteres.",
                code="weak_password",
            )
        user.password_hash = hash_password(req.new_password.strip())
        user.must_change_password = False
        user.failed_login_attempts = 0
        user.locked_until = None
        await self._audit(AuditAction.PASSWORD_CHANGED, user.id, user.id)
        await self.session.commit()
