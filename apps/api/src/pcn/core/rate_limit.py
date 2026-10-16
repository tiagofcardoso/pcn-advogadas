"""Rate limiter (slowapi). Keyed by client IP — run uvicorn with --proxy-headers behind a proxy."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from pcn.core.config import get_settings

limiter = Limiter(key_func=get_remote_address, headers_enabled=False)


def auth_rate_limit() -> str:
    return get_settings().AUTH_RATE_LIMIT
