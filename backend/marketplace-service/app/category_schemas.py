"""
Pydantic schemas for Phase 2 category-specific models.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ══════════════════════════════════════════════════════════════════════════════
# PHYSICAL GOODS
# ══════════════════════════════════════════════════════════════════════════════

class ProductWarrantyRequest(BaseModel):
    warranty_type: Literal["manufacturer", "seller", "extended", "none"]
    duration_months: int | None = Field(default=None, ge=1, le=120)
    terms: str | None = Field(default=None, max_length=5000)
    coverage_details: dict | None = None
    certificate_url: str | None = Field(default=None, max_length=2048)


class ProductShippingRequest(BaseModel):
    weight_kg: Decimal | None = Field(default=None, gt=0, le=10000)
    length_cm: Decimal | None = Field(default=None, gt=0, le=1000)
    width_cm: Decimal | None = Field(default=None, gt=0, le=1000)
    height_cm: Decimal | None = Field(default=None, gt=0, le=1000)
    shipping_methods: list[str] | None = None
    free_shipping: bool = False
    shipping_fee: Decimal | None = Field(default=None, ge=0)
    estimated_delivery_days: int | None = Field(default=None, ge=1, le=90)
    ships_internationally: bool = False
    restricted_countries: list[str] | None = None


class ProductWarrantyResponse(BaseModel):
    listing_id: uuid.UUID
    warranty_type: str
    duration_months: int | None
    terms: str | None
    coverage_details: dict | None
    certificate_url: str | None


class ProductShippingResponse(BaseModel):
    listing_id: uuid.UUID
    weight_kg: Decimal | None
    length_cm: Decimal | None
    width_cm: Decimal | None
    height_cm: Decimal | None
    shipping_methods: list[str] | None
    free_shipping: bool
    shipping_fee: Decimal | None
    estimated_delivery_days: int | None
    ships_internationally: bool
    restricted_countries: list[str] | None


# ══════════════════════════════════════════════════════════════════════════════
# DIGITAL PRODUCTS
# ══════════════════════════════════════════════════════════════════════════════

class DigitalProductRequest(BaseModel):
    product_type: Literal["ebook", "software", "music", "video", "course", "template", "plugin", "theme", "other"]
    file_format: str | None = Field(default=None, max_length=50)
    file_size_mb: Decimal | None = Field(default=None, gt=0)
    download_limit: int | None = Field(default=None, ge=1, le=100)
    license_type: Literal["personal", "commercial", "extended", "subscription"]
    drm_protected: bool = False
    preview_url: str | None = Field(default=None, max_length=2048)
    instant_delivery: bool = True
    requires_account: bool = False


class DigitalProductResponse(BaseModel):
    listing_id: uuid.UUID
    product_type: str
    file_format: str | None
    file_size_mb: Decimal | None
    download_limit: int | None
    license_type: str
    drm_protected: bool
    preview_url: str | None
    instant_delivery: bool
    requires_account: bool


class DigitalProductPurchaseResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    buyer_id: uuid.UUID
    order_id: uuid.UUID
    license_key: str | None
    download_count: int
    expires_at: datetime | None
    purchased_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# SERVICES
# ══════════════════════════════════════════════════════════════════════════════

class ServiceDetailRequest(BaseModel):
    service_type: str = Field(..., max_length=50)
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    requires_deposit: bool = False
    deposit_amount: Decimal | None = Field(default=None, ge=0)
    cancellation_policy: str | None = Field(default=None, max_length=2000)
    service_location_type: Literal["onsite", "remote", "hybrid", "client_location"]
    qualifications: list[str] | None = None
    certifications: list[str] | None = None
    languages_spoken: list[str] | None = None


class ServiceDetailResponse(BaseModel):
    listing_id: uuid.UUID
    service_type: str
    duration_minutes: int | None
    requires_deposit: bool
    deposit_amount: Decimal | None
    cancellation_policy: str | None
    service_location_type: str
    qualifications: list[str] | None
    certifications: list[str] | None
    languages_spoken: list[str] | None


class ServicePortfolioRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    project_date: datetime | None = None
    media_urls: list[str] | None = None
    client_testimonial: str | None = Field(default=None, max_length=1000)
    sort_order: int = 0


class ServicePortfolioResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    title: str
    description: str | None
    project_date: datetime | None
    media_urls: list[str] | None
    client_testimonial: str | None
    sort_order: int
    created_at: datetime


class ServiceAvailabilityRequest(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    is_available: bool = True


class ServiceAvailabilityResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    day_of_week: int
    start_time: str
    end_time: str
    is_available: bool


# ══════════════════════════════════════════════════════════════════════════════
# PROPERTY
# ══════════════════════════════════════════════════════════════════════════════

class PropertyFloorPlanRequest(BaseModel):
    floor_number: int
    floor_name: str | None = Field(default=None, max_length=100)
    image_url: str = Field(..., max_length=2048)
    area_sqm: Decimal | None = Field(default=None, gt=0)
    room_count: int | None = Field(default=None, ge=0)
    sort_order: int = 0


class PropertyFloorPlanResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    floor_number: int
    floor_name: str | None
    image_url: str
    area_sqm: Decimal | None
    room_count: int | None
    sort_order: int


class PropertyInspectionRequest(BaseModel):
    inspector_name: str | None = Field(default=None, max_length=200)
    inspection_date: datetime
    report_url: str = Field(..., max_length=2048)
    overall_condition: Literal["excellent", "good", "fair", "poor", "not_rated"] | None = None
    issues_found: list[str] | None = None


class PropertyInspectionResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    inspector_name: str | None
    inspection_date: datetime
    report_url: str
    overall_condition: str | None
    issues_found: list[str] | None
    created_at: datetime


class PropertyNeighborhoodRequest(BaseModel):
    walkability_score: int | None = Field(default=None, ge=0, le=100)
    transit_score: int | None = Field(default=None, ge=0, le=100)
    nearby_schools: list[str] | None = None
    nearby_hospitals: list[str] | None = None
    nearby_shopping: list[str] | None = None
    public_transport: list[str] | None = None
    crime_rate: str | None = Field(default=None, max_length=20)


class PropertyNeighborhoodResponse(BaseModel):
    listing_id: uuid.UUID
    walkability_score: int | None
    transit_score: int | None
    nearby_schools: list[str] | None
    nearby_hospitals: list[str] | None
    nearby_shopping: list[str] | None
    public_transport: list[str] | None
    crime_rate: str | None


# ══════════════════════════════════════════════════════════════════════════════
# VEHICLES
# ══════════════════════════════════════════════════════════════════════════════

class VehicleHistoryRequest(BaseModel):
    event_type: Literal["service", "repair", "accident", "modification", "owner_change", "inspection"]
    event_date: datetime
    description: str = Field(..., min_length=1, max_length=5000)
    cost: Decimal | None = Field(default=None, ge=0)
    documentation_url: str | None = Field(default=None, max_length=2048)
    mileage_at_event: int | None = Field(default=None, ge=0)


class VehicleHistoryResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    event_type: str
    event_date: datetime
    description: str
    cost: Decimal | None
    documentation_url: str | None
    mileage_at_event: int | None
    created_at: datetime


class VehicleFeaturesRequest(BaseModel):
    exterior_features: list[str] | None = None
    interior_features: list[str] | None = None
    safety_features: list[str] | None = None
    technology_features: list[str] | None = None
    performance_features: list[str] | None = None
    comfort_features: list[str] | None = None
    seating_capacity: int | None = Field(default=None, ge=1, le=50)
    doors: int | None = Field(default=None, ge=1, le=10)
    drive_train: str | None = Field(default=None, max_length=30)
    body_type: str | None = Field(default=None, max_length=30)


class VehicleFeaturesResponse(BaseModel):
    listing_id: uuid.UUID
    exterior_features: list[str] | None
    interior_features: list[str] | None
    safety_features: list[str] | None
    technology_features: list[str] | None
    performance_features: list[str] | None
    comfort_features: list[str] | None
    seating_capacity: int | None
    doors: int | None
    drive_train: str | None
    body_type: str | None


# ══════════════════════════════════════════════════════════════════════════════
# JOBS
# ══════════════════════════════════════════════════════════════════════════════

class JobBenefitRequest(BaseModel):
    benefit_type: Literal[
        "health", "retirement", "paid_leave", "bonus", "equity",
        "learning", "flexible", "remote", "relocation", "other"
    ]
    description: str = Field(..., min_length=1, max_length=1000)
    sort_order: int = 0


class JobBenefitResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    benefit_type: str
    description: str
    sort_order: int


class CompanyProfileRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=100)
    company_size: str | None = Field(default=None, max_length=30)
    founded_year: int | None = Field(default=None, ge=1800, le=2100)
    website: str | None = Field(default=None, max_length=2048)
    logo_url: str | None = Field(default=None, max_length=2048)
    description: str | None = Field(default=None, max_length=5000)
    headquarters_location: str | None = Field(default=None, max_length=200)
    culture_values: list[str] | None = None


class CompanyProfileResponse(BaseModel):
    employer_id: uuid.UUID
    company_name: str
    industry: str | None
    company_size: str | None
    founded_year: int | None
    website: str | None
    logo_url: str | None
    description: str | None
    headquarters_location: str | None
    culture_values: list[str] | None
    created_at: datetime
    updated_at: datetime


class JobInterviewRequest(BaseModel):
    interview_type: Literal["phone", "video", "onsite", "technical", "behavioral", "panel"]
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    location: str | None = Field(default=None, max_length=2048)
    interviewer_name: str | None = Field(default=None, max_length=200)


class JobInterviewResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    interview_type: str
    scheduled_at: datetime
    duration_minutes: int
    location: str | None
    interviewer_name: str | None
    status: str
    feedback: str | None
    rating: int | None
    created_at: datetime


class JobInterviewUpdateRequest(BaseModel):
    status: Literal["scheduled", "completed", "cancelled", "rescheduled", "no_show"] | None = None
    feedback: str | None = Field(default=None, max_length=5000)
    rating: int | None = Field(default=None, ge=1, le=5)


# ══════════════════════════════════════════════════════════════════════════════
# CROSS-CATEGORY
# ══════════════════════════════════════════════════════════════════════════════

class ListingViewResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    viewer_id: uuid.UUID | None
    viewed_at: datetime


class ListingFavoriteResponse(BaseModel):
    user_id: uuid.UUID
    listing_id: uuid.UUID
    created_at: datetime


class ListingReportRequest(BaseModel):
    reason: Literal["spam", "fraud", "inappropriate", "duplicate", "wrong_category", "counterfeit", "other"]
    description: str | None = Field(default=None, max_length=2000)


class ListingReportResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    reporter_id: uuid.UUID
    reason: str
    description: str | None
    status: str
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    resolution_notes: str | None
    created_at: datetime


class ListingReportReviewRequest(BaseModel):
    status: Literal["under_review", "resolved", "dismissed"]
    resolution_notes: str | None = Field(default=None, max_length=2000)


class ListingPriceHistoryResponse(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    old_price: Decimal | None
    new_price: Decimal
    changed_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

class ListingAnalyticsResponse(BaseModel):
    listing_id: uuid.UUID
    total_views: int
    unique_viewers: int
    favorite_count: int
    average_view_duration_seconds: float | None
    conversion_rate: float | None  # views to bookings/purchases ratio
    price_changes: int
    last_viewed_at: datetime | None
