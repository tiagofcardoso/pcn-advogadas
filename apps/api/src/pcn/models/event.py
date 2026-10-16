"""Event model for Agenda, Court hearings (Audiências), Deadlines (Prazos), and Meetings."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pcn.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from pcn.models.client import Client
    from pcn.models.task import Task
    from pcn.models.user import User


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_deadline: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_urgent_judicial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner: Mapped["User"] = relationship("User")
    client: Mapped[Optional["Client"]] = relationship("Client")
    task: Mapped[Optional["Task"]] = relationship("Task")


Index("idx_events_owner_starts", Event.owner_id, Event.starts_at)
