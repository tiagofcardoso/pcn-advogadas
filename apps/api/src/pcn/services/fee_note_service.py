"""Fee Note (Nota de Honorários) management service (Exclusive to Patrícia / Admin)."""

import io
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.clock import system_clock
from pcn.core.config import Settings, get_settings
from pcn.core.errors import BusinessRuleViolation, NotFound, PermissionDenied
from pcn.domain.enums import AuditAction, FeeNoteStatus, UserRole
from pcn.domain.fees import compute_totals
from pcn.exporters.fee_note_xlsx import FeeNoteExcelBuilder
from pcn.models.audit_log import AuditLog
from pcn.models.fee_note import FeeNote, FeeNoteItem
from pcn.models.user import User
from pcn.repositories.client_repository import ClientRepository
from pcn.repositories.fee_note_repository import FeeNoteItemRepository, FeeNoteRepository
from pcn.repositories.task_repository import TaskRepository
from pcn.schemas.fee_note import FeeNoteCreate, FeeNotePriceItemRequest, UnbilledTaskItem


class FeeNoteService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.fee_note_repo = FeeNoteRepository(session)
        self.item_repo = FeeNoteItemRepository(session)
        self.task_repo = TaskRepository(session)
        self.client_repo = ClientRepository(session)

    def _verify_admin(self, user: User) -> None:
        if user.role != UserRole.ADMIN:
            raise PermissionDenied("Acesso exclusivo à Direção (Dr.ª Patrícia).")

    async def _audit(
        self, action: AuditAction, actor_id: str, note_id: str, meta: str | None = None
    ) -> None:
        self.session.add(
            AuditLog(
                actor_id=actor_id,
                action=action,
                entity="fee_note",
                entity_id=note_id,
                metadata_json=meta,
            )
        )

    async def list_unbilled_tasks(self, user: User, client_id: str) -> list[UnbilledTaskItem]:
        """Lists completed, unbilled tasks for a client, showing time spent ready for pricing."""
        self._verify_admin(user)
        tasks = await self.task_repo.list_unbilled_completed_tasks(client_id)
        return [
            UnbilledTaskItem(
                id=t.id,
                completed_at=t.completed_at,
                title=t.title,
                description=t.description,
                task_type_name=t.task_type.name if t.task_type else "Geral",
                lawyer_name=t.assignee.name if t.assignee else "Não atribuído",
                total_duration_seconds=t.total_duration_seconds,
                fee_amount=Decimal(str(t.fee_amount)) if t.fee_amount is not None else None,
            )
            for t in tasks
        ]

    async def list_fee_notes(self, user: User, client_id: str | None = None) -> list[FeeNote]:
        self._verify_admin(user)
        notes = await self.fee_note_repo.list_by_client(client_id)
        return list(notes)

    async def create_draft(self, user: User, data: FeeNoteCreate) -> FeeNote:
        """Creates or updates a fee note draft with selected tasks and prices."""
        from sqlalchemy import delete

        self._verify_admin(user)
        client = await self.client_repo.get_by_id_or_name(data.client_id)
        if not client:
            raise NotFound("Cliente não encontrado.")

        vat_rate = data.vat_rate if data.vat_rate is not None else self.settings.DEFAULT_VAT_RATE
        withholding_rate = (
            data.withholding_rate
            if data.withholding_rate is not None
            else self.settings.DEFAULT_WITHHOLDING_RATE
        )

        existing = await self.fee_note_repo.get_latest_by_client(client.id)
        if existing and existing.status == FeeNoteStatus.DRAFT:
            fee_note = existing
            fee_note.vat_rate = vat_rate
            fee_note.withholding_rate = withholding_rate
            if data.notes is not None:
                fee_note.notes = data.notes
            await self.session.execute(
                delete(FeeNoteItem).where(FeeNoteItem.fee_note_id == fee_note.id)
            )
            await self.session.flush()
        else:
            ref_code = await self.fee_note_repo.next_reference_code(self.settings.FEE_NOTE_PREFIX)
            fee_note = FeeNote(
                client_id=client.id,
                reference_code=ref_code,
                status=FeeNoteStatus.DRAFT,
                vat_rate=vat_rate,
                withholding_rate=withholding_rate,
                notes=data.notes,
            )
            await self.fee_note_repo.add(fee_note)
            await self.session.flush()

        # Resolve tasks to include in the fee note
        if data.task_ids:
            tasks_to_bill = []
            for t_id in data.task_ids:
                t = await self.task_repo.get_by_id_with_relations(t_id)
                if t and t.client_id == client.id:
                    tasks_to_bill.append(t)
        else:
            tasks_to_bill = list(await self.task_repo.list_direction_tasks(client_id=client.id))

        # Add tasks as snapshot items and persist fee_amount on each Task
        item_amounts: list[Decimal] = []
        for pos, task in enumerate(tasks_to_bill, start=1):
            if data.task_prices and task.id in data.task_prices:
                amount = Decimal(str(data.task_prices[task.id]))
                task.fee_amount = float(amount)
            elif task.fee_amount is not None:
                amount = Decimal(str(task.fee_amount))
            else:
                amount = Decimal("0.00")

            item_amounts.append(amount)

            item = FeeNoteItem(
                fee_note_id=fee_note.id,
                task_id=task.id,
                date=task.completed_at or task.updated_at or system_clock.now(),
                description=f"{task.title}{' — ' + task.description if task.description else ''}",
                lawyer_name=task.assignee.name if task.assignee else None,
                duration_seconds=task.total_duration_seconds,
                amount=amount,
                position=pos,
            )
            await self.item_repo.add(item)
            task.fee_note_id = fee_note.id

        totals = compute_totals(item_amounts, vat_rate=vat_rate, withholding_rate=withholding_rate)
        fee_note.subtotal = totals.subtotal
        fee_note.vat_amount = totals.vat_amount
        fee_note.withholding_amount = totals.withholding_amount
        fee_note.total = totals.total

        await self._audit(AuditAction.TASK_TRANSITION, user.id, fee_note.id, "Draft saved/updated")
        await self.session.commit()
        self.session.expire_all()
        return await self.fee_note_repo.get_with_items(fee_note.id)  # type: ignore[return-value]

    async def update_item_price(
        self, user: User, note_id: str, data: FeeNotePriceItemRequest
    ) -> FeeNote:
        """Patrícia enters or edits the price for an individual task item in the draft."""
        self._verify_admin(user)
        fee_note = await self.fee_note_repo.get_with_items(note_id)
        if not fee_note:
            fee_note = await self.fee_note_repo.get_latest_by_client(note_id)
        if not fee_note:
            raise NotFound("Nota de honorários não encontrada.")

        if fee_note.status != FeeNoteStatus.DRAFT:
            raise BusinessRuleViolation("Não é possível alterar valores de uma nota já emitida.")

        # Also update on task record for reference
        task = await self.task_repo.get_by_id_with_relations(data.task_id)
        if task:
            task.fee_amount = float(data.amount)

        # Find item matching task_id, or add it if missing
        target_item = next((it for it in fee_note.items if it.task_id == data.task_id), None)
        if target_item:
            target_item.amount = data.amount
            if task:
                target_item.duration_seconds = task.total_duration_seconds
                target_item.lawyer_name = task.assignee.name if task.assignee else None
        elif task:
            target_item = FeeNoteItem(
                fee_note_id=fee_note.id,
                task_id=task.id,
                date=task.completed_at or task.updated_at or system_clock.now(),
                description=f"{task.title}{' — ' + task.description if task.description else ''}",
                lawyer_name=task.assignee.name if task.assignee else None,
                duration_seconds=task.total_duration_seconds,
                amount=data.amount,
                position=len(fee_note.items) + 1,
            )
            await self.item_repo.add(target_item)
            fee_note.items.append(target_item)
            task.fee_note_id = fee_note.id
        else:
            raise NotFound("Item não encontrado nesta nota.")

        # Recalculate totals
        item_amounts = [Decimal(str(it.amount)) for it in fee_note.items]
        totals = compute_totals(
            item_amounts,
            vat_rate=fee_note.vat_rate,
            withholding_rate=fee_note.withholding_rate,
        )
        fee_note.subtotal = totals.subtotal
        fee_note.vat_amount = totals.vat_amount
        fee_note.withholding_amount = totals.withholding_amount
        fee_note.total = totals.total

        await self.session.commit()
        return fee_note

    async def issue_fee_note(self, user: User, note_id: str) -> FeeNote:
        """Finalizes the fee note into an official issued document."""
        self._verify_admin(user)
        fee_note = await self.fee_note_repo.get_with_items(note_id)
        if not fee_note:
            raise NotFound("Nota de honorários não encontrada.")

        if fee_note.status != FeeNoteStatus.DRAFT:
            raise BusinessRuleViolation("A nota já foi emitida.")

        now = system_clock.now()
        fee_note.status = FeeNoteStatus.ISSUED
        fee_note.issued_at = now

        await self._audit(AuditAction.FEE_NOTE_ISSUED, user.id, fee_note.id)
        await self.session.commit()
        return fee_note

    async def mark_as_paid(self, user: User, note_id: str) -> FeeNote:
        self._verify_admin(user)
        fee_note = await self.fee_note_repo.get_with_items(note_id)
        if not fee_note:
            raise NotFound("Nota de honorários não encontrada.")

        fee_note.status = FeeNoteStatus.PAID
        fee_note.paid_at = system_clock.now()
        await self._audit(AuditAction.FEE_NOTE_PAID, user.id, fee_note.id)
        await self.session.commit()
        return fee_note

    async def export_excel(
        self, user: User, note_id: str, include_internal_metrics: bool = False
    ) -> tuple[io.BytesIO, str]:
        """Generates the styled Excel file using FeeNoteExcelBuilder."""
        self._verify_admin(user)
        fee_note = await self.fee_note_repo.get_with_items(note_id)
        if not fee_note:
            fee_note = await self.fee_note_repo.get_latest_by_client(note_id)

        if not fee_note:
            # Fallback: if note_id is a client_id or a default reference like NH-2026-0001, auto-create draft
            client = await self.client_repo.get_by_id_or_name(note_id)
            if not client:
                all_clients = await self.client_repo.list_all(limit=1)
                client = all_clients[0] if all_clients else None
            if client:
                fee_note = await self.create_draft(user, FeeNoteCreate(client_id=client.id))

        if not fee_note:
            raise NotFound("Nota de honorários não encontrada.")

        items_payload = [
            {
                "date": it.date,
                "description": it.description,
                "lawyer_name": it.lawyer_name,
                "duration_seconds": it.duration_seconds,
                "amount": it.amount,
            }
            for it in fee_note.items
        ]

        buffer = FeeNoteExcelBuilder.build(
            reference_code=fee_note.reference_code,
            issued_at=fee_note.issued_at or system_clock.now(),
            client_name=fee_note.client.name,
            client_nif=fee_note.client.nif,
            client_process_ref=fee_note.client.process_reference,
            items=items_payload,
            subtotal=fee_note.subtotal,
            vat_rate=fee_note.vat_rate,
            vat_amount=fee_note.vat_amount,
            withholding_rate=fee_note.withholding_rate,
            withholding_amount=fee_note.withholding_amount,
            total=fee_note.total,
            notes=fee_note.notes,
            include_internal_metrics=include_internal_metrics,
            logo_path=self.settings.LOGO_PATH,
        )

        filename = f"PCN_Nota_Honorarios_{fee_note.reference_code}.xlsx"
        await self._audit(
            AuditAction.FEE_NOTE_EXPORTED,
            user.id,
            fee_note.id,
            f"internal={include_internal_metrics}",
        )
        await self.session.commit()
        return buffer, filename
