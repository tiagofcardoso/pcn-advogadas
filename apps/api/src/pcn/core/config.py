"""Application settings (12-factor). Loaded once from environment / `.env` and validated at boot."""

from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Environment = Literal["development", "test", "staging", "production"]


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
    SECRET_KEY: SecretStr = Field(default=SecretStr("pcn-advogadas-production-secret-key-change-in-env-2026"))
    TOTP_ENCRYPTION_KEY: SecretStr = Field(default=SecretStr("NDYZDO9Io4twjlkZpCtwH35G18sTELmwdb_CcasI7Kc="))
    JWT_ALGORITHM: Literal["HS256", "HS384", "HS512"] = "HS256"
    JWT_ISSUER: str = "pcn-advogadas-api"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, ge=1, le=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, ge=1, le=30)
    MFA_TOKEN_EXPIRE_MINUTES: int = Field(default=5, ge=1, le=10)
    TOTP_ISSUER: str = "PCN Advogadas"
    MAX_LOGIN_ATTEMPTS: int = Field(default=5, ge=3, le=20)
    LOCKOUT_MINUTES: int = Field(default=15, ge=1, le=1440)
    RATE_LIMIT_ENABLED: bool = True
    AUTH_RATE_LIMIT: str = "5/minute"
    REFRESH_COOKIE_NAME: str = "pcn_refresh"
    COOKIE_SECURE: bool = True

    # ── HTTP ──
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = []

    # ── Fee notes (Portuguese fiscal parameters — confirm with accountant) ──
    DEFAULT_VAT_RATE: Decimal = Field(default=Decimal("0.23"), ge=0, le=1)
    DEFAULT_WITHHOLDING_RATE: Decimal = Field(default=Decimal("0.23"), ge=0, le=1)
    FEE_NOTE_PREFIX: str = Field(default="NH", pattern=r"^[A-Z]{1,6}$")
    LOGO_PATH: str | None = None

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

    @field_validator("SECRET_KEY")
    @classmethod
    def _strong_secret(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if len(raw) < 32 or "CHANGE_ME" in raw:
            raise ValueError("SECRET_KEY must be a random value with at least 32 characters.")
        return value

    @field_validator("LOGO_PATH", mode="before")
    @classmethod
    def _empty_to_none(cls, value: object) -> object:
        return value or None

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    """Singleton accessor — settings are parsed once per process."""
    return Settings()  # type: ignore[call-arg]  # values come from the environment
