"""Pydantic schemas for Calendar, Agendas, and Judicial Deadlines calculation."""

from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from pcn.schemas.client import ClientRead
from pcn.schemas.user import UserRead


def _ensure_utc(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


class JudicialDeadlineCalculateRequest(BaseModel):
    start_date: date
    days: int = Field(gt=0, description="Número de dias do prazo processual")
    is_urgent: bool = Field(default=False, description="Se True, não suspende em férias judiciais")


class JudicialDeadlineCalculateResponse(BaseModel):
    start_date: date
    days_count: int
    is_urgent: bool
    final_deadline: date
    penalty_day_1: date
    penalty_day_2: date
    penalty_day_3: date
    suspended_vacation_days: int


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    owner_id: str | None = None
    client_id: str | None = None
    task_id: str | None = None
    location: str | None = None
    is_deadline: bool = False
    is_urgent_judicial: bool = False

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _validate_dates_utc(cls, value: datetime | None) -> datetime | None:
        return _ensure_utc(value)


class EventUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    owner_id: str | None = None
    client_id: str | None = None
    task_id: str | None = None
    location: str | None = None
    is_deadline: bool | None = None
    is_urgent_judicial: bool | None = None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _validate_dates_utc(cls, value: datetime | None) -> datetime | None:
        return _ensure_utc(value)


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    owner_id: str
    client_id: str | None = None
    task_id: str | None = None
    location: str | None = None
    is_deadline: bool
    is_urgent_judicial: bool
    created_at: datetime

    client: ClientRead | None = None
    owner: UserRead | None = None

    @field_validator("starts_at", "ends_at", "created_at")
    @classmethod
    def _validate_dates_utc(cls, value: datetime | None) -> datetime | None:
        return _ensure_utc(value)
