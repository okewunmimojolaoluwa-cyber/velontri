"""Marketplace Service Pydantic schemas."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

VALID_CURRENCIES = {"NGN", "GHS", "KES", "ZAR", "XOF"}
VALID_LISTING_TYPES = {"physical", "digital", "job", "property", "vehicle", "service"}
VALID_CONDITIONS = {"new", "used", "refurbished"}
VALID_TIERS_WITH_360 = {"pro", "enterprise"}


# ── Listing ───────────────────────────────────────────────────────────────────

class CreateListingRequest(BaseModel):
    listing_type: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    price: Decimal | None = Field(default=None, ge=0)
    currency: str
    country: str | None = Field(default=None, min_length=2, max_length=2)
    state: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    category: str | None = Field(default=None, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)
    condition: str | None = None
    brand: str | None = Field(default=None, max_length=100)
    specs: dict[str, str] | None = None
    variants: list["VariantRequest"] | None = None
    image_url: str | None = Field(default=None, description="Data URL or HTTPS URL for the primary image")
    whatsapp_number: str | None = Field(default=None, max_length=20, description="Seller WhatsApp number in E.164 format")
    contact_phone: str | None = Field(default=None, max_length=20, description="Optional extra contact phone")

    @field_validator("listing_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_LISTING_TYPES:
            raise ValueError(f"listing_type must be one of {sorted(VALID_LISTING_TYPES)}")
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_CURRENCIES:
            raise ValueError(f"currency must be one of {sorted(VALID_CURRENCIES)}")
        return v

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_CONDITIONS:
            raise ValueError(f"condition must be one of {sorted(VALID_CONDITIONS)}")
        return v


class VariantRequest(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    attributes: dict[str, str] = Field(..., description="e.g. {'colour': 'red', 'size': 'M'}")
    price: Decimal | None = Field(default=None, ge=0)
    stock_quantity: int = Field(default=0, ge=0)


class ListingResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    listing_type: str
    title: str
    description: str | None
    price: Decimal | None
    currency: str
    country: str | None
    state: str | None
    city: str | None
    category: str | None
    subcategory: str | None
    condition: str | None
    brand: str | None
    status: str
    avg_rating: float
    review_count: int
    image_url: str | None = None
    whatsapp_number: str | None = None
    contact_phone: str | None = None
    created_at: datetime
    updated_at: datetime


class UpdateListingRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    price: Decimal | None = Field(default=None, ge=0)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    brand: str | None = Field(default=None, max_length=100)
    condition: str | None = None
    image_url: str | None = None
    status: str | None = None


# ── Property ──────────────────────────────────────────────────────────────────

class PropertyDetailRequest(BaseModel):
    property_type: Literal["rent", "sale", "shortlet", "commercial"]
    bedrooms: int | None = Field(default=None, ge=0, le=50)
    bathrooms: int | None = Field(default=None, ge=0, le=50)
    area_sqm: Decimal | None = Field(default=None, gt=0)
    furnishing_status: str | None = Field(default=None, max_length=20)
    amenities: list[str] | None = None
    tour_asset_url: str | None = Field(default=None, max_length=2048)
    price_per_night: Decimal | None = Field(default=None, ge=0)
    blocked_dates: list[date] | None = None


class MortgageCalculatorRequest(BaseModel):
    price: Decimal = Field(..., gt=0)
    deposit: Decimal = Field(..., ge=0)
    annual_interest_rate_pct: Decimal = Field(..., gt=0, le=100)
    loan_term_years: int = Field(..., ge=1, le=30)


class MortgageCalculatorResponse(BaseModel):
    monthly_repayment: Decimal
    total_repayment: Decimal
    total_interest: Decimal


# ── Vehicle ───────────────────────────────────────────────────────────────────

class VehicleDetailRequest(BaseModel):
    make: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    year: int | None = Field(default=None, ge=1900, le=2100)
    mileage_km: int | None = Field(default=None, ge=0)
    fuel_type: str | None = Field(default=None, max_length=20)
    transmission: str | None = Field(default=None, max_length=20)
    colour: str | None = Field(default=None, max_length=50)
    engine_size_cc: int | None = Field(default=None, ge=0)
    vin: str | None = Field(default=None, min_length=17, max_length=17)

    @field_validator("vin")
    @classmethod
    def validate_vin(cls, v: str | None) -> str | None:
        if v is not None:
            import re
            if not re.match(r"^[A-HJ-NPR-Z0-9]{17}$", v.upper()):
                raise ValueError(
                    "VIN must be 17 alphanumeric characters "
                    "(excluding I, O, Q)"
                )
            return v.upper()
        return v


# ── Job ───────────────────────────────────────────────────────────────────────

class JobDetailRequest(BaseModel):
    job_type: Literal["full_time", "part_time", "contract", "remote"]
    salary_min: Decimal | None = Field(default=None, ge=0)
    salary_max: Decimal | None = Field(default=None, ge=0)
    salary_currency: str | None = None
    required_skills: list[str] | None = None
    application_deadline: date | None = None

    @model_validator(mode="after")
    def validate_salary_range(self) -> "JobDetailRequest":
        if self.salary_min and self.salary_max:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min must not exceed salary_max")
        return self


# ── Review ────────────────────────────────────────────────────────────────────

class CreateReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class ReviewResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    reviewer_id: uuid.UUID
    rating: int
    comment: str | None
    status: str
    seller_response: str | None
    created_at: datetime


class SellerResponseRequest(BaseModel):
    response: str = Field(..., min_length=1, max_length=1000)


# ── Store ─────────────────────────────────────────────────────────────────────

class UpsertStoreRequest(BaseModel):
    store_name: str = Field(..., min_length=1, max_length=200)
    theme: str | None = Field(default=None, max_length=50)
    custom_domain: str | None = Field(default=None, max_length=255)

    @field_validator("custom_domain")
    @classmethod
    def validate_domain(cls, v: str | None) -> str | None:
        if v is not None:
            import re
            # Must be in format: {name}.velontri.com
            if not re.match(r"^[a-z0-9\-]+\.velontri\.com$", v.lower()):
                raise ValueError(
                    "custom_domain must be in the format: {name}.velontri.com"
                )
            return v.lower()
        return v


class StoreResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    store_name: str
    logo_url: str | None
    banner_url: str | None
    theme: str | None
    custom_domain: str | None
    domain_verified: bool
    created_at: datetime


# ── Booking ───────────────────────────────────────────────────────────────────

class CreateBookingRequest(BaseModel):
    listing_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int | None = Field(default=None, ge=15, le=480)

    @field_validator("scheduled_at")
    @classmethod
    def validate_future(cls, v: datetime) -> datetime:
        from datetime import timezone
        now = datetime.now(tz=timezone.utc)
        if v.tzinfo is None:
            raise ValueError("scheduled_at must be timezone-aware.")
        if v <= now:
            raise ValueError("scheduled_at must be in the future.")
        return v


class BookingResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    buyer_id: uuid.UUID
    seller_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int | None
    status: str
    created_at: datetime


class UpdateBookingStatusRequest(BaseModel):
    status: Literal["confirmed", "done", "cancelled"]
