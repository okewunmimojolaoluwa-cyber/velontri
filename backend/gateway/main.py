"""
Velontri API Gateway — single port 8000, all 14 services in one process.

Strategy: each service directory is loaded as an isolated importlib module
using a unique package name so their `app.*` imports never collide.

Frontend: http://localhost:8000/api/v1/<resource>
Docs:     http://localhost:8000/docs
"""
from __future__ import annotations

import importlib.util
import os
import sys
import types
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

# Apply stubs before any service code runs
from native_stubs import apply_patches  # noqa: E402
apply_patches("gateway")

from shared.errors import register_error_handlers          # noqa: E402
from shared.logging import configure_logging, get_logger   # noqa: E402
from shared.metrics import PrometheusMiddleware, metrics_endpoint  # noqa: E402
from shared.middleware import configure_middleware          # noqa: E402

logger = get_logger(__name__)


# ── Isolated service loader ────────────────────────────────────────────────────

def _load_service_router(svc_dir: str, router_file: str, attr: str = "router"):
    """
    Load a router from `<svc_dir>/app/routers/<router_file>.py`
    without polluting sys.modules["app"] for other services.

    Each service gets its own namespace: `_svc_<name>.routers.<file>`
    All intra-service imports (from app.xxx import yyy) are redirected
    to the service's own namespace.
    """
    svc_path   = ROOT / svc_dir
    pkg_alias  = "_svc_" + svc_dir.replace("-", "_")      # e.g. _svc_auth_service
    app_alias  = pkg_alias + ".app"                        # maps to <svc>/app

    def _ensure_pkg(name: str, path: str) -> types.ModuleType:
        if name not in sys.modules:
            mod = types.ModuleType(name)
            mod.__path__ = [path]
            mod.__package__ = name
            mod.__file__ = os.path.join(path, "__init__.py")
            sys.modules[name] = mod
        return sys.modules[name]

    # Register namespace packages
    _ensure_pkg(pkg_alias, str(svc_path))
    _ensure_pkg(app_alias, str(svc_path / "app"))
    _ensure_pkg(app_alias + ".routers", str(svc_path / "app" / "routers"))

    # Make `from app.xxx import yyy` work inside the service by aliasing "app"
    # We save and restore "app" around the import
    saved_app = sys.modules.get("app")
    sys.modules["app"] = sys.modules[app_alias]

    # Add the service root so its relative imports resolve
    if str(svc_path) not in sys.path:
        sys.path.insert(0, str(svc_path))

    try:
        router_path = svc_path / "app" / "routers" / f"{router_file}.py"
        mod_name    = f"{app_alias}.routers.{router_file}"

        if mod_name not in sys.modules:
            spec = importlib.util.spec_from_file_location(mod_name, str(router_path))
            if spec is None or spec.loader is None:
                raise ImportError(f"Cannot find {router_path}")
            mod = importlib.util.module_from_spec(spec)
            mod.__package__ = f"{app_alias}.routers"
            sys.modules[mod_name] = mod
            spec.loader.exec_module(mod)

        return getattr(sys.modules[mod_name], attr)
    finally:
        # Restore "app" so the next service can use it
        if saved_app is not None:
            sys.modules["app"] = saved_app
        elif "app" in sys.modules:
            del sys.modules["app"]


def _collect_routers():
    collected = []

    SERVICES = [
        # (service_dir,          router_file,    attr,            tag)
        ("auth-service",         "auth",          "router",        "🔐 Auth"),
        ("user-service",         "users",         "router",        "👤 Users"),
        ("marketplace-service",  "listings",      "router",        "🏪 Marketplace"),
        ("search-service",       "search",        "router",        "🔍 Search"),
        ("ai-service",           "ai",            "router",        "🤖 AI"),
        ("chat-service",         "chat",          "router",        "💬 Chat"),
        ("inventory-service",    "inventory",     "router",        "📦 Inventory"),
        ("analytics-service",    "analytics",     "router",        "📊 Analytics"),
        ("notification-service", "notifications", "router",        "🔔 Notifications"),
        ("crm-service",          "crm",           "router",        "🤝 CRM"),
        ("subscription-service", "subscriptions", "router",        "💎 Subscriptions"),
    ]

    for svc_dir, router_file, attr, tag in SERVICES:
        try:
            router = _load_service_router(svc_dir, router_file, attr)
            collected.append((router, tag))
            logger.info("router_ok", service=svc_dir)
        except Exception as exc:
            logger.warning("router_fail", service=svc_dir, error=str(exc))

    # Also mount the user-service internal_router so auth can fetch roles
    try:
        internal_router = _load_service_router("user-service", "users", "internal_router")
        collected.append((internal_router, "🔧 Internal"))
        logger.info("router_ok", service="user-service-internal")
    except Exception as exc:
        logger.warning("router_fail", service="user-service-internal", error=str(exc))

    return collected


