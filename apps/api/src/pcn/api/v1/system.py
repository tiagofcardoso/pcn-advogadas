"""System management endpoints (never exposed in production)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from pcn.api.deps import require_master
from pcn.models.user import User
from pcn.seed import clear_demo_data

router = APIRouter(prefix="/system", tags=["Sistema"])


@router.post("/clear-demo-data")
async def clear_database_demo_data(
    _master: Annotated[User, Depends(require_master)],
) -> dict[str, str]:
    """Elimina tarefas, clientes e notas de demonstração (apenas fora de produção, apenas TI)."""
    await clear_demo_data()
    return {
        "status": "success",
        "message": "Base de dados limpa com sucesso. Clientes e tarefas de teste foram eliminados.",
    }
