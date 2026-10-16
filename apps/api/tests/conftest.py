"""Pytest configuration and database initialization fixture."""

import pytest

from pcn.core.database import get_session_factory
from pcn.models.base import Base


@pytest.fixture(autouse=True)
async def init_test_database():
    session_factory = get_session_factory()
    engine = session_factory.kw["bind"]
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
