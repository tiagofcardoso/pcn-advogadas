"""Client and TaskType ORM models."""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pcn.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from pcn.models.fee_note import FeeNote
    from pcn.models.task import Task


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    nif: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(191), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    process_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="client")
    fee_notes: Mapped[list["FeeNote"]] = relationship("FeeNote", back_populates="client")


class TaskType(Base, TimestampMixin):
    __tablename__ = "task_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    default_billable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#92006F", nullable=False)

    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="task_type")
