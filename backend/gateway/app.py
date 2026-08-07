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

async def _auto_seed_admin(session_factory: Any) -> None:
    """Idempotently create the super-admin account on every startup."""
    import logging
    import uuid as _uuid
    import bcrypt
    from sqlalchemy import text as _text

    _log = logging.getLogger("velontri.seed")
    email = "owner@velontri.com"
    phone = "+2348000000000"
    password = "Owner123!"
    name = "Velontri Owner"

    try:
        salt = bcrypt.gensalt()
        pw_hash = bcrypt.hashpw(password.encode(), salt).decode()

        async with session_factory() as sess:
            res = await sess.execute(_text("SELECT id FROM users WHERE email = :email"), {"email": email})
            row = res.fetchone()
            if row:
                uid = row[0]
                await sess.execute(
                    _text("UPDATE users SET password_hash=:ph, is_active=true, is_locked=false, failed_attempts=0, phone_verified=true WHERE id=:uid"),
                    {"ph": pw_hash, "uid": uid}
                )
                
                # Check role
                res_role = await sess.execute(
                    _text("SELECT id FROM user_roles WHERE user_id=:uid AND role='enterprise_admin'"),
                    {"uid": uid}
                )
                if not res_role.fetchone():
                    await sess.execute(
                        _text("INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (:rid, :uid, 'enterprise_admin', CURRENT_TIMESTAMP)"),
                        {"rid": str(_uuid.uuid4()), "uid": uid}
                    )
                await sess.commit()
                _log.info(f"auto_seed: admin refreshed id={uid} email={email}")
                return

            uid = str(_uuid.uuid4())
            await sess.execute(
                _text("""INSERT INTO users 
                    (id, email, phone, phone_verified, password_hash, full_name, country_code, is_active, is_locked, failed_attempts) 
                    VALUES (:uid, :email, :phone, true, :ph, :name, 'NG', true, false, 0)"""),
                {"uid": uid, "email": email, "phone": phone, "ph": pw_hash, "name": name}
            )
            await sess.execute(
                _text("INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (:rid, :uid, 'enterprise_admin', CURRENT_TIMESTAMP)"),
                {"rid": str(_uuid.uuid4()), "uid": uid}
            )
            await sess.commit()
            _log.info(f"auto_seed: admin created id={uid} email={email}")

    except Exception as exc:
        _log.warning(f"auto_seed_failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:  # type: ignore[misc]
    configure_logging("velontri-gateway", "1.0.0", "development", "INFO")
    logger.info("gateway_starting")

    from shared.database import Base, create_engine, dispose_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    import os as _os

    # Use PostgreSQL DB
    from shared.config import BaseServiceSettings
    settings = BaseServiceSettings()
    
    engine = create_engine(settings.DATABASE_URL)

    app.state.engine = engine
    app.state.session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, autocommit=False, autoflush=False, expire_on_commit=False
    )

    # Auto-seed admin account on every startup
    await _auto_seed_admin(app.state.session_factory)

    # ── Ensure critical tables exist (idempotent DDL) ─────────────────────
    try:
        async with engine.begin() as _conn:
            await _conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS listing_media (
                    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    listing_id   UUID NOT NULL,
                    media_type   VARCHAR(20) NOT NULL CHECK (media_type IN ('image','video','tour_360')),
                    s3_key       TEXT NOT NULL,
                    sort_order   SMALLINT NOT NULL DEFAULT 0,
                    uploaded_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            await _conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_listing_media_listing_id ON listing_media(listing_id)"
            ))
            await _conn.execute(_text("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='listings' AND column_name='image_url'
                    ) THEN
                        ALTER TABLE listings ADD COLUMN image_url TEXT;
                    END IF;
                END $$
            """))
            # ── Chat ──────────────────────────────────────────────────────
            await _conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS threads (
                    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    participant_a TEXT NOT NULL,
                    participant_b TEXT NOT NULL,
                    listing_id    TEXT,
                    created_at    TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            await _conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_threads_a ON threads(participant_a)"
            ))
            await _conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_threads_b ON threads(participant_b)"
            ))
            await _conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS messages (
                    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    thread_id    UUID NOT NULL,
                    sender_id    TEXT NOT NULL,
                    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
                    content      TEXT NOT NULL,
                    media_s3_key TEXT,
                    read_at      TIMESTAMPTZ,
                    created_at   TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            await _conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_messages_thread ON messages(thread_id)"
            ))
            # ── Notifications ─────────────────────────────────────────────
            await _conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id    UUID NOT NULL,
                    type       VARCHAR(50) NOT NULL DEFAULT 'system',
                    title      TEXT NOT NULL,
                    message    TEXT NOT NULL,
                    data       JSONB,
                    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            await _conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id)"
            ))
            # ── Platform config & notifications ───────────────────────────
            await _conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS platform_config (
                    key        TEXT PRIMARY KEY,
                    value      TEXT NOT NULL,
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            await _conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS platform_notifications (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title           TEXT NOT NULL,
                    content         TEXT NOT NULL,
                    target_audience TEXT NOT NULL DEFAULT 'all',
                    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
                    created_by      TEXT,
                    created_at      TIMESTAMPTZ DEFAULT NOW()
                )
            """))
        logger.info("db_schema_ensured")
    except Exception as _te:
        logger.warning(f"db_schema_ensure_failed: {_te}")

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

    # ── Keep-warm task — pings self every 8 minutes to prevent Render cold starts ──
    async def _keep_warm_loop():
        await _asyncio.sleep(60)  # let startup finish first
        while True:
            try:
                async with httpx.AsyncClient(timeout=10.0) as _kw:
                    await _kw.get(f"http://127.0.0.1:{_os.environ.get('PORT', '10000')}/health")
                logger.debug("keep_warm_ping_ok")
            except Exception as _kw_err:
                logger.debug(f"keep_warm_ping_skip: {_kw_err}")
            await _asyncio.sleep(8 * 60)  # every 8 minutes

    _warm_task = _asyncio.create_task(_keep_warm_loop())

    yield

    _expiry_task.cancel()
    _warm_task.cancel()
    try:
        await _expiry_task
    except _asyncio.CancelledError:
        pass
    try:
        await _warm_task
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
        engine_url = str(app.state.engine.url) if hasattr(app.state, "engine") else "not_set"
        return JSONResponse({
            "commit": commit,
            "engine_url": engine_url,
            "root": str(ROOT),
            "cwd": _os.getcwd(),
            "entry_file": __file__,
        })

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
