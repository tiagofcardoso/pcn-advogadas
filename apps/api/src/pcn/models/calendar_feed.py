"""Shared Google Calendar iCal (.ics) feed configuration stored in DB."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from pcn.models.base import Base, TimestampMixin


class CalendarFeedConfig(Base, TimestampMixin):
    __tablename__ = "calendar_feed_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    ics_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

