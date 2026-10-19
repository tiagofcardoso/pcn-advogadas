"""API v1 master router."""

from fastapi import APIRouter

from pcn.api.v1.agenda import router as agenda_router
from pcn.api.v1.auth import router as auth_router
from pcn.api.v1.clients import router as clients_router
from pcn.api.v1.fee_notes import router as fee_notes_router
from pcn.api.v1.metrics import router as metrics_router
from pcn.api.v1.system import router as system_router
from pcn.api.v1.tasks import router as tasks_router
from pcn.api.v1.timer import router as timer_router
from pcn.api.v1.users import router as users_router
from pcn.core.config import get_settings

api_v1_router = APIRouter()
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(clients_router)
api_v1_router.include_router(tasks_router)
api_v1_router.include_router(timer_router)
api_v1_router.include_router(fee_notes_router)
api_v1_router.include_router(metrics_router)
api_v1_router.include_router(agenda_router)
if not get_settings().is_production:
    api_v1_router.include_router(system_router)
