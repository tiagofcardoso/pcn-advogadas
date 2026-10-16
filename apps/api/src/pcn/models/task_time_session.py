"""Task time session ORM model (time tracker engine)."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pcn.models.base import Base, generate_uuid, utc_now

if TYPE_CHECKING:
    from pcn.models.task import Task
    from pcn.models.user import User


class TaskTimeSession(Base):
    __tablename__ = "task_time_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Marcador de sessão ativa (1 se ativa, NULL se finalizada)
    # Permite garantir via UNIQUE que um utilizador tem no MÁXIMO UMA sessão a decorrer.
    active_marker: Mapped[int | None] = mapped_column(Integer, nullable=True)

    task: Mapped["Task"] = relationship("Task", back_populates="time_sessions")
    user: Mapped["User"] = relationship("User", back_populates="time_sessions")

    __table_args__ = (
        UniqueConstraint("user_id", "active_marker", name="uq_user_single_active_session"),
        Index("idx_sessions_task_user", "task_id", "user_id"),
    )
