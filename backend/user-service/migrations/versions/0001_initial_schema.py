"""Initial user service schema.

Revision ID: 0001
Revises:
Create Date: 2026-06-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: str | None = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── profiles ───────────────────────────────────────────────────────────────
    op.create_table(
        "profiles",
        sa.Column("user_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("profile_photo_url", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("default_currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("trust_badge", sa.String(20), nullable=False, server_default="none"),
        sa.Column("subscription_tier", sa.String(20), nullable=False, server_default="starter"),
        sa.Column("registered_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.CheckConstraint(
            "trust_badge IN ('none','bronze','silver','gold','diamond')",
            name="ck_profiles_trust_badge"
        ),
        sa.CheckConstraint(
            "default_currency IN ('NGN','GHS','KES','ZAR','XOF')",
            name="ck_profiles_currency"
        ),
        sa.CheckConstraint(
            "subscription_tier IN ('starter','growth','pro','enterprise')",
            name="ck_profiles_tier"
        ),
    )
    op.create_index("ix_profiles_email", "profiles", ["email"])

    # ── user_roles ─────────────────────────────────────────────────────────────
    op.create_table(
        "user_roles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("scope_id", UUID(as_uuid=True), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.CheckConstraint(
            "role IN ('buyer','seller','agent','branch_manager','business_owner','enterprise_admin')",
            name="ck_user_roles_role"
        ),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"])

    # ── businesses ─────────────────────────────────────────────────────────────
    op.create_table(
        "businesses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("business_name", sa.String(200), nullable=False),
        sa.Column("registration_number", sa.String(100), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_businesses_owner_user_id", "businesses", ["owner_user_id"])

    # ── branches ───────────────────────────────────────────────────────────────
    op.create_table(
        "branches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_name", sa.String(200), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"],
                                name="fk_branches_business_id"),
    )
    op.create_index("ix_branches_business_id", "branches", ["business_id"])

    # ── branch_staff ───────────────────────────────────────────────────────────
    op.create_table(
        "branch_staff",
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"],
                                name="fk_branch_staff_branch_id"),
    )
    op.create_index("ix_branch_staff_user_id", "branch_staff", ["user_id"])

    # ── kyc_documents ──────────────────────────────────────────────────────────
    op.create_table(
        "kyc_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("s3_key", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.CheckConstraint(
            "document_type IN ('government_id','business_registration')",
            name="ck_kyc_document_type"
        ),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected')",
            name="ck_kyc_status"
        ),
    )
    op.create_index("ix_kyc_documents_user_id", "kyc_documents", ["user_id"])


def downgrade() -> None:
    op.drop_table("kyc_documents")
    op.drop_table("branch_staff")
    op.drop_table("branches")
    op.drop_table("businesses")
    op.drop_table("user_roles")
    op.drop_table("profiles")
