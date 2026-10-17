"""Pydantic schemas for Clients and Task Types."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from pcn.domain.nif import is_valid_nif, normalize_nif


class ClientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    nif: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    process_reference: str | None = Field(None, max_length=100)
    notes: str | None = None

    @field_validator("nif")
    @classmethod
    def validate_pt_nif(cls, value: str | None) -> str | None:
        if value:
            normalized = normalize_nif(value)
            if not is_valid_nif(normalized):
                raise ValueError("NIF inválido segundo o algoritmo de verificação português.")
            return normalized
        return None


class ClientUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=180)
    nif: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    process_reference: str | None = Field(None, max_length=100)
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("nif")
    @classmethod
    def validate_pt_nif(cls, value: str | None) -> str | None:
        if value:
            normalized = normalize_nif(value)
            if not is_valid_nif(normalized):
                raise ValueError("NIF inválido segundo o algoritmo de verificação português.")
            return normalized
        return None


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    nif: str | None = None
    email: str | None = None
    phone: str | None = None
    process_reference: str | None = None
    notes: str | None = None
    is_active: bool
    created_at: datetime


class TaskTypeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(None, max_length=255)
    hourly_rate: float = Field(default=120.0, ge=0)
    default_billable: bool = True
    color: str = Field(default="#92006F", pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$")


class TaskTypeUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = Field(None, max_length=255)
    hourly_rate: float | None = Field(None, ge=0)
    default_billable: bool | None = None
    color: str | None = Field(None, pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$")


class TaskTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    hourly_rate: float = 120.0
    default_billable: bool
    color: str
