"""Metrics and reporting endpoints."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import require_admin
from pcn.core.database import get_session
from pcn.models.user import User
from pcn.schemas.metrics import MetricsFilterRequest, MetricsSummaryResponse
from pcn.services.metrics_service import MetricsService

router = APIRouter(prefix="/metrics", tags=["Relatórios e Métricas"])


@router.get("/summary", response_model=MetricsSummaryResponse)
async def get_metrics_summary(
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
    q: str | None = Query(None, description="Pesquisa de termo (ex: 'negativa')"),
    task_type_id: str | None = None,
    lawyer_id: str | None = None,
    client_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> MetricsSummaryResponse:
    """Painel de métricas agregadas por tipo de tarefa e advogada, com suporte a pesquisa parcial."""
    filters = MetricsFilterRequest(
        query=q,
        task_type_id=task_type_id,
        lawyer_id=lawyer_id,
        client_id=client_id,
        start_date=start_date,
        end_date=end_date,
    )
    metric_svc = MetricsService(session)
    return await metric_svc.get_summary(filters)
