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

# ── Canonical DB path — ALWAYS absolute, computed from __file__ ───────────────
# Never use a relative path (./dev_gateway.db) which depends on cwd.
# We honour SQLITE_DB_PATH only if it's an explicit absolute path set externally.
_sqlite_db_env = os.environ.get("SQLITE_DB_PATH", "").strip()
_CANONICAL_DB = (
    _sqlite_db_env
    if (_sqlite_db_env and os.path.isabs(_sqlite_db_env))
    else str(ROOT / "velontri.db")
)
# Export so every aiosqlite caller in this process uses the same file
os.environ["SQLITE_DB_PATH"] = _CANONICAL_DB

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
        ("payment-service",      "payments",      "router",        "💳 Payments"),
        ("wallet-service",       "wallet",        "router",        "👛 Wallet"),
        ("inventory-service",    "inventory",     "router",        "📦 Inventory"),
        ("logistics-service",    "logistics",     "router",        "🚚 Logistics"),
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

def _apply_sqlite_migrations(conn) -> None:  # type: ignore[type-arg]
    """
    Idempotent additive migrations for SQLite dev DB.
    Each statement is wrapped in try/except so it's safe to run on every startup.
    """
    cursor = conn.connection.cursor()

    # ── Additive column migrations ─────────────────────────────────────────────
    additive = [
        "ALTER TABLE listings ADD COLUMN image_url TEXT",
        "ALTER TABLE users ADD COLUMN full_name TEXT",
        "ALTER TABLE users ADD COLUMN phone TEXT",
        "ALTER TABLE users ADD COLUMN country_code TEXT DEFAULT 'NG'",
        "ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1",
        "ALTER TABLE users ADD COLUMN is_phone_verified INTEGER DEFAULT 0",
        # is_locked — required NOT NULL; default 0 (not locked)
        "ALTER TABLE users ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN locked_until DATETIME",
        # WhatsApp contact field on listings
        "ALTER TABLE listings ADD COLUMN whatsapp_number TEXT",
        "ALTER TABLE listings ADD COLUMN contact_phone TEXT",
        # Saved listings table created separately below
    ]
    for sql in additive:
        try:
            cursor.execute(sql)
        except Exception:
            pass

    # ── Create saved_listings table if it doesn't exist ───────────────────
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS saved_listings (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                listing_id  TEXT NOT NULL,
                saved_at    TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(user_id, listing_id)
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_saved_listings_user_id ON saved_listings(user_id)"
        )
    except Exception:
        pass

    # ── Fix user_roles CheckConstraint to allow 'moderator' role ──────────────
    # SQLite doesn't support DROP CONSTRAINT, so we recreate the table without it.
    # We check if the current table has the old restrictive constraint first.
    try:
        # Try inserting a test moderator role (will fail if constraint is too strict)
        # Use a known-safe test approach: check the CREATE TABLE statement
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_roles'")
        row = cursor.fetchone()
        if row and row[0] and "'moderator'" not in row[0]:
            # Constraint is present without 'moderator' — recreate table
            cursor.execute("PRAGMA foreign_keys=OFF")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_roles_new (
                    id         TEXT PRIMARY KEY,
                    user_id    TEXT NOT NULL,
                    role       TEXT NOT NULL,
                    scope_id   TEXT,
                    granted_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            cursor.execute("""
                INSERT OR IGNORE INTO user_roles_new (id, user_id, role, scope_id, granted_at)
                SELECT id, user_id, role, scope_id,
                       COALESCE(granted_at, created_at, datetime('now'))
                FROM user_roles
            """)
            cursor.execute("DROP TABLE user_roles")
            cursor.execute("ALTER TABLE user_roles_new RENAME TO user_roles")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles(user_id)")
            cursor.execute("PRAGMA foreign_keys=ON")
    except Exception:
        pass  # table may not exist yet — will be created by metadata.create_all

    # ── Create sub_payments table for Paystack subscription revenue ───────
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sub_payments (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                plan        TEXT NOT NULL,
                reference   TEXT NOT NULL,
                amount_ngn  INTEGER NOT NULL DEFAULT 0,
                status      TEXT NOT NULL DEFAULT 'success',
                paid_at     TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_sub_pay_user ON sub_payments(user_id)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_sub_pay_paid ON sub_payments(paid_at)"
        )
    except Exception:
        pass

    # ── Create notifications table for in-app user notifications ─────────
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                type        TEXT NOT NULL DEFAULT 'system',
                title       TEXT NOT NULL,
                message     TEXT NOT NULL,
                is_read     INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id)"
        )
    except Exception:
        pass

    # ── Create platform_config table for maintenance mode / settings ──────
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS platform_config (
                key         TEXT PRIMARY KEY,
                value       TEXT NOT NULL,
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
    except Exception:
        pass

    # ── Create password_change_otps table for OTP-verified password changes ──
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_change_otps (
                user_id     TEXT PRIMARY KEY,
                otp         TEXT NOT NULL,
                new_hash    TEXT NOT NULL,
                expires_at  TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
    except Exception:
        pass

    # ── Create audit_log table for admin audit trail ───────────────────────
    try:
        cursor.execute("""
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
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_audit_log_created ON audit_log(created_at)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_audit_log_actor ON audit_log(actor_id)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_audit_log_cat ON audit_log(category)"
        )
    except Exception:
        pass

    # ── Create subscriptions table for the subscription service ──────────
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id                  TEXT PRIMARY KEY,
                user_id             TEXT NOT NULL UNIQUE,
                tier                TEXT NOT NULL DEFAULT 'starter',
                is_active           INTEGER NOT NULL DEFAULT 1,
                pending_downgrade_tier TEXT,
                current_period_start TEXT,
                current_period_end   TEXT,
                created_at          TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_subscriptions_user ON subscriptions(user_id)"
        )
    except Exception:
        pass

    conn.connection.commit()


async def _auto_seed_admin(db_file: str) -> None:
    """
    Idempotently create the super-admin account on every startup.
    Uses aiosqlite directly so it works even before the ORM session factory
    is fully initialised.  Safe to call on every restart — skips if exists.
    """
    import asyncio
    import functools
    import logging
    import uuid as _uuid

    _log = logging.getLogger("velontri.seed")

    try:
        import bcrypt
        import aiosqlite

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

        async with aiosqlite.connect(db_file) as db:
            db.row_factory = aiosqlite.Row

            # Ensure tables exist
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    phone TEXT,
                    phone_verified INTEGER DEFAULT 1,
                    password_hash TEXT,
                    full_name TEXT,
                    country_code TEXT DEFAULT 'NG',
                    is_active INTEGER DEFAULT 1,
                    is_locked INTEGER DEFAULT 0,
                    failed_attempts INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS user_roles (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    scope_id TEXT,
                    granted_at TEXT DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles(user_id);
                CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_role ON user_roles(user_id, role);
            """)
            await db.commit()

            # Check if admin already exists
            rows = await db.execute_fetchall(
                "SELECT id FROM users WHERE email = ?", [email]
            )
            if rows:
                uid = rows[0]["id"]
                # Always refresh password hash + unlock — fixes stale hashes from old seeds
                await db.execute(
                    "UPDATE users SET password_hash=?, is_active=1, is_locked=0, "
                    "failed_attempts=0, phone_verified=1 WHERE id=?",
                    [pw_hash_str, uid],
                )
                role_id = str(_uuid.uuid4())
                await db.execute(
                    "INSERT OR IGNORE INTO user_roles (id, user_id, role, granted_at) "
                    "VALUES (?,?,'enterprise_admin',datetime('now'))",
                    [role_id, uid],
                )
                await db.commit()
                _log.info(f"auto_seed: admin password refreshed id={uid} email={email}")
                return

            uid     = str(_uuid.uuid4())
            role_id = str(_uuid.uuid4())

            await db.execute(
                """INSERT INTO users
                   (id, email, phone, phone_verified, password_hash, full_name,
                    country_code, is_active, is_locked, failed_attempts, created_at)
                   VALUES (?,?,?,1,?,?,'NG',1,0,0,datetime('now'))""",
                [uid, email, phone, pw_hash_str, name],
            )
            await db.execute(
                "INSERT OR IGNORE INTO user_roles (id, user_id, role, granted_at) "
                "VALUES (?,?,'enterprise_admin',datetime('now'))",
                [role_id, uid],
            )
            await db.commit()
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
    # Use the module-level canonical DB path — computed from __file__, not cwd
    _db_file = _CANONICAL_DB
    engine = create_engine(f"sqlite+aiosqlite:///{_db_file}")

    def _safe_create_all(conn: Any) -> None:
        """Create all tables, silently ignoring 'already exists' errors for indexes."""
        from sqlalchemy import text as _text
        # Create each table individually with checkfirst=True to skip existing tables
        for table in Base.metadata.sorted_tables:
            try:
                table.create(conn, checkfirst=True)
            except Exception:
                pass  # table/index already exists — safe to ignore
        # Ensure indexes exist using IF NOT EXISTS
        for stmt in [
            "CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)",
            "CREATE INDEX IF NOT EXISTS ix_users_phone ON users (phone)",
            "CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_token_hash ON refresh_tokens (token_hash)",
            "CREATE INDEX IF NOT EXISTS ix_devices_user_id ON devices (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_login_history_user_id ON login_history (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_login_history_created_at ON login_history (created_at)",
            "CREATE INDEX IF NOT EXISTS ix_otps_user_id_purpose ON otps (user_id, purpose)",
            "CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at)",
        ]:
            try:
                conn.execute(_text(stmt))
            except Exception:
                pass

    async with engine.begin() as conn:
        await conn.run_sync(_safe_create_all)
        await conn.run_sync(_apply_sqlite_migrations)

    # Auto-seed admin account on every startup (idempotent — skips if exists)
    await _auto_seed_admin(_db_file)

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
            "db_path_env": _os.environ.get("SQLITE_DB_PATH", "NOT_SET"),
            "root": str(ROOT),
            "cwd": _os.getcwd(),
        })

    @app.get("/debug-admin", include_in_schema=False)
    async def debug_admin():
        """Temporary debug endpoint — shows admin row state and tests login path."""
        import aiosqlite, os as _os, bcrypt as _bcrypt, asyncio, functools
        _db_file = _CANONICAL_DB
        try:
            async with aiosqlite.connect(_db_file) as db:
                db.row_factory = aiosqlite.Row
                rows = await db.execute_fetchall(
                    "SELECT id, email, is_active, is_locked, failed_attempts, "
                    "length(password_hash) as hash_len, substr(password_hash,1,7) as hash_prefix "
                    "FROM users WHERE email='owner@velontri.com'"
                )
                roles = await db.execute_fetchall(
                    "SELECT role FROM user_roles WHERE user_id=("
                    "SELECT id FROM users WHERE email='owner@velontri.com')"
                )
                row = dict(rows[0]) if rows else {}

                # Test bcrypt verify
                if rows:
                    full_hash = (await db.execute_fetchall(
                        "SELECT password_hash FROM users WHERE email='owner@velontri.com'"
                    ))[0][0]
                    loop = asyncio.get_event_loop()
                    match = await loop.run_in_executor(
                        None, functools.partial(
                            _bcrypt.checkpw, b"Owner123!", full_hash.encode()
                        )
                    )
                    row["bcrypt_verify"] = match

                # Test ORM path
                orm_result = "untested"
                try:
                    from sqlalchemy import text as _text
                    sf = app.state.session_factory
                    # Get the actual DB URL the engine is connected to
                    engine_url = str(app.state.engine.url)
                    async with sf() as sess:
                        r = await sess.execute(
                            _text("SELECT id, email, password_hash, is_active FROM users WHERE lower(email)='owner@velontri.com'")
                        )
                        r2 = r.fetchone()
                        # Also count total users in ORM DB
                        cnt = (await sess.execute(_text("SELECT COUNT(*) FROM users"))).scalar()
                        orm_result = {
                            "engine_url": engine_url,
                            "found": r2 is not None,
                            "total_users_in_orm_db": cnt,
                            "is_active": bool(r2[3]) if r2 else None,
                            "hash_prefix": str(r2[2])[:7] if r2 else None,
                        }
                except Exception as orm_e:
                    orm_result = f"error: {orm_e}"

                return JSONResponse({
                    "db_file": _db_file,
                    "admin_row": row,
                    "roles": [dict(r) for r in roles],
                    "orm_direct_sql": orm_result,
                })
        except Exception as e:
            return JSONResponse({"error": str(e), "db_file": _db_file})

    @app.get("/seed-admin", include_in_schema=False)
    async def seed_admin():
        """
        Creates the super admin account if it doesn't exist.
        Call this once after first deploy: https://velontri.onrender.com/seed-admin
        """
        import aiosqlite
        import uuid as _uuid
        import asyncio
        import functools
        import logging

        _log = logging.getLogger(__name__)
        _db_file = _CANONICAL_DB  # use the module-level canonical path
        try:
            import bcrypt
            email    = "owner@velontri.com"
            phone    = "+2348000000000"
            password = "Owner123!"
            name     = "Velontri Owner"

            loop = asyncio.get_event_loop()
            salt = bcrypt.gensalt()
            pw_hash = await loop.run_in_executor(
                None,
                functools.partial(bcrypt.hashpw, password.encode(), salt)
            )
            pw_hash_str = pw_hash.decode()

            async with aiosqlite.connect(_db_file) as db:
                db.row_factory = aiosqlite.Row

                # Ensure tables exist (idempotent)
                await db.executescript("""
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        phone TEXT,
                        phone_verified INTEGER DEFAULT 0,
                        password_hash TEXT,
                        full_name TEXT,
                        country_code TEXT DEFAULT 'NG',
                        is_active INTEGER DEFAULT 1,
                        is_locked INTEGER DEFAULT 0,
                        failed_attempts INTEGER DEFAULT 0,
                        created_at TEXT DEFAULT (datetime('now'))
                    );
                    CREATE TABLE IF NOT EXISTS user_roles (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        scope_id TEXT,
                        granted_at TEXT DEFAULT (datetime('now'))
                    );
                    CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles(user_id);
                """)
                await db.commit()

                # Check if admin already exists
                rows = await db.execute_fetchall(
                    "SELECT id, email FROM users WHERE email = ?", [email]
                )
                if rows:
                    uid = rows[0]["id"]
                    # Force-refresh password hash — fixes any stale/corrupt hash
                    await db.execute(
                        "UPDATE users SET password_hash=?, is_active=1, is_locked=0, "
                        "failed_attempts=0, phone_verified=1 WHERE id=?",
                        [pw_hash_str, uid],
                    )
                    role_id = str(_uuid.uuid4())
                    await db.execute(
                        "INSERT OR IGNORE INTO user_roles (id, user_id, role, granted_at) "
                        "VALUES (?,?,'enterprise_admin',datetime('now'))",
                        [role_id, uid],
                    )
                    await db.commit()
                    _log.info(f"seed_admin: password refreshed id={uid}")
                    return JSONResponse({
                        "status": "refreshed",
                        "message": f"✅ Admin password reset. You can now log in.",
                        "credentials": {"email": email, "password": password},
                    })

                uid = str(_uuid.uuid4())
                role_id = str(_uuid.uuid4())

                await db.execute(
                    """INSERT INTO users (id, email, phone, phone_verified, password_hash, full_name,
                       country_code, is_active, is_locked, failed_attempts, created_at)
                       VALUES (?,?,?,1,?,?,?,1,0,0,datetime('now'))""",
                    [uid, email, phone, pw_hash_str, name, "NG"]
                )

                await db.execute(
                    "INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (?,?,'enterprise_admin',datetime('now'))",
                    [role_id, uid]
                )

                await db.commit()
                _log.info(f"seed_admin: created id={uid}")

            return JSONResponse({
                "status": "created",
                "message": "✅ Admin account created successfully!",
                "credentials": {
                    "email": email,
                    "password": password,
                    "role": "super_admin",
                },
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
