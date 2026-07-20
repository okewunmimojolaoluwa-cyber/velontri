"""
Marketplace Service SQLAlchemy ORM models.
Schema matches Design Â§2.3 exactly.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, Index,
    Integer, Numeric, SmallInteger, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from shared.database import Base

from datetime import timezone as _tz

def _utc_now() -> datetime:
    return datetime.now(tz=_tz.utc)


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    listing_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True)
    condition: Mapped[str | None] = mapped_column(String(20), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    avg_rating: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False, default=0)
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    __table_args__ = (
        CheckConstraint(
            "listing_type IN ('physical','digital','job','property','vehicle','service')",
            name="ck_listings_type",
        ),
        CheckConstraint(
            "status IN ('draft','pending_review','active','out_of_stock','rejected','archived')",
            name="ck_listings_status",
        ),
        CheckConstraint(
            "currency IN ('NGN','GHS','KES','ZAR','XOF')",
            name="ck_listings_currency",
        ),
        Index("ix_listings_seller_id", "seller_id"),
        Index("ix_listings_status", "status"),
        Index("ix_listings_category", "category"),
        Index("ix_listings_created_at", "created_at"),
    )


class ListingMedia(Base):
    __tablename__ = "listing_media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    s3_key: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        CheckConstraint(
            "media_type IN ('image','video','tour_360')",
            name="ck_listing_media_type",
        ),
        Index("ix_listing_media_listing_id", "listing_id"),
    )


class ListingSpec(Base):
    __tablename__ = "listing_specs"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    spec_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    spec_value: Mapped[str] = mapped_column(Text, nullable=False)


class ListingVariant(Base):
    __tablename__ = "listing_variants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    price: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_listing_variants_listing_id", "listing_id"),
        CheckConstraint("stock_quantity >= 0", name="ck_variants_stock_nonneg"),
    )


class PropertyDetail(Base):
    __tablename__ = "property_details"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    property_type: Mapped[str] = mapped_column(String(20), nullable=False)
    bedrooms: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    bathrooms: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    area_sqm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    furnishing_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    amenities: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    tour_asset_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_per_night: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "property_type IN ('rent','sale','shortlet','commercial')",
            name="ck_property_type",
        ),
    )


class ShortletAvailability(Base):
    __tablename__ = "shortlet_availability"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    blocked_date: Mapped[date] = mapped_column(Date, primary_key=True)


class VehicleDetail(Base):
    __tablename__ = "vehicle_details"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    make: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    mileage_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fuel_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    transmission: Mapped[str | None] = mapped_column(String(20), nullable=True)
    colour: Mapped[str | None] = mapped_column(String(50), nullable=True)
    engine_size_cc: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vin: Mapped[str | None] = mapped_column(String(17), nullable=True)
    vin_history_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    vin_history_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vin_error_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    inspection_report_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)


class JobDetail(Base):
    __tablename__ = "job_details"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    employer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    job_type: Mapped[str] = mapped_column(String(20), nullable=False)
    salary_min: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    salary_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    required_skills: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    application_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "job_type IN ('full_time','part_time','contract','remote')",
            name="ck_job_type",
        ),
    )


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    cv_s3_key: Mapped[str] = mapped_column(Text, nullable=False)
    ai_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    ai_missing_skills: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','shortlisted','rejected','hired')",
            name="ck_application_status",
        ),
        Index("ix_job_applications_listing_id", "listing_id"),
        Index("ix_job_applications_applicant_id", "applicant_id"),
    )


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="published")
    seller_response: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        UniqueConstraint("listing_id", "reviewer_id", name="uq_reviews_listing_reviewer"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating"),
        CheckConstraint(
            "status IN ('published','quarantined')",
            name="ck_review_status",
        ),
        Index("ix_reviews_listing_id", "listing_id"),
    )


class ReviewMedia(Base):
    __tablename__ = "review_media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    s3_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint("media_type IN ('image','video')", name="ck_review_media_type"),
        Index("ix_review_media_review_id", "review_id"),
    )


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    store_name: Mapped[str] = mapped_column(String(200), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    banner_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    theme: Mapped[str | None] = mapped_column(String(50), nullable=True)
    custom_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    domain_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        Index("ix_stores_seller_id", "seller_id"),
        Index("ix_stores_custom_domain", "custom_domain"),
    )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    buyer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    seller_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    payment_ref: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','confirmed','done','cancelled')",
            name="ck_booking_status",
        ),
        Index("ix_bookings_listing_id", "listing_id"),
        Index("ix_bookings_buyer_id", "buyer_id"),
    )


class ReviewEligibility(Base):
    """Tracks which buyer-listing pairs are eligible for reviews after order completion."""
    __tablename__ = "review_eligibility"

    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    buyer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
