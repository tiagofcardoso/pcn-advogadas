"""Application settings (12-factor). Loaded once from environment / `.env` and validated at boot."""

from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Literal

from cryptography.fernet import Fernet
from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Environment = Literal["development", "test", "staging", "production"]

# Values that were once committed as defaults. Anyone with repo access knows them.
_LEAKED_SECRETS = frozenset(
    {
        "pcn-advogadas-production-secret-key-change-in-env-2026",
        "NDYZDO9Io4twjlkZpCtwH35G18sTELmwdb_CcasI7Kc=",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Application ──
    PROJECT_NAME: str = "PCN Advogadas"
    ENVIRONMENT: Environment = "production"
    API_V1_PREFIX: str = "/api/v1"

    # ── Database ──
    DATABASE_URL: SecretStr = Field(default=SecretStr("sqlite+aiosqlite:///./pcn_data.db"))
    DB_POOL_SIZE: int = Field(default=10, ge=1, le=50)
    DB_MAX_OVERFLOW: int = Field(default=20, ge=0, le=100)
    DB_POOL_RECYCLE_SECONDS: int = 280  # below typical shared-hosting wait_timeout
    DB_ECHO: bool = False

    # ── Crypto / auth ──
    # No defaults: the app refuses to boot without real secrets in the environment.
    SECRET_KEY: SecretStr
    TOTP_ENCRYPTION_KEY: SecretStr
    JWT_ALGORITHM: Literal["HS256", "HS384", "HS512"] = "HS256"
    JWT_ISSUER: str = "pcn-advogadas-api"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, ge=1, le=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, ge=1, le=30)
    MFA_TOKEN_EXPIRE_MINUTES: int = Field(default=5, ge=1, le=10)
    TOTP_ISSUER: str = "PCN Advogadas"
    MAX_LOGIN_ATTEMPTS: int = Field(default=5, ge=3, le=20)
    LOCKOUT_MINUTES: int = Field(default=15, ge=1, le=1440)
    RATE_LIMIT_ENABLED: bool = True
    AUTH_RATE_LIMIT: str = "30/minute"
    REFRESH_COOKIE_NAME: str = "pcn_refresh"
    COOKIE_SECURE: bool = True
    # Accounts promoted to the Master (IT) role at startup. Promotion only, never demotion.
    MASTER_EMAILS: Annotated[list[str], NoDecode] = ["tiagofabriciocardoso@gmail.com"]

    # ── HTTP ──
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = []

    # ── Fee notes (Portuguese fiscal parameters — confirm with accountant) ──
    DEFAULT_VAT_RATE: Decimal = Field(default=Decimal("0.23"), ge=0, le=1)
    DEFAULT_WITHHOLDING_RATE: Decimal = Field(default=Decimal("0.23"), ge=0, le=1)
    FEE_NOTE_PREFIX: str = Field(default="NH", pattern=r"^[A-Z]{1,6}$")
    LOGO_PATH: str | None = None

    # ── Email / Alert Notifications ──
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "notificacoes@pcnadvogadas.pt"
    RESEND_API_KEY: str | None = None

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("BACKEND_CORS_ORIGINS")
    @classmethod
    def _forbid_wildcard(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("Wildcard CORS origin is not allowed (credentials are used).")
        return value

    @field_validator("MASTER_EMAILS", mode="before")
    @classmethod
    def _split_emails(cls, value: object) -> object:
        if isinstance(value, str):
            return [e.strip().lower() for e in value.split(",") if e.strip()]
        return value

    @field_validator("SECRET_KEY")
    @classmethod
    def _strong_secret(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if len(raw) < 32 or "CHANGE_ME" in raw or raw in _LEAKED_SECRETS:
            raise ValueError("SECRET_KEY must be a new random value with at least 32 characters.")
        return value

    @field_validator("TOTP_ENCRYPTION_KEY")
    @classmethod
    def _valid_fernet_key(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if raw in _LEAKED_SECRETS:
            raise ValueError("TOTP_ENCRYPTION_KEY was published in git history; generate a new one.")
        try:
            Fernet(raw.encode("utf-8"))
        except (ValueError, TypeError) as exc:
            raise ValueError(
                "TOTP_ENCRYPTION_KEY must be a Fernet key "
                "(python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")."
            ) from exc
        return value

    @field_validator("LOGO_PATH", mode="before")
    @classmethod
    def _empty_to_none(cls, value: object) -> object:
        return value or None

    @model_validator(mode="after")
    def _production_requires_cors(self) -> "Settings":
        if self.ENVIRONMENT == "production" and not self.BACKEND_CORS_ORIGINS:
            raise ValueError("BACKEND_CORS_ORIGINS must list the frontend URL(s) in production.")
        return self

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    """Singleton accessor — settings are parsed once per process."""
    return Settings()  # type: ignore[call-arg]  # values come from the environment
