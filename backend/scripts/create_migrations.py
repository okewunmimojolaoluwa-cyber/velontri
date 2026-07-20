"""
Creates all Alembic migrations/env.py and versions/0001 for every service
that doesn't already have one.  Run from project root.
"""
import pathlib, textwrap

ROOT = pathlib.Path(__file__).parent.parent

ENV_PY = textwrap.dedent('''\
    """Alembic env for {service}."""
    from __future__ import annotations
    import asyncio, os
    from alembic import context
    from sqlalchemy.ext.asyncio import create_async_engine
    from app.models import Base  # noqa: F401

    config = context.config
    target_metadata = Base.metadata
    DATABASE_URL = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url", ""))

    def run_migrations_offline() -> None:
        context.configure(url=DATABASE_URL, target_metadata=target_metadata, literal_binds=True, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()

    def do_run(connection) -> None:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()

    async def run_async() -> None:
        engine = create_async_engine(DATABASE_URL, echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(do_run)
        await engine.dispose()

    def run_migrations_online() -> None:
        asyncio.run(run_async())

    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()
    ''')

# service → (upgrade SQL, downgrade tables list)
SERVICES = {
    "wallet-service": (
        """\
    op.create_table(
        "wallets",
        sa.Column("user_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("balance", sa.Numeric(18, 2), nullable=False, server_default="0", comment="CHECK balance>=0"),
        sa.Column("held_balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("rewards_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("balance >= 0", name="ck_wallets_balance"),
        sa.CheckConstraint("held_balance >= 0", name="ck_wallets_held"),
        sa.CheckConstraint("rewards_points >= 0", name="ck_wallets_rewards"),
    )
    op.create_table(
        "wallet_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("wallet_user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(18, 2), nullable=False),
        sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["wallet_user_id"], ["wallets.user_id"], name="fk_wt_wallet"),
        sa.CheckConstraint("amount > 0", name="ck_wt_amount"),
        sa.CheckConstraint("balance_after >= 0", name="ck_wt_balance_after"),
    )
    op.create_index("ix_wallet_transactions_user", "wallet_transactions", ["wallet_user_id"])
    op.create_index("ix_wallet_transactions_created", "wallet_transactions", ["created_at"])""",
        ["wallet_transactions", "wallets"],
    ),
    "payment-service": (
        """\
    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("fee_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("gateway", sa.String(20), nullable=False),
        sa.Column("gateway_ref", sa.String(255), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("escrow_held_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_release_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("order_id", name="uq_payments_order_id"),
        sa.CheckConstraint("status IN ('pending','processing','held_in_escrow','released','refunded','failed')", name="ck_payment_status"),
    )
    op.create_index("ix_payments_buyer_id", "payments", ["buyer_id"])
    op.create_index("ix_payments_seller_id", "payments", ["seller_id"])
    op.create_table(
        "disputes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("payment_id", UUID(as_uuid=True), nullable=False),
        sa.Column("raised_by", UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("resolved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.id"], name="fk_disputes_payment"),
    )
    op.create_table(
        "fraud_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("payment_id", UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Numeric(5, 4), nullable=True),
        sa.Column("model_version", sa.String(50), nullable=True),
        sa.Column("rejected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("scored_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.id"], name="fk_fraud_payment"),
    )""",
        ["fraud_scores", "disputes", "payments"],
    ),
    "inventory-service": (
        """\
    op.create_table(
        "stock_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False),
        sa.Column("quantity_on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quantity_reserved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quantity_damaged", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_threshold", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("barcode_s3_key", sa.Text(), nullable=True),
        sa.Column("qr_code_s3_key", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("sku", "branch_id", name="uq_stock_sku_branch"),
        sa.CheckConstraint("quantity_on_hand >= 0", name="ck_stock_on_hand"),
        sa.CheckConstraint("quantity_reserved >= 0", name="ck_stock_reserved"),
        sa.CheckConstraint("quantity_damaged >= 0", name="ck_stock_damaged"),
    )
    op.create_index("ix_stock_records_branch_id", "stock_records", ["branch_id"])
    op.create_table(
        "stock_transfers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("from_branch_id", UUID(as_uuid=True), nullable=False),
        sa.Column("to_branch_id", UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("initiated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("confirmed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("quantity > 0", name="ck_transfer_quantity"),
    )
    op.create_table(
        "stock_damage",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False),
        sa.Column("quantity_damaged", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("recorded_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("quantity_damaged > 0", name="ck_damage_qty"),
    )
    op.create_table(
        "stock_movements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False),
        sa.Column("movement_type", sa.String(30), nullable=False),
        sa.Column("quantity_delta", sa.Integer(), nullable=False),
        sa.Column("quantity_after", sa.Integer(), nullable=False),
        sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("quantity_after >= 0", name="ck_movement_after"),
    )
    op.create_index("ix_stock_movements_sku_branch", "stock_movements", ["sku", "branch_id"])""",
        ["stock_movements", "stock_damage", "stock_transfers", "stock_records"],
    ),
    "marketplace-service": (
        """\
    op.create_table("listings",
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
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("ix_listings_seller_id", "listings", ["seller_id"])
    op.create_index("ix_listings_status", "listings", ["status"])
    op.create_table("stores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("store_name", sa.String(200), nullable=False),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("banner_url", sa.Text(), nullable=True),
        sa.Column("theme", sa.String(50), nullable=True),
        sa.Column("custom_domain", sa.String(255), nullable=True),
        sa.Column("domain_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("seller_id", name="uq_stores_seller"),
    )
    op.create_table("reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reviewer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.String(2000), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="published"),
        sa.Column("seller_response", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("listing_id", "reviewer_id", name="uq_reviews_listing_reviewer"),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating"),
    )
    op.create_table("bookings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_ref", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_table("review_eligibility",
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("listing_id", "buyer_id"),
    )""",
        ["review_eligibility", "bookings", "reviews", "stores", "listings"],
    ),
    "crm-service": (
        """\
    op.create_table("customer_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("first_contact_date", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_spend", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("buyer_id", "seller_id", name="uq_crm_buyer_seller"),
    )
    op.create_index("ix_crm_seller_id", "customer_records", ["seller_id"])
    op.create_table("customer_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_record_id", UUID(as_uuid=True), nullable=False),
        sa.Column("note", sa.String(1000), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["customer_record_id"], ["customer_records.id"], name="fk_notes_record"),
    )
    op.create_table("customer_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_record_id", UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("order_date", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("order_id", name="uq_customer_order_id"),
        sa.ForeignKeyConstraint(["customer_record_id"], ["customer_records.id"], name="fk_orders_record"),
    )""",
        ["customer_orders", "customer_notes", "customer_records"],
    ),
    "subscription-service": (
        """\
    op.create_table("subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False, server_default="starter"),
        sa.Column("pending_downgrade_tier", sa.String(20), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("user_id", name="uq_subscriptions_user"),
        sa.CheckConstraint("tier IN ('starter','growth','pro','enterprise')", name="ck_sub_tier"),
    )
    op.create_table("invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("fx_rate", sa.Numeric(18, 6), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_ref", sa.Text(), nullable=True),
        sa.Column("invoice_date", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("ix_invoices_user_id", "invoices", ["user_id"])""",
        ["invoices", "subscriptions"],
    ),
    "notification-service": (
        """\
    op.create_table("notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recipient_user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("notification_type", sa.String(100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("channel IN ('push','sms','email','whatsapp')", name="ck_notif_channel"),
        sa.CheckConstraint("status IN ('pending','sent','failed')", name="ck_notif_status"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["recipient_user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_table("notification_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("push_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sms_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("whatsapp_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_notif_pref_user_id", "notification_preferences", ["user_id"])""",
        ["notification_preferences", "notifications"],
    ),
    "analytics-service": (
        """\
    op.create_table("order_facts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=True),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("order_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("order_id", name="uq_order_facts_order_id"),
    )
    op.create_index("ix_order_facts_seller_id", "order_facts", ["seller_id"])
    op.create_index("ix_order_facts_branch_id", "order_facts", ["branch_id"])
    op.create_index("ix_order_facts_order_date", "order_facts", ["order_date"])""",
        ["order_facts"],
    ),
    "logistics-service": (
        """\
    op.create_table("shipments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("carrier", sa.String(30), nullable=False),
        sa.Column("tracking_number", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="created"),
        sa.Column("origin_address", sa.JSON(), nullable=False),
        sa.Column("destination_address", sa.JSON(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(8, 3), nullable=True),
        sa.Column("dimensions_cm", sa.JSON(), nullable=True),
        sa.Column("estimated_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("proof_asset_url", sa.Text(), nullable=True),
        sa.Column("proof_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("carrier_tracking_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("carrier IN ('gig','dhl','fedex','local_rider')", name="ck_shipment_carrier"),
    )
    op.create_index("ix_shipments_order_id", "shipments", ["order_id"])
    op.create_index("ix_shipments_tracking", "shipments", ["tracking_number"])
    op.create_table("shipment_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("shipment_id", UUID(as_uuid=True), nullable=False),
        sa.Column("carrier_status", sa.String(100), nullable=False),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.id"], name="fk_events_shipment"),
    )
    op.create_index("ix_shipment_events_shipment_id", "shipment_events", ["shipment_id"])""",
        ["shipment_events", "shipments"],
    ),
    "chat-service": (
        """\
    op.create_table("threads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("participant_a", UUID(as_uuid=True), nullable=False),
        sa.Column("participant_b", UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("participant_a", "participant_b", "listing_id", name="uq_thread_participants"),
    )
    op.create_index("ix_threads_participant_a", "threads", ["participant_a"])
    op.create_index("ix_threads_participant_b", "threads", ["participant_b"])
    op.create_table("messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("thread_id", UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", UUID(as_uuid=True), nullable=False),
        sa.Column("message_type", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("media_s3_key", sa.Text(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["thread_id"], ["threads.id"], name="fk_messages_thread"),
    )
    op.create_index("ix_messages_thread_id", "messages", ["thread_id"])
    op.create_table("message_queue",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recipient_id", UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", UUID(as_uuid=True), nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], name="fk_queue_message"),
    )
    op.create_index("ix_message_queue_recipient_id", "message_queue", ["recipient_id"])""",
        ["message_queue", "messages", "threads"],
    ),
}

for svc, (upgrade_sql, drop_tables) in SERVICES.items():
    svc_path = ROOT / svc
    mig_path = svc_path / "migrations"
    ver_path = mig_path / "versions"
    ver_path.mkdir(parents=True, exist_ok=True)

    # migrations/__init__.py
    (mig_path / "__init__.py").write_text("")

    # migrations/env.py
    (mig_path / "env.py").write_text(ENV_PY.format(service=svc))

    # migrations/versions/0001_initial_schema.py
    drop_sql = "\n    ".join(f'op.drop_table("{t}")' for t in drop_tables)
    migration_content = f'''"""Initial {svc} schema.

Revision ID: 0001
Revises:
Create Date: 2026-06-07
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
{upgrade_sql}


def downgrade() -> None:
    {drop_sql}
'''
    (ver_path / "0001_initial_schema.py").write_text(migration_content)
    print(f"✓ {svc} migrations created")

print("\nAll migrations created.")
