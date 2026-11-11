"""Pydantic schemas for Tasks and Boards."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from pcn.domain.enums import TaskAction, TaskStatus
from pcn.schemas.client import ClientRead, TaskTypeRead
from pcn.schemas.user import UserRead


def _ensure_utc(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


class TaskCreate(BaseModel):
    client_id: str
    task_type_id: str
    task_type_name: str | None = Field(None, max_length=200)
    hourly_rate: Decimal | None = Field(None, ge=0)
    title: str = Field(min_length=2, max_length=255)
    description: str | None = None
    assigned_to: str | None = None
    due_date: datetime | None = None
    is_urgent_deadline: bool = False
    publish_to_pool: bool = False
    meta: dict[str, Any] | None = None

    @field_validator("due_date")
    @classmethod
    def _validate_due_date_utc(cls, value: datetime | None) -> datetime | None:
        return _ensure_utc(value)


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = None
    client_id: str | None = None
    task_type_id: str | None = None
    task_type_name: str | None = Field(None, max_length=200)
    hourly_rate: Decimal | None = Field(None, ge=0)
    due_date: datetime | None = None
    is_urgent_deadline: bool | None = None
    fee_amount: Decimal | None = None
    status: TaskStatus | None = None
    total_duration_seconds: int | None = Field(None, ge=0)
    meta: dict[str, Any] | None = None

    @field_validator("due_date")
    @classmethod
    def _validate_due_date_utc(cls, value: datetime | None) -> datetime | None:
        return _ensure_utc(value)


class TimerSyncItem(BaseModel):
    task_id: str
    total_duration_seconds: int = Field(ge=0)


class TimerSyncRequest(BaseModel):
    tasks: list[TimerSyncItem] = Field(default_factory=list)


class TaskAssignRequest(BaseModel):
    assigned_to: str | None = None


class TaskTransitionRequest(BaseModel):
    action: TaskAction


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    task_type_id: str
    title: str
    description: str | None = None
    status: TaskStatus
    created_by: str
    assigned_to: str | None = None
    due_date: datetime | None = None
    is_urgent_deadline: bool
    total_duration_seconds: int
    fee_amount: Decimal | None = None
    fee_note_id: str | None = None
    completed_at: datetime | None = None
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    client: ClientRead | None = None
    task_type: TaskTypeRead | None = None
    assignee: UserRead | None = None

    @field_validator("due_date", "completed_at", "created_at", "updated_at")
    @classmethod
    def _validate_timestamps_utc(cls, value: datetime | None) -> datetime | None:
        return _ensure_utc(value)


class BoardSummaryResponse(BaseModel):
    backlog_count: int = 0
    pool_count: int = 0
    assigned_count: int = 0
    in_progress_count: int = 0
    paused_count: int = 0
    completed_count: int = 0
