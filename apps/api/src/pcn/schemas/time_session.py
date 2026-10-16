"""Pydantic schemas for Time Tracking sessions."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActiveTimerResponse(BaseModel):
    is_active: bool
    task_id: str | None = None
    task_title: str | None = None
    client_name: str | None = None
    started_at: datetime | None = None
    server_time: datetime
    elapsed_seconds: int = 0
    total_accumulated_seconds: int = 0


class TimeSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    user_id: str
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: int | None = None


class TimeSessionCorrectionRequest(BaseModel):
    new_duration_seconds: int
    reason: str
