"""Security regression tests: first-login flow, mandatory 2FA, RBAC, lockout, Master role."""

from datetime import UTC, datetime, timedelta

import pyotp
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from pcn.core.database import get_session_factory
from pcn.domain.enums import UserRole
from pcn.main import app
from pcn.models.user import User
from pcn.seed import INITIAL_PASSWORD, run_seed

API = "/api/v1"
NEW_PASSWORD = "Nova-Senha-Segura-2026"
TIAGO = "tiagofabriciocardoso@gmail.com"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _onboard(ac: AsyncClient, email: str, password: str) -> tuple[str, str]:
    """First login → change password → enrol 2FA. Returns (full_token, totp_secret)."""
    res = await ac.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["must_change_password"] is True
    assert body["must_setup_2fa"] is True
    token = body["access_token"]

    res = await ac.post(
        f"{API}/auth/change-password",
        json={"current_password": password, "new_password": NEW_PASSWORD},
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["must_change_password"] is False
    assert body["must_setup_2fa"] is True
    token = body["access_token"]

    res = await ac.post(f"{API}/auth/2fa/setup", headers=_auth(token))
    assert res.status_code == 200, res.text
    secret = res.json()["secret"]

    res = await ac.post(
        f"{API}/auth/2fa/verify", json={"code": pyotp.TOTP(secret).now()}, headers=_auth(token)
    )
    assert res.status_code == 200, res.text
    assert res.json()["must_setup_2fa"] is False
    return res.json()["access_token"], secret


@pytest.fixture(scope="session")
async def office() -> dict[str, dict[str, str]]:
    """Seeded office: Patrícia (admin), Inês (lawyer), Tiago (master), all onboarded."""
    await run_seed()  # creates the lawyers and the Master (IT) account from MASTER_EMAILS
    await run_seed()  # a second boot must be idempotent

    people: dict[str, dict[str, str]] = {}
    async with _client() as ac:
        for key, email in (
            ("patricia", "patricia@pcnadvogadas.pt"),
            ("ines", "ines@pcnadvogadas.pt"),
            ("tiago", TIAGO),
        ):
            token, secret = await _onboard(ac, email, INITIAL_PASSWORD)
            me = (await ac.get(f"{API}/auth/me", headers=_auth(token))).json()
            people[key] = {"token": token, "secret": secret, "id": me["id"], "email": email}

        # Client created by the Direção, used by the task tests.
        res = await ac.post(
            f"{API}/clients", json={"name": "Cliente Teste"}, headers=_auth(people["patricia"]["token"])
        )
        assert res.status_code == 201, res.text
        people["client"] = {"id": res.json()["id"]}
    return people


# ───────────────────────── First login & 2FA ─────────────────────────


async def test_seed_promotes_master_and_keeps_initial_password_change(office):
    async with get_session_factory()() as session:
        tiago = (await session.execute(select(User).where(User.email == TIAGO))).scalar_one()
        assert tiago.role == UserRole.MASTER


async def test_setup_token_cannot_use_the_app():
    async with _client() as ac:
        res = await ac.post(
            f"{API}/auth/login",
            json={"email": "sofia@pcnadvogadas.pt", "password": INITIAL_PASSWORD},
        )
        assert res.status_code == 200
        token = res.json()["access_token"]
        assert res.json()["must_change_password"] is True

        blocked = await ac.get(f"{API}/tasks/boards/me", headers=_auth(token))
        assert blocked.status_code == 403

        weak = await ac.post(
            f"{API}/auth/change-password",
            json={"current_password": INITIAL_PASSWORD, "new_password": "curta"},
            headers=_auth(token),
        )
        assert weak.status_code == 422


async def test_login_after_onboarding_requires_totp(office):
    ines = office["ines"]
    async with _client() as ac:
        res = await ac.post(
            f"{API}/auth/login", json={"email": ines["email"], "password": NEW_PASSWORD}
        )
        body = res.json()
        assert body["requires_2fa"] is True
        assert body["access_token"] is None

        wrong = await ac.post(
            f"{API}/auth/2fa/verify-login", json={"mfa_token": body["mfa_token"], "code": "000000"}
        )
        assert wrong.status_code == 401

        # Next time-step: the enrolment step was already consumed (anti-replay).
        code = pyotp.TOTP(ines["secret"]).at(datetime.now(UTC) + timedelta(seconds=30))
        ok = await ac.post(
            f"{API}/auth/2fa/verify-login", json={"mfa_token": body["mfa_token"], "code": code}
        )
        assert ok.status_code == 200, ok.text
        token = ok.json()["access_token"]
        assert (await ac.get(f"{API}/tasks/boards/me", headers=_auth(token))).status_code == 200

        again = await ac.post(f"{API}/auth/2fa/setup", headers=_auth(token))
        assert again.status_code == 409  # cannot silently replace an active 2FA


# ───────────────────────── Lawyer permissions ─────────────────────────


async def test_lawyer_can_only_create_and_work_on_own_tasks(office):
    ines, patricia = office["ines"], office["patricia"]
    client_id = office["client"]["id"]
    async with _client() as ac:
        own = await ac.post(
            f"{API}/tasks",
            json={"client_id": client_id, "task_type_id": "tp_1", "title": "Tarefa da Inês",
                  "assigned_to": ines["id"]},
            headers=_auth(ines["token"]),
        )
        assert own.status_code == 201, own.text
        own_id = own.json()["id"]
        assert (await ac.post(f"{API}/timer/{own_id}/start", headers=_auth(ines["token"]))).status_code == 200

        other = await ac.post(
            f"{API}/tasks",
            json={"client_id": client_id, "task_type_id": "tp_1", "title": "Tarefa da Patrícia",
                  "assigned_to": patricia["id"]},
            headers=_auth(patricia["token"]),
        )
        other_id = other.json()["id"]

        h = _auth(ines["token"])
        assert (await ac.post(f"{API}/timer/{other_id}/start", headers=h)).status_code == 403
        assert (await ac.patch(f"{API}/tasks/{other_id}", json={"title": "x" * 5}, headers=h)).status_code == 403
        assert (await ac.delete(f"{API}/tasks/{own_id}", headers=h)).status_code == 403
        assert (await ac.post(f"{API}/tasks/{own_id}/archive", headers=h)).status_code == 403
        assert (await ac.post(f"{API}/tasks/{other_id}/notify-overtime", headers=h)).status_code == 403
        assert (await ac.post(f"{API}/clients", json={"name": "Novo"}, headers=h)).status_code == 403
        assert (await ac.get(f"{API}/fee-notes", headers=h)).status_code == 403
        assert (await ac.post(f"{API}/system/clear-demo-data", headers=h)).status_code == 403
        assert (await ac.get(f"{API}/users", headers=h)).status_code == 200  # read stays open

        # Direção keeps full control.
        assert (await ac.delete(f"{API}/tasks/{other_id}", headers=_auth(patricia["token"]))).status_code == 204


# ───────────────────────── Lockout, unlock, suspension ─────────────────────────


async def test_five_wrong_passwords_lock_until_admin_unlocks(office):
    admin = _auth(office["patricia"]["token"])
    async with _client() as ac:
        created = await ac.post(
            f"{API}/users", json={"name": "Advogada Lock", "email": "lock@pcnadvogadas.pt"}, headers=admin
        )
        assert created.status_code == 201
        user_id, temp = created.json()["id"], created.json()["temporary_password"]

        for _ in range(5):
            res = await ac.post(f"{API}/auth/login", json={"email": "lock@pcnadvogadas.pt", "password": "Errada-123456!"})
            assert res.status_code == 401

        locked = await ac.post(f"{API}/auth/login", json={"email": "lock@pcnadvogadas.pt", "password": temp})
        assert locked.status_code == 401
        assert locked.json()["code"] == "account_locked"

        listed = {u["id"]: u for u in (await ac.get(f"{API}/users", headers=admin)).json()}
        assert listed[user_id]["locked_until"] is not None

        assert (await ac.post(f"{API}/users/{user_id}/unlock", headers=admin)).status_code == 200
        ok = await ac.post(f"{API}/auth/login", json={"email": "lock@pcnadvogadas.pt", "password": temp})
        assert ok.status_code == 200
        token = ok.json()["access_token"]

        assert (await ac.patch(f"{API}/users/{user_id}", json={"is_active": False}, headers=admin)).status_code == 200
        assert (await ac.get(f"{API}/auth/me", headers=_auth(token))).status_code == 401
        again = await ac.post(f"{API}/auth/login", json={"email": "lock@pcnadvogadas.pt", "password": temp})
        assert again.status_code == 401


# ───────────────────────── Master (IT) role ─────────────────────────


async def test_master_hierarchy(office):
    patricia, tiago, ines = office["patricia"], office["tiago"], office["ines"]
    async with _client() as ac:
        p = _auth(patricia["token"])
        assert (await ac.patch(f"{API}/users/{tiago['id']}", json={"is_active": False}, headers=p)).status_code == 403
        assert (await ac.patch(f"{API}/users/{ines['id']}", json={"role": "master"}, headers=p)).status_code == 403
        assert (await ac.patch(f"{API}/users/{patricia['id']}", json={"is_active": False}, headers=p)).status_code == 403
        assert (
            await ac.post(f"{API}/users", json={"name": "Outro TI", "email": "ti@x.pt", "role": "master"}, headers=p)
        ).status_code == 403

        t = _auth(tiago["token"])
        assert (await ac.get(f"{API}/fee-notes", headers=t)).status_code == 200
        assert (await ac.patch(f"{API}/users/{patricia['id']}", json={"name": "Dr.ª Patrícia C."}, headers=t)).status_code == 200
        assert (await ac.patch(f"{API}/users/{tiago['id']}", json={"role": "lawyer"}, headers=t)).status_code == 403


# ───────────────────────── Config & transport ─────────────────────────


async def test_cors_rejects_unknown_origin():
    async with _client() as ac:
        res = await ac.options(
            f"{API}/auth/login",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
        )
        assert "access-control-allow-origin" not in {k.lower() for k in res.headers}


def test_leaked_default_secrets_are_rejected():
    from pydantic import ValidationError

    from pcn.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="pcn-advogadas-production-secret-key-change-in-env-2026",
            TOTP_ENCRYPTION_KEY="NDYZDO9Io4twjlkZpCtwH35G18sTELmwdb_CcasI7Kc=",
        )
