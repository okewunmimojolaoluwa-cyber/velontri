"""
Native development stubs — patch shared infrastructure so all 14 Velontri
services start without Docker, PostgreSQL, Redis, or RabbitMQ.

Replacements:
  PostgreSQL  → SQLite (aiosqlite)
  Redis       → in-process dict
  RabbitMQ    → no-op stubs
  elasticsearch → fake module
  PostgreSQL types (INET, JSONB, ARRAY, UUID) → SQLite-compatible shims
"""
from __future__ import annotations

import os
import sys
import time
import types
import uuid as _uuid_mod
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ── Environment injection ─────────────────────────────────────────────────────

def _load_dot_env(root: Path) -> None:
    """Load backend/.env into os.environ — real env vars take precedence."""
    env_file = root / ".env"
    if not env_file.exists():
        return
    with open(env_file, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            eq = line.find("=")
            if eq == -1:
                continue
            key = line[:eq].strip()
            val = line[eq + 1:].strip()
            if key and key not in os.environ:
                os.environ[key] = val


def _inject_env(svc_name: str) -> None:
    db = svc_name.replace("-service", "").replace("-", "_")
    _e = os.environ.setdefault
    _e("SERVICE_NAME",            svc_name)
    _e("SERVICE_VERSION",         "1.0.0")
    _e("ENVIRONMENT",             "development")
    _e("DATABASE_URL",            f"sqlite+aiosqlite:///./dev_{db}.db")
    _e("REDIS_URL",               "redis://localhost:6379/0")
    _e("RABBITMQ_URL",            "amqp://velontri:velontri@localhost:5672/")
    _e("AWS_S3_BUCKET",           "velontri-local")
    _e("AWS_REGION",              "af-south-1")
    _e("AWS_ACCESS_KEY_ID",       "minioadmin")
    _e("AWS_SECRET_ACCESS_KEY",   "minioadmin")
    _e("LOG_LEVEL",               "WARNING")
    _e("DEBUG",                   "false")
    _e("JWT_PUBLIC_KEY_PATH",     str(ROOT / "secrets" / "jwt_public_key.pem"))
    _e("JWT_PRIVATE_KEY_PATH",    str(ROOT / "secrets" / "jwt_private_key.pem"))
    _e("TOTP_ENCRYPTION_KEY",     "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=")
    _e("FX_PROVIDER_URL",         "https://api.exchangerate.host/latest")
    _e("FX_CACHE_TTL",            "14400")
    _e("CASHBACK_STARTER",        "0")
    _e("CASHBACK_GROWTH",         "1")
    _e("CASHBACK_PRO",            "2")
    _e("CASHBACK_ENTERPRISE",     "3")
    _e("REWARDS_REDEMPTION_RATE", "0.1")
    _e("REWARDS_POINTS_PER_1000", "10")
    _e("OPENAI_API_KEY",          "")
    _e("OPENAI_MODEL",            "gpt-4o-mini")
    _e("MAX_CONVERSATION_TURNS",  "20")
    _e("SESSION_TTL_SECONDS",     "7200")
    _e("AFRICASTALKING_API_KEY",  "")
    _e("AFRICASTALKING_USERNAME", "sandbox")
    _e("GOOGLE_CLIENT_ID",        os.environ.get("GOOGLE_CLIENT_ID", ""))
    _e("AFRICASTALKING_SENDER_ID","Velontri")
    _e("SENDGRID_API_KEY",        os.environ.get("SENDGRID_API_KEY", ""))
    _e("RESEND_API_KEY",          os.environ.get("RESEND_API_KEY", ""))
    _e("EMAIL_FROM",              os.environ.get("EMAIL_FROM", "no-reply@velontri.com"))
    _e("EMAIL_FROM_NAME",         os.environ.get("EMAIL_FROM_NAME", "Velontri"))
    _e("GMAIL_USER",              os.environ.get("GMAIL_USER", ""))
    _e("GMAIL_APP_PASSWORD",      os.environ.get("GMAIL_APP_PASSWORD", ""))
    _e("WHATSAPP_API_URL",        "")
    _e("WHATSAPP_TOKEN",          "")
    _e("FCM_SERVER_KEY",          "")
    _e("MAX_DELIVERY_RETRIES",    "3")
    _e("PAYSTACK_SECRET_KEY",     "")
    _e("FLUTTERWAVE_SECRET_KEY",  "")
    _e("MPESA_CONSUMER_KEY",      "")
    _e("MPESA_CONSUMER_SECRET",   "")
    _e("ESCROW_AUTO_RELEASE_HOURS","72")
    _e("FRAUD_SCORE_THRESHOLD",   "0.85")
    _e("GIG_API_URL",             "")
    _e("GIG_API_KEY",             "")
    _e("DHL_API_URL",             "")
    _e("DHL_API_KEY",             "")
    _e("FEDEX_API_URL",           "")
    _e("FEDEX_API_KEY",           "")
    _e("VIN_LOOKUP_PROVIDER_URL", "")
    _e("VIN_LOOKUP_API_KEY",      "")
    _e("GOOGLE_CLIENT_ID",        "")
    _e("GOOGLE_CLIENT_SECRET",    "")
    _e("APPLE_CLIENT_ID",         "")
    _e("APPLE_TEAM_ID",           "")
    _e("APPLE_KEY_ID",            "")
    _e("APPLE_PRIVATE_KEY",       "")
    # In gateway mode every service runs in-process on port 8000 — route
    # inter-service HTTP calls through the same base URL.
    _gateway = "http://127.0.0.1:8000/api/v1"
    _svc_base = _gateway if svc_name == "gateway" else None

    _e("NOTIFICATION_SERVICE_URL", _svc_base or "http://localhost:8012")
    _e("BILLING_DAY",             "1")
    _e("RETRY_DELAY_HOURS_1",     "24")
    _e("RETRY_DELAY_HOURS_2",     "48")
    _e("AI_SERVICE_URL",          _svc_base or "http://localhost:8005")
    _e("WALLET_SERVICE_URL",      _svc_base or "http://localhost:8008")
    _e("USER_SERVICE_URL",        _svc_base or "http://localhost:8002")
    _e("SEARCH_SERVICE_URL",      _svc_base or "http://localhost:8004")
    _e("PAYMENT_SERVICE_URL",     _svc_base or "http://localhost:8007")
    _e("MARKETPLACE_SERVICE_URL", _svc_base or "http://localhost:8003")


# ── Fake Redis ────────────────────────────────────────────────────────────────

class FakeRedis:
    def __init__(self):
        self._s: dict[str, tuple[Any, float | None]] = {}

    def _ok(self, k: str) -> bool:
        if k in self._s:
            _, exp = self._s[k]
            if exp and time.monotonic() > exp:
                del self._s[k]
                return False
            return True
        return False

    async def get(self, k: str):
        if not self._ok(k): return None
        v = self._s[k][0]
        return v.encode() if isinstance(v, str) else v

    async def set(self, k, v, ex=None):
        self._s[k] = (v, time.monotonic() + ex if ex else None)

    async def setex(self, k, ttl, v): await self.set(k, v, ex=ttl)

    async def delete(self, *keys):
        n = sum(1 for k in keys if self._s.pop(k, None) is not None)
        return n

    async def exists(self, *keys):
        return sum(1 for k in keys if self._ok(k))

    async def incr(self, k):
        raw = await self.get(k)
        n = int(raw) + 1 if raw else 1
        self._s[k] = (str(n), self._s[k][1] if k in self._s else None)
        return n

    async def expire(self, k, ttl):
        if k in self._s:
            self._s[k] = (self._s[k][0], time.monotonic() + ttl)
            return True
        return False

    async def zadd(self, k, m):
        d = dict(self._s.get(k, ({}, None))[0])
        d.update(m)
        self._s[k] = (d, None)
        return len(m)

    async def zcard(self, k):
        return len(self._s.get(k, ({}, None))[0]) if k in self._s else 0

    async def zremrangebyscore(self, k, mn, mx):
        if k not in self._s: return 0
        d = self._s[k][0]
        rm = [i for i, v in d.items() if
              (mn == "-inf" or v >= float(mn)) and (mx == "+inf" or v <= float(mx))]
        for i in rm: del d[i]
        return len(rm)

    def pipeline(self): return _FakePipe(self)
    async def close(self): pass
    async def ping(self): return True


class _FakePipe:
    def __init__(self, r): self._r = r; self._q = []
    def __aenter__(self):
        async def _e(): return self
        return _e()
    def __aexit__(self, *a):
        async def _x(*a): return False
        return _x(*a)
    def zremrangebyscore(self, k, a, b): self._q.append(("zrbs", k, a, b)); return self
    def zcard(self, k): self._q.append(("zcard", k)); return self
    def zadd(self, k, m): self._q.append(("zadd", k, m)); return self
    def expire(self, k, t): self._q.append(("exp", k, t)); return self
    async def execute(self):
        res = []
        for c in self._q:
            if c[0] == "zrbs": res.append(await self._r.zremrangebyscore(c[1], c[2], c[3]))
            elif c[0] == "zcard": res.append(await self._r.zcard(c[1]))
            elif c[0] == "zadd": res.append(await self._r.zadd(c[1], c[2]))
            elif c[0] == "exp": res.append(await self._r.expire(c[1], c[2]))
            else: res.append(None)
        return res


# ── Fake RabbitMQ ─────────────────────────────────────────────────────────────

class _FakeExchange:
    async def publish(self, *a, **kw): pass

class _FakeQueue:
    async def bind(self, *a, **kw): pass
    async def consume(self, *a, **kw): pass

class _FakeChannel:
    async def declare_exchange(self, *a, **kw): pass
    async def declare_queue(self, *a, **kw): return _FakeQueue()
    async def get_exchange(self, *a, **kw): return _FakeExchange()
    async def set_qos(self, *a, **kw): pass
    async def close(self): pass
    is_closed = False

class _FakeConn:
    is_closed = False
    async def channel(self): return _FakeChannel()
    async def close(self): pass


# ── Fake Elasticsearch ────────────────────────────────────────────────────────

class _FakeIndices:
    async def exists(self, *a, **kw): return False
    async def create(self, *a, **kw): pass
    async def put_mapping(self, *a, **kw): pass

class _FakeES:
    def __init__(self, *a, **kw): pass
    async def index(self, *a, **kw): pass
    async def update(self, *a, **kw): pass
    async def delete(self, *a, **kw): pass
    async def search(self, *a, **kw):
        return {"hits": {"total": {"value": 0}, "hits": []}}
    async def close(self): pass
    async def ping(self): return True
    indices = property(lambda self: _FakeIndices())

class _FakeESNotFound(Exception): pass
class _FakeESException(Exception): pass


# ── Main patch function ───────────────────────────────────────────────────────

def apply_patches(svc_name: str = "dev-service") -> None:
    _load_dot_env(ROOT)
    _inject_env(svc_name)

    # ── Set canonical SQLite DB path for all inline aiosqlite calls ───────────
    # If SQLITE_DB_PATH is already set (e.g. by Render env), keep it.
    # Otherwise default to dev_gateway.db at the backend root.
    if "SQLITE_DB_PATH" not in os.environ:
        os.environ["SQLITE_DB_PATH"] = str(ROOT / "dev_gateway.db")

    # ── Register fake elasticsearch BEFORE any service imports it ─────────────
    if "elasticsearch" not in sys.modules:
        _esm = types.ModuleType("elasticsearch")
        _esm.AsyncElasticsearch = _FakeES
        _esm.NotFoundError = _FakeESNotFound
        _esm.ElasticsearchException = _FakeESException
        sys.modules["elasticsearch"] = _esm
    if "elasticsearch.exceptions" not in sys.modules:
        _exm = types.ModuleType("elasticsearch.exceptions")
        _exm.ElasticsearchException = _FakeESException
        _exm.NotFoundError = _FakeESNotFound
        sys.modules["elasticsearch.exceptions"] = _exm

    # ── Patch PostgreSQL dialect types → SQLite-compatible ────────────────────
    from sqlalchemy import String, Text, types as sa_types
    from sqlalchemy.dialects import postgresql as pg

    class _INET(String):
        def __init__(self, *a, **kw): super().__init__(45)

    class _JSONB(Text):
        pass

    class _ARRAY(Text):
        def __init__(self, *a, **kw): super().__init__()

    class _UUID(sa_types.TypeDecorator):
        impl = sa_types.String(36)
        cache_ok = True
        def __init__(self, *a, **kw): kw.pop('as_uuid', None); super().__init__()
        def process_bind_param(self, v, d):
            return None if v is None else str(v)
        def process_result_value(self, v, d):
            if v is None: return None
            try: return _uuid_mod.UUID(str(v))
            except Exception: return v

    pg.INET  = _INET
    pg.JSONB = _JSONB
    pg.ARRAY = _ARRAY
    pg.UUID  = _UUID

    # ── Patch config validators to accept any URL ─────────────────────────────
    import shared.config as cfg
    cfg.BaseServiceSettings.validate_database_url = classmethod(lambda cls, v: v)
    cfg.BaseServiceSettings.validate_redis_url    = classmethod(lambda cls, v: v)
    cfg.BaseServiceSettings.validate_rabbitmq_url = classmethod(lambda cls, v: v)

    # Clear lru_cache on any get_settings functions already imported
    for mod in sys.modules.values():
        fn = getattr(mod, "get_settings", None)
        if fn and hasattr(fn, "cache_clear"):
            try: fn.cache_clear()
            except Exception: pass

    # ── Patch RabbitMQ ────────────────────────────────────────────────────────
    import shared.rabbitmq as mq
    mq.connect_with_backoff = lambda *a, **kw: _async(_FakeConn())
    mq.setup_infrastructure = lambda *a, **kw: _async(None)
    mq.publish_event        = lambda *a, **kw: _async(None)
    mq.consume_events       = lambda *a, **kw: _async(None)

    # ── Patch Redis ───────────────────────────────────────────────────────────
    import shared.redis_client as rc
    _fr = FakeRedis()
    rc.create_redis_pool  = lambda *a, **kw: _fr
    rc.get_redis_client   = lambda pool, *a, **kw: pool
    rc.check_redis_health = lambda *a, **kw: _async(True)
    rc.close_redis_pool   = lambda *a, **kw: _async(None)

    # ── Stub aioboto3 to prevent blocking network calls on import ─────────────
    if "aioboto3" not in sys.modules:
        _aioboto3 = types.ModuleType("aioboto3")

        class _FakeSession:
            def __init__(self, *a, **kw): pass
            def client(self, *a, **kw): return self
            def resource(self, *a, **kw): return self
            def __aenter__(self): return self
            def __aexit__(self, *a): return self

        _aioboto3.Session = _FakeSession
        sys.modules["aioboto3"] = _aioboto3

    # ── Patch database → SQLite ───────────────────────────────────────────────
    import shared.database as db
    from sqlalchemy.ext.asyncio import create_async_engine as _cae
    db_name = svc_name.replace("-service", "").replace("-", "_")
    _url = f"sqlite+aiosqlite:///./dev_{db_name}.db"
    db.create_engine = lambda *a, **kw: _cae(_url, echo=False, connect_args={"check_same_thread": False})

    # ── Remove DateTime server_defaults incompatible with SQLite ─────────────
    # SQLite returns CURRENT_TIMESTAMP as a string; SQLAlchemy cannot parse it
    # back to datetime. We clear all DateTime server_defaults — Python-side
    # defaults (default=datetime.utcnow) handle timestamping instead.
    from sqlalchemy import Column as _Column, DateTime as _DateTime
    from sqlalchemy.sql.sqltypes import DateTime as _DateTimeType

    _orig_col_init = _Column.__init__

    def _patched_col_init(self, *args, **kwargs):
        # Detect DateTime type in args or type_ kwarg
        type_arg = kwargs.get("type_") or (args[1] if len(args) > 1 else None)
        is_datetime = isinstance(type_arg, _DateTimeType)

        if is_datetime:
            # Remove any server_default — use Python-side default only
            kwargs.pop("server_default", None)

        # Also strip gen_random_uuid server_defaults for UUID columns
        sd = kwargs.get("server_default")
        if sd is not None:
            sd_str = str(sd)
            if any(pg in sd_str for pg in ("gen_random_uuid", "CURRENT_TIMESTAMP", "NOW()", "char_length")):
                kwargs["server_default"] = None

        _orig_col_init(self, *args, **kwargs)

    _Column.__init__ = _patched_col_init  # type: ignore[method-assign]

    # Patch CheckConstraint to replace PG-only expressions with 1=1
    from sqlalchemy.sql import schema as _schema

    _PG_ONLY_EXPRS = ("gen_random_uuid", "char_length", "CURRENT_TIMESTAMP", "NOW()", "gen_rand")

    _orig_cc_init = _schema.CheckConstraint.__init__

    def _safe_cc_init(self, sqltext, *args, **kwargs):
        text_str = str(sqltext) if sqltext is not None else ""
        if any(pg in text_str for pg in _PG_ONLY_EXPRS):
            _orig_cc_init(self, "1=1", *args, **kwargs)
        else:
            _orig_cc_init(self, sqltext, *args, **kwargs)

    _schema.CheckConstraint.__init__ = _safe_cc_init

    import sqlalchemy as _sa_top
    _sa_top.CheckConstraint.__init__ = _safe_cc_init


def _async(val):
    """Return an awaitable that resolves to val."""
    async def _coro():
        return val
    return _coro()
