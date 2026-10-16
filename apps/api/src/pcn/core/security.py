"""Cryptographic primitives: Argon2id hashing, JWT, refresh tokens, TOTP (encrypted at rest)."""

import base64
import hashlib
import hmac
import io
import re
import secrets
import string
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any

import jwt
import pyotp
import qrcode
import qrcode.image.svg
from cryptography.fernet import Fernet, InvalidToken
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from pcn.core.config import Settings
from pcn.core.errors import BusinessRuleViolation, TokenError

# ───────────────────────── Passwords ─────────────────────────

_password_hash = PasswordHash((Argon2Hasher(),))
# Pre-computed hash used to equalise response time when the e-mail does not exist.
_DUMMY_HASH = _password_hash.hash(secrets.token_urlsafe(32))

PASSWORD_MIN_LENGTH = 12
_PASSWORD_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"[a-z]"), "lowercase letter"),
    (re.compile(r"[A-Z]"), "uppercase letter"),
    (re.compile(r"\d"), "digit"),
    (re.compile(r"[^A-Za-z0-9]"), "symbol"),
)


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, hashed: str) -> tuple[bool, str | None]:
    """Returns (valid, new_hash_if_parameters_changed)."""
    return _password_hash.verify_and_update(password, hashed)


def burn_password_check(password: str) -> None:
    """Spend the same CPU time as a real check (anti user-enumeration)."""
    _password_hash.verify(password, _DUMMY_HASH)


def validate_password_policy(password: str) -> None:
    missing = [label for pattern, label in _PASSWORD_RULES if not pattern.search(password)]
    if len(password) < PASSWORD_MIN_LENGTH or missing:
        raise BusinessRuleViolation(
            f"Password must have at least {PASSWORD_MIN_LENGTH} characters and include "
            "lowercase, uppercase, digit and symbol.",
            code="weak_password",
            details={"missing": missing, "min_length": PASSWORD_MIN_LENGTH},
        )


def generate_temporary_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%&*?-_"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        try:
            validate_password_policy(candidate)
        except BusinessRuleViolation:
            continue
        return candidate


# ───────────────────────── JWT ─────────────────────────


class TokenType(StrEnum):
    ACCESS = "access"
    MFA = "mfa"


class TokenScope(StrEnum):
    FULL = "full"
    SETUP = "setup"  # only password change + 2FA enrolment allowed


@dataclass(frozen=True, slots=True)
class TokenClaims:
    subject: str
    token_type: TokenType
    scope: TokenScope | None
    role: str | None


class JwtService:
    def __init__(self, settings: Settings) -> None:
        self._key = settings.SECRET_KEY.get_secret_value()
        self._alg = settings.JWT_ALGORITHM
        self._issuer = settings.JWT_ISSUER
        self._access_ttl = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        self._mfa_ttl = timedelta(minutes=settings.MFA_TOKEN_EXPIRE_MINUTES)

    def _encode(self, claims: dict[str, Any], now: datetime, ttl: timedelta) -> str:
        payload = {
            **claims,
            "iss": self._issuer,
            "iat": int(now.timestamp()),
            "nbf": int(now.timestamp()),
            "exp": int((now + ttl).timestamp()),
            "jti": uuid.uuid4().hex,
        }
        return jwt.encode(payload, self._key, algorithm=self._alg)

    def create_access_token(
        self, *, user_id: str, role: str, scope: TokenScope, now: datetime
    ) -> str:
        claims = {"sub": user_id, "typ": TokenType.ACCESS, "role": role, "scp": scope}
        return self._encode(claims, now, self._access_ttl)

    def create_mfa_token(self, *, user_id: str, now: datetime) -> str:
        return self._encode({"sub": user_id, "typ": TokenType.MFA}, now, self._mfa_ttl)

    @property
    def access_ttl_seconds(self) -> int:
        return int(self._access_ttl.total_seconds())

    def decode(self, token: str, expected: TokenType) -> TokenClaims:
        try:
            payload = jwt.decode(
                token,
                self._key,
                algorithms=[self._alg],  # pinned: prevents alg=none / confusion attacks
                issuer=self._issuer,
                options={"require": ["exp", "iat", "sub", "typ", "iss"]},
            )
        except jwt.PyJWTError as exc:
            raise TokenError() from exc
        if payload.get("typ") != expected:
            raise TokenError()
        scope = payload.get("scp")
        return TokenClaims(
            subject=str(payload["sub"]),
            token_type=expected,
            scope=TokenScope(scope) if scope else None,
            role=payload.get("role"),
        )


# ───────────────────────── Refresh tokens (opaque) ─────────────────────────


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw: str) -> str:
    # High-entropy random token → a fast hash is appropriate (no need for Argon2).
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ───────────────────────── TOTP ─────────────────────────


class TotpService:
    """TOTP with secrets encrypted at rest (Fernet) and replay protection via last-used step."""

    def __init__(self, settings: Settings) -> None:
        try:
            self._fernet = Fernet(settings.TOTP_ENCRYPTION_KEY.get_secret_value().encode())
        except (ValueError, TypeError) as exc:
            raise RuntimeError("TOTP_ENCRYPTION_KEY is not a valid Fernet key.") from exc
        self._issuer = settings.TOTP_ISSUER

    @staticmethod
    def generate_secret() -> str:
        return pyotp.random_base32()

    def encrypt(self, secret: str) -> str:
        return self._fernet.encrypt(secret.encode()).decode()

    def decrypt(self, token: str) -> str:
        try:
            return self._fernet.decrypt(token.encode()).decode()
        except InvalidToken as exc:
            raise RuntimeError("Unable to decrypt TOTP secret (key rotated?).") from exc

    def provisioning_uri(self, secret: str, email: str) -> str:
        return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=self._issuer)

    @staticmethod
    def qr_svg_data_uri(uri: str) -> str:
        image = qrcode.make(uri, image_factory=qrcode.image.svg.SvgPathImage, box_size=10)
        buffer = io.BytesIO()
        image.save(buffer)
        encoded = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/svg+xml;base64,{encoded}"

    @staticmethod
    def verify(secret: str, code: str, now: datetime, last_used_step: int | None) -> int | None:
        """Return the matched time-step (±1 window) or None. Steps <= last_used_step are
        rejected so an intercepted code cannot be replayed."""
        if not (code.isdigit() and len(code) == 6):
            return None
        totp = pyotp.TOTP(secret)
        current = totp.timecode(now)
        for step in (current - 1, current, current + 1):
            if last_used_step is not None and step <= last_used_step:
                continue
            if hmac.compare_digest(totp.generate_otp(step), code):
                return step
        return None
