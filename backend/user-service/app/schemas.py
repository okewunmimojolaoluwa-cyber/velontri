"""User Service Pydantic schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


SUPPORTED_CURRENCIES = {"NGN", "GHS", "KES", "ZAR", "XOF"}
TRUST_BADGE_LEVELS = {"none", "bronze", "silver", "gold", "diamond"}
SUBSCRIPTION_TIERS = {"starter", "growth", "pro", "enterprise"}
VALID_ROLES = {
    "buyer", "seller", "agent",
    "branch_manager", "business_owner", "enterprise_admin",
}


# ── Profile ───────────────────────────────────────────────────────────────────

class ProfileResponse(BaseModel):
    user_id: uuid.UUID
    full_name: str
    profile_photo_url: str | None
    bio: str | None
    country: str | None
    state: str | None
    city: str | None
    phone: str | None
    email: str | None
    default_currency: str
    trust_badge: str
    subscription_tier: str
    registered_at: datetime
    updated_at: datetime


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=500)
    country: str | None = Field(default=None, min_length=2, max_length=2)
    state: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    default_currency: str | None = Field(default=None)

    @field_validator("default_currency")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        if v is not None and v.upper() not in SUPPORTED_CURRENCIES:
            raise ValueError(
                f"Unsupported currency. Must be one of: {sorted(SUPPORTED_CURRENCIES)}"
            )
        return v.upper() if v else v

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str | None) -> str | None:
        return v.upper() if v else v


# ── KYC ───────────────────────────────────────────────────────────────────────

class KYCDocumentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    document_type: str
    status: str
    submitted_at: datetime
    reviewed_at: datetime | None


# ── Business / Branch ─────────────────────────────────────────────────────────

class CreateBusinessRequest(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=200)
    registration_number: str | None = Field(default=None, max_length=100)
    country: str = Field(..., min_length=2, max_length=2)

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str) -> str:
        return v.upper()


class BusinessResponse(BaseModel):
    id: uuid.UUID
    owner_user_id: uuid.UUID
    business_name: str
    registration_number: str | None
    logo_url: str | None
    country: str
    created_at: datetime


class CreateBranchRequest(BaseModel):
    branch_name: str = Field(..., min_length=1, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, min_length=2, max_length=2)

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str | None) -> str | None:
        return v.upper() if v else v


class BranchResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    branch_name: str
    address: str | None
    city: str | None
    country: str | None
    created_at: datetime


# ── Roles ─────────────────────────────────────────────────────────────────────

class ElevateRoleRequest(BaseModel):
    role: str
    scope_id: uuid.UUID | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {sorted(VALID_ROLES)}")
        return v


# ── Internal endpoints (consumed by Auth Service) ─────────────────────────────

class UserRolesResponse(BaseModel):
    user_id: uuid.UUID
    roles: list[str]


class SubscriptionTierResponse(BaseModel):
    user_id: uuid.UUID
    tier: str
