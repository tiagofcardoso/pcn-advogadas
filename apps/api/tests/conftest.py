"""Pytest configuration: isolated throw-away database and test-only secrets.

Environment variables are set BEFORE importing the app, so tests never touch the
developer's local database or real secrets from `.env`.
"""

import os
import secrets
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet

_TEST_DB = Path(tempfile.mkdtemp(prefix="pcn-tests-")) / "test.db"
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": f"sqlite+aiosqlite:///{_TEST_DB.as_posix()}",
        "SECRET_KEY": secrets.token_hex(32),
        "TOTP_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "BACKEND_CORS_ORIGINS": "http://localhost:3000",
        "AUTH_RATE_LIMIT": "10000/minute",
        "MASTER_EMAILS": "tiagofabriciocardoso@gmail.com",
    }
)

import pytest  # noqa: E402

from pcn.core.database import get_session_factory  # noqa: E402
from pcn.models.base import Base  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
async def init_test_database():
    session_factory = get_session_factory()
    engine = session_factory.kw["bind"]
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()
