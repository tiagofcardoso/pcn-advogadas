"""Task redistribution notices (shared across users, acknowledged individually)."""

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from pcn.models.base import Base, generate_uuid, utc_now


class TaskRedistributionNotice(Base):
    __tablename__ = "task_redistribution_notices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    task_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    task_title: Mapped[str] = mapped_column(String(300), nullable=False)
    client_name: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    from_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    from_user_name: Mapped[str] = mapped_column(String(200), nullable=False)
    to_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    to_user_name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    role_in_change: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

