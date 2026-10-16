"""Task ORM model."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pcn.domain.enums import TaskStatus
from pcn.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from pcn.models.client import Client, TaskType
    from pcn.models.fee_note import FeeNote
    from pcn.models.task_time_session import TaskTimeSession
    from pcn.models.user import User


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    client_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    task_type_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_types.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, native_enum=False, length=30),
        default=TaskStatus.BACKLOG,
        nullable=False,
        index=True,
    )

    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    assigned_to: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    is_urgent_deadline: Mapped[bool] = mapped_column(default=False, nullable=False)

    total_duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fee_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    fee_note_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("fee_notes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Optimistic locking version
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    client: Mapped["Client"] = relationship("Client", back_populates="tasks")
    task_type: Mapped["TaskType"] = relationship("TaskType", back_populates="tasks")
    assignee: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[assigned_to], back_populates="assigned_tasks"
    )
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    fee_note: Mapped[Optional["FeeNote"]] = relationship("FeeNote", back_populates="tasks")
    time_sessions: Mapped[list["TaskTimeSession"]] = relationship(
        "TaskTimeSession", back_populates="task", cascade="all, delete-orphan"
    )


# Índices para pesquisa textual e filtragem de quadros
Index("idx_tasks_status_assigned", Task.status, Task.assigned_to)
Index("idx_tasks_client_completed", Task.client_id, Task.completed_at)
