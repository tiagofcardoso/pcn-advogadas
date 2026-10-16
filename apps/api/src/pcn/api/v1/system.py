"""System management endpoints."""

from fastapi import APIRouter, Depends

from pcn.api.deps import get_current_active_user
from pcn.models.user import User
from pcn.seed import clear_demo_data

router = APIRouter(prefix="/system", tags=["Sistema"])


@router.post("/clear-demo-data")
async def clear_database_demo_data(
    current_user: User = Depends(get_current_active_user),
) -> dict[str, str]:
    """Elimina tarefas, clientes e notas de demonstração, deixando o quadro limpo para uso real."""
    await clear_demo_data()
    return {
        "status": "success",
        "message": "Base de dados limpa com sucesso. Clientes e tarefas de teste foram eliminados.",
    }
