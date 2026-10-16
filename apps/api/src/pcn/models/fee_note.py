"""Fee Note (Nota de Honorários) ORM models."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pcn.domain.enums import FeeNoteStatus
from pcn.models.base import Base, TimestampMixin, generate_uuid, utc_now

if TYPE_CHECKING:
    from pcn.models.client import Client
    from pcn.models.task import Task


class FeeNote(Base, TimestampMixin):
    __tablename__ = "fee_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    client_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    reference_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    status: Mapped[FeeNoteStatus] = mapped_column(
        Enum(FeeNoteStatus, native_enum=False, length=20),
        default=FeeNoteStatus.DRAFT,
        nullable=False,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), default=Decimal("0.2300"), nullable=False
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    withholding_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), default=Decimal("0.2300"), nullable=False
    )
    withholding_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)

    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="fee_notes")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="fee_note")
    items: Mapped[list["FeeNoteItem"]] = relationship(
        "FeeNoteItem",
        back_populates="fee_note",
        cascade="all, delete-orphan",
        order_by="FeeNoteItem.position",
    )


class FeeNoteItem(Base):
    __tablename__ = "fee_note_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    fee_note_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("fee_notes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )

    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    lawyer_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    fee_note: Mapped["FeeNote"] = relationship("FeeNote", back_populates="items")
