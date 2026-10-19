"""Fee Note (Nota de Honorários) endpoints (Exclusive to Patrícia / Admin)."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import require_admin
from pcn.core.database import get_session
from pcn.models.user import User
from pcn.schemas.fee_note import (
    FeeNoteCreate,
    FeeNotePriceItemRequest,
    FeeNoteRead,
    UnbilledTaskItem,
)
from pcn.services.fee_note_service import FeeNoteService

router = APIRouter(prefix="/fee-notes", tags=["Notas de Honorários (Direção)"])


@router.get("", response_model=list[FeeNoteRead])
async def list_fee_notes(
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
    client_id: str | None = None,
) -> list[FeeNoteRead]:
    """Lista as Notas de Honorários guardadas na base de dados (opcionalmente filtradas por cliente)."""
    fee_svc = FeeNoteService(session)
    notes = await fee_svc.list_fee_notes(admin, client_id)
    return [FeeNoteRead.model_validate(n) for n in notes]


@router.get("/unbilled-tasks", response_model=list[UnbilledTaskItem])
async def list_unbilled_tasks(
    client_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[UnbilledTaskItem]:
    """Lista todas as tarefas concluídas de um cliente que ainda não foram faturadas."""
    fee_svc = FeeNoteService(session)
    return await fee_svc.list_unbilled_tasks(admin, client_id)


@router.post("/drafts", response_model=FeeNoteRead, status_code=status.HTTP_201_CREATED)
async def create_draft(
    body: FeeNoteCreate,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FeeNoteRead:
    """Cria ou atualiza um rascunho de Nota de Honorários a partir das tarefas e valores do cliente."""
    fee_svc = FeeNoteService(session)
    note = await fee_svc.create_draft(admin, body)
    return FeeNoteRead.model_validate(note)


@router.get("/{note_id}", response_model=FeeNoteRead)
async def get_fee_note(
    note_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FeeNoteRead:
    fee_svc = FeeNoteService(session)
    note = await fee_svc.fee_note_repo.get_with_items(note_id)
    if not note:
        from pcn.core.errors import NotFound

        raise NotFound("Nota de honorários não encontrada.")
    return FeeNoteRead.model_validate(note)


@router.patch("/{note_id}/price-item", response_model=FeeNoteRead)
async def update_item_price(
    note_id: str,
    body: FeeNotePriceItemRequest,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FeeNoteRead:
    """A Dr.ª Patrícia define ou ajusta o preço (€) de cada tarefa observando os tempos gastos."""
    fee_svc = FeeNoteService(session)
    note = await fee_svc.update_item_price(admin, note_id, body)
    return FeeNoteRead.model_validate(note)


@router.post("/{note_id}/issue", response_model=FeeNoteRead)
async def issue_fee_note(
    note_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FeeNoteRead:
    """Finaliza e emite a Nota de Honorários oficial (tranca valores para envio ao cliente)."""
    fee_svc = FeeNoteService(session)
    note = await fee_svc.issue_fee_note(admin, note_id)
    return FeeNoteRead.model_validate(note)


@router.post("/{note_id}/mark-paid", response_model=FeeNoteRead)
async def mark_fee_note_paid(
    note_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FeeNoteRead:
    fee_svc = FeeNoteService(session)
    note = await fee_svc.mark_as_paid(admin, note_id)
    return FeeNoteRead.model_validate(note)


@router.get("/{note_id}/export-excel")
async def export_excel(
    note_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
    internal: bool = Query(
        False,
        description="Se True, inclui métricas internas de tempo e advogada. Se False, gera versão executiva para o cliente.",
    ),
) -> StreamingResponse:
    """Gera o ficheiro oficial .xlsx com as cores PCN (#92006F & Dourado) e fórmulas vivas."""
    fee_svc = FeeNoteService(session)
    excel_buffer, filename = await fee_svc.export_excel(
        admin, note_id, include_internal_metrics=internal
    )

    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
    headers = {
        "Content-Disposition": f'attachment; filename="{safe_name}"',
        "Access-Control-Expose-Headers": "Content-Disposition",
    }
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