# ── Lifespan ───────────────────────────────────────────────────────────────────

async def _apply_pg_migrations(engine) -> None:
    """
    Idempotent additive migrations for PostgreSQL.
    Uses IF NOT EXISTS / DO NOTHING patterns so it is safe to run on every restart.
    """
    from sqlalchemy import text as _text
    stmts = [
        # ── Core User Tables ──────────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS users (
            id              UUID PRIMARY KEY,
            email           TEXT UNIQUE NOT NULL,
            phone           TEXT,
            phone_verified  BOOLEAN DEFAULT TRUE,
            password_hash   TEXT,
            full_name       TEXT,
            country_code    TEXT DEFAULT 'NG',
            is_active       BOOLEAN DEFAULT TRUE,
            is_locked       BOOLEAN DEFAULT FALSE,
            failed_attempts INTEGER DEFAULT 0,
            locked_until    TIMESTAMPTZ,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)",
        """
        CREATE TABLE IF NOT EXISTS user_roles (
            id         UUID PRIMARY KEY,
            user_id    UUID NOT NULL,
            role       TEXT NOT NULL,
            scope_id   UUID,
            granted_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles(user_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_role ON user_roles(user_id, role)",
        # ── Auth & Security ───────────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS devices (
            id              UUID PRIMARY KEY,
            user_id         UUID NOT NULL,
            fingerprint     TEXT NOT NULL,
            ip_address      TEXT,
            user_agent      TEXT,
            last_seen       TIMESTAMPTZ,
            is_trusted      BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, fingerprint)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_devices_user_id ON devices(user_id)",
        """
        CREATE TABLE IF NOT EXISTS login_history (
            id                 UUID PRIMARY KEY,
            user_id            UUID NOT NULL,
            device_fingerprint TEXT,
            ip_address         TEXT,
            success            BOOLEAN,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_login_history_user_id ON login_history(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_login_history_created_at ON login_history(created_at)",
        """
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id                 UUID PRIMARY KEY,
            user_id            UUID NOT NULL,
            token_hash         TEXT UNIQUE NOT NULL,
            device_fingerprint TEXT,
            expires_at         TIMESTAMPTZ NOT NULL,
            revoked            BOOLEAN NOT NULL DEFAULT FALSE,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens(user_id)",
        """
        CREATE TABLE IF NOT EXISTS otp_codes (
            id         UUID PRIMARY KEY,
            user_id    UUID,
            email      TEXT NOT NULL,
            purpose    TEXT NOT NULL,
            otp_hash   TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used       BOOLEAN NOT NULL DEFAULT FALSE,
            attempts   INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_otp_codes_email_purpose ON otp_codes(email, purpose)",
        "CREATE INDEX IF NOT EXISTS ix_otp_codes_user_id_purpose ON otp_codes(user_id, purpose)",
        """
        CREATE TABLE IF NOT EXISTS totp_secrets (
            user_id          UUID PRIMARY KEY,
            secret_encrypted TEXT NOT NULL,
            enabled          BOOLEAN NOT NULL DEFAULT FALSE,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id          UUID PRIMARY KEY,
            user_id     UUID NOT NULL,
            action      TEXT NOT NULL,
            ip_address  TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs(user_id)",
        # ── Marketplace / Listings ────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS listings (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            seller_id       UUID NOT NULL,
            listing_type    TEXT NOT NULL,
            title           TEXT NOT NULL,
            description     TEXT,
            price           NUMERIC(18,2),
            currency        TEXT NOT NULL DEFAULT 'NGN',
            country         TEXT,
            state           TEXT,
            city            TEXT,
            latitude        NUMERIC(9,6),
            longitude       NUMERIC(9,6),
            category        TEXT,
            subcategory     TEXT,
            condition       TEXT,
            brand           TEXT,
            status          TEXT NOT NULL DEFAULT 'draft',
            avg_rating      NUMERIC(3,2) NOT NULL DEFAULT 0,
            review_count    INTEGER NOT NULL DEFAULT 0,
            image_url       TEXT,
            whatsapp_number TEXT,
            contact_phone   TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_listings_seller_id  ON listings(seller_id)",
        "CREATE INDEX IF NOT EXISTS ix_listings_status     ON listings(status)",
        "CREATE INDEX IF NOT EXISTS ix_listings_category   ON listings(category)",
        "CREATE INDEX IF NOT EXISTS ix_listings_created_at ON listings(created_at)",
        """
        CREATE TABLE IF NOT EXISTS listing_media (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            listing_id  UUID NOT NULL,
            media_type  TEXT NOT NULL,
            s3_key      TEXT NOT NULL,
            sort_order  SMALLINT NOT NULL DEFAULT 0,
            uploaded_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_listing_media_listing_id ON listing_media(listing_id)",
        """
        CREATE TABLE IF NOT EXISTS listing_specs (
            listing_id UUID NOT NULL,
            spec_key   TEXT NOT NULL,
            spec_value TEXT NOT NULL,
            PRIMARY KEY (listing_id, spec_key)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS listing_variants (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            listing_id     UUID NOT NULL,
            sku            TEXT NOT NULL UNIQUE,
            attributes     JSONB NOT NULL DEFAULT '{}',
            price          NUMERIC(18,2),
            stock_quantity INTEGER NOT NULL DEFAULT 0
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_listing_variants_listing_id ON listing_variants(listing_id)",
        """
        CREATE TABLE IF NOT EXISTS property_details (
            listing_id        UUID PRIMARY KEY,
            property_type     TEXT NOT NULL,
            bedrooms          SMALLINT,
            bathrooms         SMALLINT,
            area_sqm          NUMERIC(10,2),
            furnishing_status TEXT,
            amenities         TEXT[],
            tour_asset_url    TEXT,
            price_per_night   NUMERIC(18,2)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS vehicle_details (
            listing_id               UUID PRIMARY KEY,
            make                     TEXT,
            model                    TEXT,
            year                     SMALLINT,
            mileage_km               INTEGER,
            fuel_type                TEXT,
            transmission             TEXT,
            colour                   TEXT,
            engine_size_cc           INTEGER,
            vin                      TEXT,
            vin_history_status       TEXT NOT NULL DEFAULT 'pending',
            vin_history_data         JSONB,
            vin_error_reason         TEXT,
            inspection_report_s3_key TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS job_details (
            listing_id           UUID PRIMARY KEY,
            employer_id          UUID NOT NULL,
            job_type             TEXT NOT NULL,
            salary_min           NUMERIC(18,2),
            salary_max           NUMERIC(18,2),
            salary_currency      TEXT,
            required_skills      TEXT[],
            application_deadline DATE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS job_applications (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            listing_id        UUID NOT NULL,
            applicant_id      UUID NOT NULL,
            cv_s3_key         TEXT NOT NULL,
            ai_score          SMALLINT,
            ai_missing_skills TEXT[],
            status            TEXT NOT NULL DEFAULT 'pending',
            reviewed_by       UUID,
            reviewed_at       TIMESTAMPTZ,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_job_apps_listing_id   ON job_applications(listing_id)",
        "CREATE INDEX IF NOT EXISTS ix_job_apps_applicant_id ON job_applications(applicant_id)",
        """
        CREATE TABLE IF NOT EXISTS shortlet_availability (
            listing_id   UUID NOT NULL,
            blocked_date DATE NOT NULL,
            PRIMARY KEY (listing_id, blocked_date)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS stores (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            seller_id       UUID NOT NULL UNIQUE,
            store_name      TEXT NOT NULL,
            logo_url        TEXT,
            banner_url      TEXT,
            theme           TEXT,
            custom_domain   TEXT,
            domain_verified BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_stores_seller_id     ON stores(seller_id)",
        "CREATE INDEX IF NOT EXISTS ix_stores_custom_domain ON stores(custom_domain)",
        """
        CREATE TABLE IF NOT EXISTS reviews (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            listing_id      UUID NOT NULL,
            reviewer_id     UUID NOT NULL,
            rating          SMALLINT NOT NULL,
            comment         TEXT,
            status          TEXT NOT NULL DEFAULT 'published',
            seller_response TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (listing_id, reviewer_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_reviews_listing_id ON reviews(listing_id)",
        """
        CREATE TABLE IF NOT EXISTS review_media (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            review_id  UUID NOT NULL,
            media_type TEXT NOT NULL,
            s3_key     TEXT NOT NULL
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_review_media_review_id ON review_media(review_id)",
        """
        CREATE TABLE IF NOT EXISTS bookings (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            listing_id       UUID NOT NULL,
            buyer_id         UUID NOT NULL,
            seller_id        UUID NOT NULL,
            scheduled_at     TIMESTAMPTZ NOT NULL,
            duration_minutes INTEGER,
            status           TEXT NOT NULL DEFAULT 'pending',
            payment_ref      UUID,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_bookings_listing_id ON bookings(listing_id)",
        "CREATE INDEX IF NOT EXISTS ix_bookings_buyer_id   ON bookings(buyer_id)",
        """
        CREATE TABLE IF NOT EXISTS review_eligibility (
            listing_id UUID NOT NULL,
            buyer_id   UUID NOT NULL,
            order_id   UUID NOT NULL,
            granted_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (listing_id, buyer_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS saved_listings (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            listing_id TEXT NOT NULL,
            saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, listing_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_saved_listings_user_id ON saved_listings(user_id)",
        # ── Subscriptions & Payments ─────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS subscriptions (
            id                     TEXT PRIMARY KEY,
            user_id                TEXT NOT NULL UNIQUE,
            tier                   TEXT NOT NULL DEFAULT 'starter',
            is_active              BOOLEAN NOT NULL DEFAULT TRUE,
            pending_downgrade_tier TEXT,
            current_period_start   TIMESTAMPTZ,
            current_period_end     TIMESTAMPTZ,
            created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_subscriptions_user ON subscriptions(user_id)",
        """
        CREATE TABLE IF NOT EXISTS sub_payments (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            plan       TEXT NOT NULL,
            reference  TEXT NOT NULL,
            amount_ngn INTEGER NOT NULL DEFAULT 0,
            status     TEXT NOT NULL DEFAULT 'success',
            paid_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_sub_pay_user ON sub_payments(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_sub_pay_paid ON sub_payments(paid_at)",
        # ── Notifications & System ───────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            type       TEXT NOT NULL DEFAULT 'system',
            title      TEXT NOT NULL,
            message    TEXT NOT NULL,
            is_read    BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id)",
        """
        CREATE TABLE IF NOT EXISTS platform_config (
            key        TEXT PRIMARY KEY,
            value      TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS password_change_otps (
            user_id    TEXT PRIMARY KEY,
            otp        TEXT NOT NULL,
            new_hash   TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS audit_log (
            id          TEXT PRIMARY KEY,
            actor_id    TEXT,
            actor_email TEXT,
            actor_name  TEXT,
            category    TEXT NOT NULL DEFAULT 'system',
            action      TEXT NOT NULL,
            resource    TEXT,
            resource_id TEXT,
            ip_address  TEXT,
            status      TEXT NOT NULL DEFAULT 'success',
            detail      TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_audit_log_created ON audit_log(created_at)",
        "CREATE INDEX IF NOT EXISTS ix_audit_log_actor   ON audit_log(actor_id)",
        "CREATE INDEX IF NOT EXISTS ix_audit_log_cat     ON audit_log(category)",
        # ── Additive columns (safe on re-run) ────────────────────────────────
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ",
        "ALTER TABLE listings ADD COLUMN IF NOT EXISTS whatsapp_number TEXT",
        "ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_phone TEXT",
        """
        CREATE TABLE IF NOT EXISTS saved_listings (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            listing_id  TEXT NOT NULL,
            saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, listing_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_saved_listings_user_id ON saved_listings(user_id)",
        """
        CREATE TABLE IF NOT EXISTS sub_payments (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            plan        TEXT NOT NULL,
            reference   TEXT NOT NULL,
            amount_ngn  INTEGER NOT NULL DEFAULT 0,
            status      TEXT NOT NULL DEFAULT 'success',
            paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_sub_pay_user ON sub_payments(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_sub_pay_paid ON sub_payments(paid_at)",
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            type        TEXT NOT NULL DEFAULT 'system',
            title       TEXT NOT NULL,
            message     TEXT NOT NULL,
            is_read     BOOLEAN NOT NULL DEFAULT FALSE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id)",
        """
        CREATE TABLE IF NOT EXISTS platform_config (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS password_change_otps (
            user_id     TEXT PRIMARY KEY,
            otp         TEXT NOT NULL,
            new_hash    TEXT NOT NULL,
            expires_at  TIMESTAMPTZ NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS audit_log (
            id          TEXT PRIMARY KEY,
            actor_id    TEXT,
            actor_email TEXT,
            actor_name  TEXT,
            category    TEXT NOT NULL DEFAULT 'system',
            action      TEXT NOT NULL,
            resource    TEXT,
            resource_id TEXT,
            ip_address  TEXT,
            status      TEXT NOT NULL DEFAULT 'success',
            detail      TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_audit_log_created ON audit_log(created_at)",
        "CREATE INDEX IF NOT EXISTS ix_audit_log_actor ON audit_log(actor_id)",
        "CREATE INDEX IF NOT EXISTS ix_audit_log_cat ON audit_log(category)",
        """
        CREATE TABLE IF NOT EXISTS subscriptions (
            id                      TEXT PRIMARY KEY,
            user_id                 TEXT NOT NULL UNIQUE,
            tier                    TEXT NOT NULL DEFAULT 'starter',
            is_active               BOOLEAN NOT NULL DEFAULT TRUE,
            pending_downgrade_tier  TEXT,
            current_period_start    TIMESTAMPTZ,
            current_period_end      TIMESTAMPTZ,
            retry_count             INTEGER NOT NULL DEFAULT 0,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_subscriptions_user ON subscriptions(user_id)",
        # Add retry_count if missing on older deployments
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0",
        """
        CREATE TABLE IF NOT EXISTS invoices (
            id           TEXT PRIMARY KEY,
            user_id      TEXT NOT NULL,
            tier         TEXT NOT NULL,
            amount       NUMERIC(18,2) NOT NULL,
            currency     VARCHAR(3) NOT NULL,
            fx_rate      NUMERIC(18,6),
            status       TEXT NOT NULL DEFAULT 'pending',
            payment_ref  TEXT,
            invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_invoices_user_id ON invoices(user_id)",
    ]
    # Run each statement in its own transaction — one failure never kills the rest
    for stmt in stmts:
        try:
            async with engine.begin() as conn:
                await conn.execute(_text(stmt))
        except Exception:
            pass

    # ── Additive column migrations (safe to run every restart) ────────────────
    additive = [
        # Listings — rejection reason stored so seller can see why it was rejected
        "ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
        # Notifications — add notification-service ORM-compatible columns
        # (the table may already exist from an older migration with different columns)
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_user_id TEXT",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'in_app'",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'system'",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS content TEXT",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 1",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS failure_reason TEXT",
        # Back-fill recipient_user_id from user_id where it is NULL
        "UPDATE notifications SET recipient_user_id = user_id WHERE recipient_user_id IS NULL AND user_id IS NOT NULL",
        # Index for fast per-user notification lookups
        "CREATE INDEX IF NOT EXISTS ix_notifications_recipient ON notifications(recipient_user_id)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_read ON notifications(recipient_user_id, is_read)",
    ]
    # Also make old NOT NULL columns on notifications nullable so new inserts work
    additive += [
        "ALTER TABLE notifications ALTER COLUMN title DROP NOT NULL",
        "ALTER TABLE notifications ALTER COLUMN message DROP NOT NULL",
        "ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL",
        "ALTER TABLE notifications ALTER COLUMN type DROP NOT NULL",
    ]
    # Run each statement in its own transaction — one failure never kills the rest
    for stmt in additive:
        try:
            async with engine.begin() as conn:
                await conn.execute(_text(stmt))
        except Exception:
            pass


async def _auto_seed_admin(engine) -> None:
    """
    Idempotently create the super-admin account on every startup using PostgreSQL.
    Safe to call on every restart — skips if admin already exists.
    """
    import asyncio
    import functools
    import logging
    import uuid as _uuid
    from sqlalchemy import text as _text

    _log = logging.getLogger("velontri.seed")

    try:
        import bcrypt

        email    = "owner@velontri.com"
        phone    = "+2348000000000"
        password = "Owner123!"
        name     = "Velontri Owner"

        loop = asyncio.get_event_loop()
        salt = bcrypt.gensalt()
        pw_hash = await loop.run_in_executor(
            None, functools.partial(bcrypt.hashpw, password.encode(), salt)
        )
        pw_hash_str = pw_hash.decode()

        async with engine.begin() as conn:
            # Ensure minimal tables exist (Alembic manages the full schema)
            await conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    phone TEXT,
                    phone_verified BOOLEAN DEFAULT TRUE,
                    password_hash TEXT,
                    full_name TEXT,
                    country_code TEXT DEFAULT 'NG',
                    is_active BOOLEAN DEFAULT TRUE,
                    is_locked BOOLEAN DEFAULT FALSE,
                    failed_attempts INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            await conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS user_roles (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    scope_id TEXT,
                    granted_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            await conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles(user_id)"
            ))
            await conn.execute(_text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_role ON user_roles(user_id, role)"
            ))

            # Check if admin already exists
            result = await conn.execute(
                _text("SELECT id FROM users WHERE email = :email"), {"email": email}
            )
            row = result.fetchone()
            if row:
                uid = row[0]
                await conn.execute(
                    _text("UPDATE users SET password_hash=:h, is_active=TRUE, is_locked=FALSE, "
                          "failed_attempts=0, phone_verified=TRUE WHERE id=:uid"),
                    {"h": pw_hash_str, "uid": uid},
                )
                role_id = str(_uuid.uuid4())
                await conn.execute(
                    _text("INSERT INTO user_roles (id, user_id, role, granted_at) "
                          "VALUES (:rid, :uid, 'enterprise_admin', NOW()) "
                          "ON CONFLICT (user_id, role) DO NOTHING"),
                    {"rid": role_id, "uid": uid},
                )
                _log.info(f"auto_seed: admin password refreshed id={uid} email={email}")
                return

            uid     = str(_uuid.uuid4())
            role_id = str(_uuid.uuid4())
            await conn.execute(
                _text("""INSERT INTO users
                   (id, email, phone, phone_verified, password_hash, full_name,
                    country_code, is_active, is_locked, failed_attempts, created_at)
                   VALUES (:id, :email, :phone, TRUE, :pw, :name, 'NG', TRUE, FALSE, 0, NOW())"""),
                {"id": uid, "email": email, "phone": phone, "pw": pw_hash_str, "name": name},
            )
            await conn.execute(
                _text("INSERT INTO user_roles (id, user_id, role, granted_at) "
                      "VALUES (:rid, :uid, 'enterprise_admin', NOW()) "
                      "ON CONFLICT (user_id, role) DO NOTHING"),
                {"rid": role_id, "uid": uid},
            )
            _log.info(f"auto_seed: admin created id={uid} email={email}")

    except Exception as exc:
        import logging as _logging
        _logging.getLogger("velontri.seed").warning(f"auto_seed_failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:  # type: ignore[misc]
    configure_logging("velontri-gateway", "1.0.0", "development", "INFO")
    logger.info("gateway_starting")

    from shared.database import Base, create_engine, dispose_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker

    import os as _os
    database_url = _os.environ.get("DATABASE_URL", "postgresql+asyncpg://velontri:velontri@localhost:5432/velontri")
    engine = create_engine(database_url)

    # Run additive PostgreSQL migrations (safe to run every startup)
    await _apply_pg_migrations(engine)

    # Auto-seed admin account on every startup (idempotent — skips if exists)
    await _auto_seed_admin(engine)

    app.state.engine = engine
    app.state.session_factory = async_sessionmaker(
        bind=engine, autocommit=False, autoflush=False, expire_on_commit=False
    )

    # ── Redis (graceful fallback to in-memory stub) ────────────────────────
    pool = None
    try:
        from shared.redis_client import close_redis_pool, create_redis_pool, get_redis_client
        redis_url = _os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        pool = create_redis_pool(redis_url)
        app.state.redis      = get_redis_client(pool)
        app.state.redis_pool = pool
        logger.info("redis_connected")
    except Exception as _re:
        logger.warning(f"redis_unavailable: {_re} — using in-memory stub")
        # native_stubs already patches redis so this branch handles Render free tier
        app.state.redis      = None
        app.state.redis_pool = None

    # ── RabbitMQ (graceful fallback to no-op stub) ─────────────────────────
    mq = None
    ch = None
    try:
        from shared.rabbitmq import connect_with_backoff, setup_infrastructure
        rabbitmq_url = _os.environ.get("RABBITMQ_URL", "amqp://velontri:velontri@localhost:5672/")
        mq = await connect_with_backoff(rabbitmq_url)
        ch = await mq.channel()
        await setup_infrastructure(ch)
        app.state.rabbitmq_connection = mq
        app.state.rabbitmq_channel    = ch
        logger.info("rabbitmq_connected")
    except Exception as _mq:
        logger.warning(f"rabbitmq_unavailable: {_mq} — using no-op stub")
        app.state.rabbitmq_connection = None
        app.state.rabbitmq_channel    = None

    # ── Elasticsearch (graceful fallback — SQLite search used instead) ─────
    import httpx
    es_client = None
    try:
        from elasticsearch import AsyncElasticsearch
        es_url = _os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
        es_client = AsyncElasticsearch(hosts=[es_url])
        app.state.es_client = es_client
        logger.info("elasticsearch_connected")
    except Exception as _es:
        logger.warning(f"elasticsearch_unavailable: {_es} — SQLite search fallback active")
        app.state.es_client = None

    app.state.http_client = httpx.AsyncClient(timeout=30.0)

    logger.info("gateway_ready")

    # ── Subscription expiry background task ────────────────────────────────
    import asyncio as _asyncio

    async def _expiry_loop():
        # Wait 30 seconds after startup to let all tables get created
        await _asyncio.sleep(30)
        _run_expiry = None
        while True:
            try:
                import importlib
                if _run_expiry is None:
                    mod = importlib.import_module(
                        "_svc_subscription_service.app.routers.subscriptions"
                    )
                    _run_expiry = getattr(mod, "_enforce_subscription_expiry", None)
                if _run_expiry:
                    await _run_expiry(app.state.session_factory)
            except Exception as e:
                logger.warning(f"expiry_check_error: {e}")
            await _asyncio.sleep(6 * 3600)

    _expiry_task = _asyncio.create_task(_expiry_loop())

    yield

    _expiry_task.cancel()
    try:
        await _expiry_task
    except _asyncio.CancelledError:
        pass

    await app.state.http_client.aclose()
    if es_client:
        try: await es_client.close()
        except Exception: pass
    if ch:
        try: await ch.close()
        except Exception: pass
    if mq:
        try: await mq.close()
        except Exception: pass
    if pool:
        try:
            from shared.redis_client import close_redis_pool as _cp
            await _cp(pool)
        except Exception: pass
    await dispose_engine(engine)


# ── App ────────────────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="Velontri Commerce Platform",
        description=(
            "**All 14 microservices — one port.**\n\n"
            "Base URL: `http://localhost:8000/api/v1`\n\n"
            "Auth: `Authorization: Bearer <token>` (get token from `POST /api/v1/auth/login`)"
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    configure_middleware(app)
    app.add_middleware(PrometheusMiddleware)
    register_error_handlers(app)

    for router, tag in _collect_routers():
        app.include_router(router, prefix="/api/v1")
        app.include_router(router)

    @app.get("/", include_in_schema=False)
    async def root():
        """Friendly landing page for the Velontri API."""
        return JSONResponse({
            "service": "Velontri Commerce Platform API",
            "status": "live 🚀",
            "version": "1.0.0",
            "endpoints": {
                "api": "/api/v1",
                "docs": "/docs",
                "health": "/health",
                "redoc": "/redoc",
                "seed": "/seed-admin",
            },
            "description": "Africa's marketplace — 14 microservices, one port.",
        })

    @app.get("/version", include_in_schema=False)
    async def version():
        import subprocess, os as _os
        try:
            commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(ROOT)).decode().strip()[:8]
        except Exception:
            commit = "unknown"
        return JSONResponse({
            "commit": commit,
            "database_url": str(app.state.engine.url).split("@")[-1] if hasattr(app.state, "engine") else "not set",
            "root": str(ROOT),
            "cwd": _os.getcwd(),
        })

    @app.get("/debug-admin", include_in_schema=False)
    async def debug_admin():
        """Debug endpoint — shows admin row state using PostgreSQL."""
        import asyncio, functools, bcrypt as _bcrypt
        from sqlalchemy import text as _text
        try:
            sf = app.state.session_factory
            engine_url = str(app.state.engine.url)
            async with sf() as sess:
                r = await sess.execute(_text(
                    "SELECT id, email, is_active, is_locked, failed_attempts, "
                    "length(password_hash) as hash_len, substr(password_hash,1,7) as hash_prefix "
                    "FROM users WHERE lower(email)='owner@velontri.com'"
                ))
                row_data = r.mappings().fetchone()
                row = dict(row_data) if row_data else {}

                roles_r = await sess.execute(_text(
                    "SELECT role FROM user_roles WHERE user_id=("
                    "SELECT id FROM users WHERE lower(email)='owner@velontri.com')"
                ))
                roles = [r[0] for r in roles_r.fetchall()]

                if row_data:
                    full_hash = (await sess.execute(_text(
                        "SELECT password_hash FROM users WHERE lower(email)='owner@velontri.com'"
                    ))).scalar()
                    loop = asyncio.get_event_loop()
                    match = await loop.run_in_executor(
                        None, functools.partial(_bcrypt.checkpw, b"Owner123!", full_hash.encode())
                    )
                    row["bcrypt_verify"] = match

                cnt = (await sess.execute(_text("SELECT COUNT(*) FROM users"))).scalar()

            return JSONResponse({
                "engine_url": engine_url.split("@")[-1],
                "admin_row": row,
                "roles": roles,
                "total_users": cnt,
            })
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/seed-admin", include_in_schema=False)
    async def seed_admin():
        """
        Creates/refreshes the super admin account using PostgreSQL.
        Call this once after first deploy: https://velontri.onrender.com/seed-admin
        """
        import asyncio, functools, uuid as _uuid, logging, bcrypt
        from sqlalchemy import text as _text

        _log = logging.getLogger(__name__)
        try:
            await _auto_seed_admin(app.state.engine)
            return JSONResponse({
                "status": "ok",
                "message": "✅ Admin account created/refreshed.",
                "credentials": {"email": "owner@velontri.com", "password": "Owner123!"},
                "next": "Login at your frontend /login page with these credentials",
            })
        except Exception as e:
            _log.error(f"seed_admin_error: {e}")
            return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

    @app.get("/api/v1", tags=["Gateway"], summary="API base — single URL for all services")
    async def api_root():
        return {
            "service": "velontri-gateway",
            "version": "1.0.0",
            "base_url": "/api/v1",
            "docs": "/docs",
            "services": [
                "auth", "users", "listings", "search", "ai", "chat",
                "payments", "wallet", "inventory", "logistics",
                "analytics", "notifications", "crm", "subscriptions",
            ],
        }

    @app.get("/health", include_in_schema=False)
    async def health():
        return JSONResponse({
            "service": "velontri-gateway",
            "version": "1.0.0",
            "status": "ok",
            "base_url": "/api/v1",
            "docs": "/docs",
        })

    app.add_route("/metrics", metrics_endpoint, methods=["GET"])
    return app


app = create_app()
