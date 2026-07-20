"""
Pydantic request/response schemas for the Auth Service.

All inputs are strictly validated. All outputs are typed.
Sensitive fields (passwords, tokens) are write-only — never returned.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

# ── Validators ────────────────────────────────────────────────────────────────

_PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")  # E.164 format
_PASSWORD_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]).{8,128}$"
)
_COUNTRY_CODE_RE = re.compile(r"^[A-Z]{2}$")


def _validate_phone(v: str) -> str:
    if not _PHONE_RE.match(v):
        raise ValueError(
            "Phone must be in E.164 format, e.g. +2348012345678"
        )
    return v


def _validate_password(v: str) -> str:
    if not _PASSWORD_RE.match(v):
        raise ValueError(
            "Password must be 8–128 characters and contain at least one "
            "uppercase letter, one lowercase letter, one digit, and one "
            "special character."
        )
    return v


# ── Registration ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    phone: str
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=200)
    country_code: str = Field(..., min_length=2, max_length=2)

    @field_validator("email", mode="after")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        # Pydantic v2 EmailStr preserves case; normalise to lowercase
        return v.lower()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password(v)

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, v: str) -> str:
        v = v.upper()
        if not _COUNTRY_CODE_RE.match(v):
            raise ValueError("country_code must be a 2-letter ISO 3166-1 alpha-2 code")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("full_name must not be empty or whitespace")
        return stripped


class RegisterResponse(BaseModel):
    user_id: uuid.UUID
    email: str = ""
    message: str = "Registration successful. Please verify your email address."


# ── Phone verification ────────────────────────────────────────────────────────

class VerifyPhoneRequest(BaseModel):
    user_id: uuid.UUID
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class VerifyPhoneResponse(BaseModel):
    message: str = "Phone verified. Your account is now active."


class ResendOtpRequest(BaseModel):
    user_id: uuid.UUID


class ResendOtpResponse(BaseModel):
    message: str = "A new verification code has been sent to your phone."


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    # Accept either email or phone in the identifier field
    identifier: str = Field(
        ...,
        description="Email address or phone number (E.164)",
        min_length=1,
        max_length=255,
    )
    password: str = Field(..., min_length=1, max_length=128)
    device_fingerprint: str = Field(
        ...,
        min_length=16,
        max_length=255,
        description="Client-generated stable device identifier",
    )
    user_agent: str | None = Field(default=None, max_length=512)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token TTL in seconds


class LoginResponse(BaseModel):
    tokens: TokenPair | None = None
    requires_2fa: bool = False
    two_fa_session_id: str | None = None  # opaque session ID for 2FA completion
    message: str = "Login successful."


# ── Token refresh ─────────────────────────────────────────────────────────────

class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ── 2FA ───────────────────────────────────────────────────────────────────────

class Enable2FARequest(BaseModel):
    method: str = Field(..., pattern="^(totp|sms)$")


class Enable2FAResponse(BaseModel):
    method: str
    totp_secret: str | None = None     # Only present for TOTP; client stores this
    totp_qr_url: str | None = None     # otpauth:// URI for QR code generation
    message: str


class Verify2FARequest(BaseModel):
    two_fa_session_id: str = Field(..., min_length=1, max_length=255)
    otp: str = Field(..., min_length=6, max_length=8)  # TOTP can be 6-8 digits


class Verify2FAResponse(BaseModel):
    tokens: TokenPair
    message: str = "Two-factor authentication verified."


# ── OAuth ─────────────────────────────────────────────────────────────────────

class OAuthLoginRequest(BaseModel):
    provider: str = Field(..., pattern="^(google|apple)$")
    id_token: str = Field(..., min_length=1, description="Provider-issued ID token")
    device_fingerprint: str = Field(..., min_length=16, max_length=255)
    user_agent: str | None = Field(default=None, max_length=512)


# ── Password reset ────────────────────────────────────────────────────────────

class PasswordResetRequestBody(BaseModel):
    email: EmailStr


class PasswordResetRequestResponse(BaseModel):
    message: str = "If this email exists, a reset link has been sent."


class PasswordResetBody(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password(v)


class PasswordResetResponse(BaseModel):
    message: str = "Password updated successfully. Please log in again."


# ── Token introspection ───────────────────────────────────────────────────────

class IntrospectResponse(BaseModel):
    user_id: uuid.UUID
    roles: list[str]
    subscription_tier: str
    branch_ids: list[str]
    expires_at: int  # Unix timestamp


# ── Devices ───────────────────────────────────────────────────────────────────

class DeviceResponse(BaseModel):
    id: uuid.UUID
    fingerprint: str
    ip_address: str | None
    user_agent: str | None
    last_seen: datetime | None
    is_trusted: bool
    created_at: datetime


class DeviceListResponse(BaseModel):
    devices: list[DeviceResponse]
