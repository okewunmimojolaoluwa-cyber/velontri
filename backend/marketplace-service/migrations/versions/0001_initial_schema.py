"""Initial marketplace service schema.

Revision ID: 0001
Revises:
Create Date: 2026-06-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # ── listings ───────────────────────────────────────────────────────────────
    op.create_table(
        "listings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("listing_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("subcategory", sa.String(100), nullable=True),
        sa.Column("condition", sa.String(20), nullable=True),
        sa.Column("brand", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("avg_rating", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "listing_type IN ('physical','digital','job','property','vehicle','service')",
            name="ck_listings_type",
        ),
        sa.CheckConstraint(
            "status IN ('draft','pending_review','active','out_of_stock','rejected','archived')",
            name="ck_listings_status",
        ),
        sa.CheckConstraint(
            "currency IN ('NGN','GHS','KES','ZAR','XOF')",
            name="ck_listings_currency",
        ),
        sa.CheckConstraint("review_count >= 0", name="ck_listings_review_count_nonneg"),
        sa.CheckConstraint("avg_rating >= 0 AND avg_rating <= 5", name="ck_listings_avg_rating_range"),
    )
    op.create_index("ix_listings_seller_id", "listings", ["seller_id"])
    op.create_index("ix_listings_status", "listings", ["status"])
    op.create_index("ix_listings_category", "listings", ["category"])
    op.create_index("ix_listings_created_at", "listings", ["created_at"])

    # ── listing_media ──────────────────────────────────────────────────────────
    op.create_table(
        "listing_media",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("media_type", sa.String(20), nullable=False),
        sa.Column("s3_key", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_listing_media_listing_id", ondelete="CASCADE"),
        sa.CheckConstraint(
            "media_type IN ('image','video','tour_360')",
            name="ck_listing_media_type",
        ),
    )
    op.create_index("ix_listing_media_listing_id", "listing_media", ["listing_id"])

    # ── listing_specs ──────────────────────────────────────────────────────────
    op.create_table(
        "listing_specs",
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("spec_key", sa.String(100), nullable=False),
        sa.Column("spec_value", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("listing_id", "spec_key", name="pk_listing_specs"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_listing_specs_listing_id", ondelete="CASCADE"),
    )

    # ── listing_variants ───────────────────────────────────────────────────────
    op.create_table(
        "listing_variants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("attributes", JSONB(), nullable=False),
        sa.Column("price", sa.Numeric(18, 2), nullable=True),
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_listing_variants_listing_id", ondelete="CASCADE"),
        sa.UniqueConstraint("sku", name="uq_listing_variants_sku"),
        sa.CheckConstraint("stock_quantity >= 0", name="ck_variants_stock_nonneg"),
    )
    op.create_index("ix_listing_variants_listing_id", "listing_variants", ["listing_id"])

    # ── property_details ───────────────────────────────────────────────────────
    op.create_table(
        "property_details",
        sa.Column("listing_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("property_type", sa.String(20), nullable=False),
        sa.Column("bedrooms", sa.SmallInteger(), nullable=True),
        sa.Column("bathrooms", sa.SmallInteger(), nullable=True),
        sa.Column("area_sqm", sa.Numeric(10, 2), nullable=True),
        sa.Column("furnishing_status", sa.String(20), nullable=True),
        sa.Column("amenities", ARRAY(sa.Text()), nullable=True),
        sa.Column("tour_asset_url", sa.Text(), nullable=True),
        sa.Column("price_per_night", sa.Numeric(18, 2), nullable=True),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_property_details_listing_id", ondelete="CASCADE"),
        sa.CheckConstraint(
            "property_type IN ('rent','sale','shortlet','commercial')",
            name="ck_property_type",
        ),
    )

    # ── shortlet_availability ──────────────────────────────────────────────────
    op.create_table(
        "shortlet_availability",
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_date", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("listing_id", "blocked_date", name="pk_shortlet_availability"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_shortlet_avail_listing_id", ondelete="CASCADE"),
    )

    # ── vehicle_details ────────────────────────────────────────────────────────
    op.create_table(
        "vehicle_details",
        sa.Column("listing_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("make", sa.String(100), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("year", sa.SmallInteger(), nullable=True),
        sa.Column("mileage_km", sa.Integer(), nullable=True),
        sa.Column("fuel_type", sa.String(20), nullable=True),
        sa.Column("transmission", sa.String(20), nullable=True),
        sa.Column("colour", sa.String(50), nullable=True),
        sa.Column("engine_size_cc", sa.Integer(), nullable=True),
        sa.Column("vin", sa.String(17), nullable=True),
        sa.Column("vin_history_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("vin_history_data", JSONB(), nullable=True),
        sa.Column("vin_error_reason", sa.Text(), nullable=True),
        sa.Column("inspection_report_s3_key", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_vehicle_details_listing_id", ondelete="CASCADE"),
    )

    # ── job_details ────────────────────────────────────────────────────────────
    op.create_table(
        "job_details",
        sa.Column("listing_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("job_type", sa.String(20), nullable=False),
        sa.Column("salary_min", sa.Numeric(18, 2), nullable=True),
        sa.Column("salary_max", sa.Numeric(18, 2), nullable=True),
        sa.Column("salary_currency", sa.String(3), nullable=True),
        sa.Column("required_skills", ARRAY(sa.Text()), nullable=True),
        sa.Column("application_deadline", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_job_details_listing_id", ondelete="CASCADE"),
        sa.CheckConstraint(
            "job_type IN ('full_time','part_time','contract','remote')",
            name="ck_job_type",
        ),
    )

    # ── job_applications ───────────────────────────────────────────────────────
    op.create_table(
        "job_applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("applicant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cv_s3_key", sa.Text(), nullable=False),
        sa.Column("ai_score", sa.SmallInteger(), nullable=True),
        sa.Column("ai_missing_skills", ARRAY(sa.Text()), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_job_applications_listing_id", ondelete="CASCADE"),
        sa.CheckConstraint(
            "status IN ('pending','shortlisted','rejected','hired')",
            name="ck_application_status",
        ),
    )
    op.create_index("ix_job_applications_listing_id", "job_applications", ["listing_id"])
    op.create_index("ix_job_applications_applicant_id", "job_applications", ["applicant_id"])

    # ── reviews ────────────────────────────────────────────────────────────────
    op.create_table(
        "reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reviewer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.String(2000), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="published"),
        sa.Column("seller_response", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_reviews_listing_id", ondelete="CASCADE"),
        sa.UniqueConstraint("listing_id", "reviewer_id", name="uq_reviews_listing_reviewer"),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating"),
        sa.CheckConstraint("status IN ('published','quarantined')", name="ck_review_status"),
    )
    op.create_index("ix_reviews_listing_id", "reviews", ["listing_id"])

    # ── review_media ───────────────────────────────────────────────────────────
    op.create_table(
        "review_media",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("review_id", UUID(as_uuid=True), nullable=False),
        sa.Column("media_type", sa.String(10), nullable=False),
        sa.Column("s3_key", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], name="fk_review_media_review_id", ondelete="CASCADE"),
        sa.CheckConstraint("media_type IN ('image','video')", name="ck_review_media_type"),
    )
    op.create_index("ix_review_media_review_id", "review_media", ["review_id"])

    # ── stores ─────────────────────────────────────────────────────────────────
    op.create_table(
        "stores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("store_name", sa.String(200), nullable=False),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("banner_url", sa.Text(), nullable=True),
        sa.Column("theme", sa.String(50), nullable=True),
        sa.Column("custom_domain", sa.String(255), nullable=True),
        sa.Column("domain_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("seller_id", name="uq_stores_seller_id"),
    )
    op.create_index("ix_stores_seller_id", "stores", ["seller_id"])
    op.create_index("ix_stores_custom_domain", "stores", ["custom_domain"])

    # ── bookings ───────────────────────────────────────────────────────────────
    op.create_table(
        "bookings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_ref", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], name="fk_bookings_listing_id", ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('pending','confirmed','done','cancelled')",
            name="ck_booking_status",
        ),
    )
    op.create_index("ix_bookings_listing_id", "bookings", ["listing_id"])
    op.create_index("ix_bookings_buyer_id", "bookings", ["buyer_id"])

    # ── review_eligibility ─────────────────────────────────────────────────────
    op.create_table(
        "review_eligibility",
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("listing_id", "buyer_id", name="pk_review_eligibility"),
    )
    op.create_index("ix_review_eligibility_buyer_id", "review_eligibility", ["buyer_id"])


def downgrade() -> None:
    op.drop_table("review_eligibility")
    op.drop_table("bookings")
    op.drop_table("stores")
    op.drop_table("review_media")
    op.drop_table("reviews")
    op.drop_table("job_applications")
    op.drop_table("job_details")
    op.drop_table("vehicle_details")
    op.drop_table("shortlet_availability")
    op.drop_table("property_details")
    op.drop_table("listing_variants")
    op.drop_table("listing_specs")
    op.drop_table("listing_media")
    op.drop_table("listings")
