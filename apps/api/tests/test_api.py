"""Comprehensive test suite for PCN Advogadas API."""

from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient

from pcn.domain.deadlines import calculate_judicial_deadline
from pcn.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_healthcheck():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/healthz")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "online"
        assert data["app"] == "PCN Advogadas"
        # Public probe must not leak internals.
        assert "traceback" not in res.text
        assert "users_count" not in res.text


def test_judicial_deadlines_portugal_cpc():
    """Testa a suspensão de férias judiciais de verão (16 jul a 31 ago)."""
    # Prazo de 10 dias iniciado a 10 de julho (notificação a 10 de julho):
    # Dia 1: 11 jul
    # Dia 2: 12 jul
    # Dia 3: 13 jul
    # Dia 4: 14 jul
    # Dia 5: 15 jul
    # 16 jul a 31 ago: SUSPENSO (47 dias de férias judiciais)
    # Dia 6: 1 set
    # Dia 7: 2 set
    # Dia 8: 3 set
    # Dia 9: 4 set
    # Dia 10: 5 set
    res = calculate_judicial_deadline(start_date=date(2026, 7, 10), days=10, is_urgent=False)
    assert res.suspended_vacation_days == 47
    assert res.days_count == 10
    assert res.final_deadline >= date(2026, 9, 5)


@pytest.mark.asyncio
async def test_judicial_deadlines_api_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "start_date": "2026-07-10",
            "days": 10,
            "is_urgent": False,
        }
        # First authenticate or verify that public calculation or protected calculation works
        # Note: In deps.py, calculate-deadline requires require_full_access. Let's test the domain function and full auth workflow.
