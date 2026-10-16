"""Pydantic schemas for Fee Notes (Notas de Honorários)."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from pcn.domain.enums import FeeNoteStatus
from pcn.schemas.client import ClientRead


class FeeNoteItemCreate(BaseModel):
    task_id: str | None = None
    date: datetime
    description: str = Field(min_length=2, max_length=500)
    lawyer_name: str | None = None
    duration_seconds: int = 0
    amount: Decimal = Field(ge=0)


class FeeNoteItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    fee_note_id: str
    task_id: str | None = None
    date: datetime
    description: str
    lawyer_name: str | None = None
    duration_seconds: int
    amount: Decimal
    position: int


class FeeNoteCreate(BaseModel):
    client_id: str
    notes: str | None = None
    vat_rate: Decimal | None = None
    withholding_rate: Decimal | None = None
    task_ids: list[str] = Field(default_factory=list)


class FeeNoteUpdate(BaseModel):
    notes: str | None = None
    status: FeeNoteStatus | None = None
    vat_rate: Decimal | None = None
    withholding_rate: Decimal | None = None


class FeeNotePriceItemRequest(BaseModel):
    task_id: str
    amount: Decimal = Field(ge=0)


class FeeNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    reference_code: str
    status: FeeNoteStatus
    subtotal: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    withholding_rate: Decimal
    withholding_amount: Decimal
    total: Decimal
    issued_at: datetime | None = None
    paid_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    client: ClientRead | None = None
    items: list[FeeNoteItemRead] = Field(default_factory=list)


class UnbilledTaskItem(BaseModel):
    id: str
    completed_at: datetime | None = None
    title: str
    description: str | None = None
    task_type_name: str
    lawyer_name: str
    total_duration_seconds: int
    fee_amount: Decimal | None = None
