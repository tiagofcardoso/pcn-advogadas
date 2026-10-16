"""Pydantic schemas for User management (Admin exclusive)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from pcn.domain.enums import UserRole


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    role: UserRole = UserRole.LAWYER


class UserCreateResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: UserRole
    temporary_password: str


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150)
    role: UserRole | None = None
    is_active: bool | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: EmailStr
    role: UserRole
    is_totp_enabled: bool
    must_change_password: bool
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
