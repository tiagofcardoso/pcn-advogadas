"""Pydantic schemas for authentication and authorization."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from pcn.domain.enums import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    requires_2fa: bool = False
    mfa_token: str | None = None
    must_change_password: bool = False
    must_setup_2fa: bool = False
    user_id: str | None = None
    role: UserRole | None = None
    name: str | None = None


class MfaVerifyRequest(BaseModel):
    mfa_token: str = Field(min_length=1, max_length=2048)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class TwoFASetupResponse(BaseModel):
    secret: str
    qr_svg_data_uri: str


class TwoFAVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: EmailStr
    role: UserRole
    is_totp_enabled: bool
    must_change_password: bool
