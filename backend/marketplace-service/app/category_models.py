"""
Category-specific models for enhanced marketplace capabilities.
Phase 2: Extended category support with dedicated schemas.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, Index,
    Integer, Numeric, SmallInteger, String, Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base
from datetime import timezone as _tz


def _utc_now() -> datetime:
    return datetime.now(tz=_tz.utc)


# ══════════════════════════════════════════════════════════════════════════════
# PHYSICAL GOODS - Enhanced product management
# ══════════════════════════════════════════════════════════════════════════════

class ProductWarranty(Base):
    """Warranty information for physical products."""
    __tablename__ = "product_warranties"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    warranty_type: Mapped[str] = mapped_column(String(50), nullable=False)  # manufacturer, seller, extended
    duration_months: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    coverage_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    certificate_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "warranty_type IN ('manufacturer','seller','extended','none')",
            name="ck_warranty_type",
        ),
    )


class ProductShipping(Base):
    """Shipping configuration for physical products."""
    __tablename__ = "product_shipping"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    length_cm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    width_cm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    shipping_methods: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)  # ['standard', 'express', 'pickup']
    free_shipping: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    shipping_fee: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    estimated_delivery_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    ships_internationally: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    restricted_countries: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)


# ══════════════════════════════════════════════════════════════════════════════
# DIGITAL PRODUCTS - License and delivery management
# ══════════════════════════════════════════════════════════════════════════════

class DigitalProduct(Base):
    """Digital product metadata and delivery configuration."""
    __tablename__ = "digital_products"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    product_type: Mapped[str] = mapped_column(String(50), nullable=False)  # ebook, software, music, video, course, template
    file_format: Mapped[str | None] = mapped_column(String(50), nullable=True)  # pdf, mp4, zip, etc
    file_size_mb: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    download_limit: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # null = unlimited
    license_type: Mapped[str] = mapped_column(String(50), nullable=False)  # personal, commercial, extended
    drm_protected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    preview_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # sample/preview file
    s3_asset_key: Mapped[str | None] = mapped_column(Text, nullable=True)  # encrypted storage location
    instant_delivery: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    requires_account: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint(
            "product_type IN ('ebook','software','music','video','course','template','plugin','theme','other')",
            name="ck_digital_product_type",
        ),
        CheckConstraint(
            "license_type IN ('personal','commercial','extended','subscription')",
            name="ck_license_type",
        ),
    )


class DigitalProductPurchase(Base):
    """Track digital product purchases and download access."""
    __tablename__ = "digital_product_purchases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    buyer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    license_key: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    download_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_digital_purchases_listing_id", "listing_id"),
        Index("ix_digital_purchases_buyer_id", "buyer_id"),
        Index("ix_digital_purchases_order_id", "order_id"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# SERVICES - Appointment and portfolio management
# ══════════════════════════════════════════════════════════════════════════════

class ServiceDetail(Base):
    """Extended service listing information."""
    __tablename__ = "service_details"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    service_type: Mapped[str] = mapped_column(String(50), nullable=False)  # consulting, repair, installation, etc
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requires_deposit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deposit_amount: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    cancellation_policy: Mapped[str | None] = mapped_column(Text, nullable=True)
    service_location_type: Mapped[str] = mapped_column(String(30), nullable=False)  # onsite, remote, hybrid
    qualifications: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    certifications: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    languages_spoken: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "service_location_type IN ('onsite','remote','hybrid','client_location')",
            name="ck_service_location_type",
        ),
    )


class ServicePortfolio(Base):
    """Portfolio items for service providers."""
    __tablename__ = "service_portfolio"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    media_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    client_testimonial: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_service_portfolio_listing_id", "listing_id"),
    )


class ServiceAvailability(Base):
    """Service provider availability schedule."""
    __tablename__ = "service_availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Monday, 6=Sunday
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM format
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM format
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_day_of_week"),
        Index("ix_service_availability_listing_id", "listing_id"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# PROPERTY - Enhanced property features
# ══════════════════════════════════════════════════════════════════════════════

class PropertyFloorPlan(Base):
    """Floor plans for properties."""
    __tablename__ = "property_floor_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    floor_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    floor_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # "Ground Floor", "Basement"
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    area_sqm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    room_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    __table_args__ = (
        Index("ix_property_floor_plans_listing_id", "listing_id"),
    )


class PropertyInspection(Base):
    """Property inspection reports."""
    __tablename__ = "property_inspections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    inspector_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    inspection_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    report_url: Mapped[str] = mapped_column(Text, nullable=False)
    overall_condition: Mapped[str | None] = mapped_column(String(20), nullable=True)  # excellent, good, fair, poor
    issues_found: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_property_inspections_listing_id", "listing_id"),
        CheckConstraint(
            "overall_condition IN ('excellent','good','fair','poor','not_rated')",
            name="ck_property_condition",
        ),
    )


class PropertyNeighborhood(Base):
    """Neighborhood information for properties."""
    __tablename__ = "property_neighborhoods"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    walkability_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 0-100
    transit_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 0-100
    nearby_schools: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    nearby_hospitals: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    nearby_shopping: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    public_transport: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    crime_rate: Mapped[str | None] = mapped_column(String(20), nullable=True)  # low, medium, high

    __table_args__ = (
        CheckConstraint("walkability_score BETWEEN 0 AND 100", name="ck_walkability"),
        CheckConstraint("transit_score BETWEEN 0 AND 100", name="ck_transit"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# VEHICLES - Enhanced vehicle tracking
# ══════════════════════════════════════════════════════════════════════════════

class VehicleHistory(Base):
    """Vehicle ownership and service history."""
    __tablename__ = "vehicle_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # service, accident, owner_change
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    cost: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    documentation_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    mileage_at_event: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_vehicle_history_listing_id", "listing_id"),
        CheckConstraint(
            "event_type IN ('service','repair','accident','modification','owner_change','inspection')",
            name="ck_vehicle_event_type",
        ),
    )


class VehicleFeatures(Base):
    """Detailed vehicle features and specifications."""
    __tablename__ = "vehicle_features"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    exterior_features: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    interior_features: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    safety_features: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    technology_features: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    performance_features: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    comfort_features: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    seating_capacity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    doors: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    drive_train: Mapped[str | None] = mapped_column(String(30), nullable=True)  # fwd, rwd, awd, 4wd
    body_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # sedan, suv, truck, etc


# ══════════════════════════════════════════════════════════════════════════════
# JOBS - Enhanced job management
# ══════════════════════════════════════════════════════════════════════════════

class JobBenefit(Base):
    """Job benefits and perks."""
    __tablename__ = "job_benefits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    benefit_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    __table_args__ = (
        Index("ix_job_benefits_listing_id", "listing_id"),
        CheckConstraint(
            "benefit_type IN ('health','retirement','paid_leave','bonus','equity','learning','flexible','remote','relocation','other')",
            name="ck_benefit_type",
        ),
    )


class CompanyProfile(Base):
    """Company information for job listings."""
    __tablename__ = "company_profiles"

    employer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    company_size: Mapped[str | None] = mapped_column(String(30), nullable=True)  # 1-10, 11-50, etc
    founded_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    website: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    headquarters_location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    culture_values: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)


class JobInterview(Base):
    """Interview scheduling for job applications."""
    __tablename__ = "job_interviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    interview_type: Mapped[str] = mapped_column(String(30), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=60)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)  # address or video link
    interviewer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_job_interviews_application_id", "application_id"),
        CheckConstraint(
            "interview_type IN ('phone','video','onsite','technical','behavioral','panel')",
            name="ck_interview_type",
        ),
        CheckConstraint(
            "status IN ('scheduled','completed','cancelled','rescheduled','no_show')",
            name="ck_interview_status",
        ),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_interview_rating"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# CROSS-CATEGORY - Analytics and engagement
# ══════════════════════════════════════════════════════════════════════════════

class ListingView(Base):
    """Track listing views for analytics."""
    __tablename__ = "listing_views"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    viewer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # null for anonymous
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    referrer: Mapped[str | None] = mapped_column(Text, nullable=True)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_listing_views_listing_id", "listing_id"),
        Index("ix_listing_views_viewed_at", "viewed_at"),
    )


class ListingFavorite(Base):
    """User favorites/wishlist."""
    __tablename__ = "listing_favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_listing_favorites_user_id", "user_id"),
        Index("ix_listing_favorites_listing_id", "listing_id"),
    )


class ListingReport(Base):
    """User reports for inappropriate listings."""
    __tablename__ = "listing_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reporter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_listing_reports_listing_id", "listing_id"),
        Index("ix_listing_reports_status", "status"),
        CheckConstraint(
            "reason IN ('spam','fraud','inappropriate','duplicate','wrong_category','counterfeit','other')",
            name="ck_report_reason",
        ),
        CheckConstraint(
            "status IN ('pending','under_review','resolved','dismissed')",
            name="ck_report_status",
        ),
    )


class ListingPriceHistory(Base):
    """Track price changes for listings."""
    __tablename__ = "listing_price_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    old_price: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    new_price: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_listing_price_history_listing_id", "listing_id"),
        Index("ix_listing_price_history_changed_at", "changed_at"),
    )
