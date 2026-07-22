"""Subscription Service router — uses Authorization: Bearer JWT."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from shared.auth import get_user_id, get_user_payload
from shared.errors import SuccessResponse

from ..models import TIER_ENTITLEMENTS
from ..repository import get_invoices, get_or_create_subscription, upgrade_subscription

router = APIRouter(tags=["Subscriptions"])


@router.get(
    "/subscriptions/tiers",
    response_model=SuccessResponse,
    summary="List all subscription tiers with entitlements",
)
async def list_tiers() -> SuccessResponse:
    return SuccessResponse(
        message="Subscription tiers retrieved.",
        data=TIER_ENTITLEMENTS,
    )


@router.get(
    "/subscriptions/me",
    response_model=SuccessResponse,
    summary="Get current user's subscription and entitlements",
)
async def get_my_subscription(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    user_id = uuid.UUID(payload["sub"])
    session = request.app.state.session_factory()
    try:
        sub = await get_or_create_subscription(session, user_id)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
    entitlements = TIER_ENTITLEMENTS.get(sub.tier, TIER_ENTITLEMENTS["starter"])
    return SuccessResponse(
        message="Subscription retrieved.",
        data={
            "tier": sub.tier,
            "is_active": sub.is_active,
            "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "entitlements": entitlements,
        },
    )


@router.post(
    "/subscriptions/upgrade",
    response_model=SuccessResponse,
    summary="Upgrade subscription tier",
)
async def upgrade(
    request: Request,
    new_tier: str = Query(..., pattern="^(growth|pro|enterprise)$"),
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    user_id = uuid.UUID(payload["sub"])
    session = request.app.state.session_factory()
    try:
        sub = await upgrade_subscription(
            session, user_id, new_tier, request.app.state.rabbitmq_channel
        )
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
    return SuccessResponse(
        message=f"Subscription upgraded to {new_tier}.",
        data={"tier": sub.tier, "is_active": sub.is_active},
    )


@router.post(
    "/subscriptions/downgrade",
    response_model=SuccessResponse,
    summary="Schedule a subscription downgrade at end of billing cycle",
)
async def downgrade(
    request: Request,
    new_tier: str = Query(..., pattern="^(starter|growth|pro)$"),
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    """Schedules a downgrade — effective at end of current billing cycle."""
    user_id = uuid.UUID(payload["sub"])
    session = request.app.state.session_factory()
    try:
        sub = await get_or_create_subscription(session, user_id)
        sub.pending_downgrade_tier = new_tier
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
    return SuccessResponse(
        message=f"Downgrade to '{new_tier}' scheduled for end of billing cycle.",
        data={"current_tier": sub.tier, "pending_downgrade_tier": new_tier},
    )


@router.get(
    "/subscriptions/invoices",
    response_model=SuccessResponse,
    summary="Paginated invoice history for current user",
)
async def list_invoices(
    request: Request,
    page: int = Query(default=1, ge=1),
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    user_id = uuid.UUID(payload["sub"])
    session = request.app.state.session_factory()
    try:
        invoices = await get_invoices(session, user_id, page)
    finally:
        await session.close()
    data = [
        {
            "id": str(i.id),
            "tier": i.tier,
            "amount": str(i.amount),
            "currency": i.currency,
            "fx_rate": str(i.fx_rate) if i.fx_rate else None,
            "status": i.status,
            "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
        }
        for i in invoices
    ]
    return SuccessResponse(
        message="Invoices retrieved.",
        data=data,
        meta={"page": page, "count": len(data)},
    )


# ── Paystack subscription payment endpoints ───────────────────────────────────

# Plan prices in kobo (NGN × 100)
PLAN_PRICES_KOBO = {
    "starter":    250_000,   # ₦2,500
    "business":   750_000,   # ₦7,500
}

# Maps our plan IDs to the tier names the subscription service uses
PLAN_TO_TIER = {
    "starter":    "growth",   # our 'starter' maps to subscription tier 'growth'
    "business":   "pro",      # our 'business' maps to subscription tier 'pro'
    "enterprise": "enterprise",
}


@router.post(
    "/subscriptions/paystack/initiate",
    response_model=SuccessResponse,
    summary="Initiate a Paystack subscription payment",
)
async def paystack_initiate(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)],
) -> SuccessResponse:
    """
    Creates a Paystack payment link for a subscription upgrade.
    Body: { plan: 'starter' | 'business', callback_url: 'https://...' }
    Returns: { authorization_url, reference, access_code }
    """
    import os
    import httpx
    import secrets as _secrets
    import logging
    from shared.errors import InvalidInputError, ExternalServiceError

    log = logging.getLogger(__name__)

    body = await request.json()
    plan_id: str = (body.get("plan") or "").strip().lower()
    callback_url: str = body.get("callback_url") or ""

    if plan_id not in PLAN_PRICES_KOBO:
        raise InvalidInputError(f"Plan must be one of: {list(PLAN_PRICES_KOBO.keys())}")
    if not callback_url:
        raise InvalidInputError("callback_url is required")

    user_id = payload["sub"]
    # JWT sub is the user ID; email may not be in the token so fetch from DB
    user_email = (payload.get("email") or "").strip()
    if not user_email:
        try:
            import aiosqlite
            from pathlib import Path
            db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
            async with aiosqlite.connect(str(db_path)) as db:
                rows = await db.execute_fetchall(
                    "SELECT email FROM users WHERE id = ?", [user_id]
                )
                if rows:
                    user_email = rows[0][0] or ""
        except Exception as e:
            log.warning(f"email_lookup_failed: {e}")
    if not user_email:
        user_email = f"{user_id}@velontri.user"

    amount_kobo = PLAN_PRICES_KOBO[plan_id]
    reference = f"vlt-sub-{plan_id}-{_secrets.token_hex(8)}"

    secret_key = os.environ.get("PAYSTACK_SECRET_KEY", "").strip()
    log.info(f"paystack_initiate plan={plan_id} email={user_email} key_set={bool(secret_key)}")

    if not secret_key:
        raise ExternalServiceError(
            "PAYSTACK_SECRET_KEY is not configured. "
            "Add it to backend/.env — get your key at dashboard.paystack.com"
        )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.paystack.co/transaction/initialize",
                headers={
                    "Authorization": f"Bearer {secret_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "email": user_email,
                    "amount": amount_kobo,
                    "reference": reference,
                    "callback_url": callback_url,
                    "metadata": {
                        "user_id": user_id,
                        "plan": plan_id,
                        "custom_fields": [
                            {"display_name": "Plan", "variable_name": "plan", "value": plan_id},
                        ],
                    },
                },
            )
        data = resp.json()
        log.info(f"paystack_response status={data.get('status')} message={data.get('message')}")
        if not data.get("status"):
            raise ExternalServiceError(
                f"Paystack error: {data.get('message', 'Unknown error')} (HTTP {resp.status_code})"
            )
        return SuccessResponse(
            message="Payment link created.",
            data={
                "authorization_url": data["data"]["authorization_url"],
                "reference": data["data"]["reference"],
                "access_code": data["data"]["access_code"],
                "plan": plan_id,
            },
        )
    except ExternalServiceError:
        raise
    except Exception as exc:
        log.error(f"paystack_initiate_exception: {type(exc).__name__}: {exc}")
        raise ExternalServiceError(f"Failed to create Paystack payment: {type(exc).__name__}: {exc}") from exc

@router.post(
    "/subscriptions/paystack/verify",
    response_model=SuccessResponse,
    summary="Verify a Paystack payment and activate the subscription",
)
async def paystack_verify(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)],
) -> SuccessResponse:
    """
    Verifies a Paystack transaction by reference, then activates the plan.
    Body: { reference: 'vlt-sub-starter-abc123', plan: 'starter' }
    """
    import os
    import httpx
    from shared.errors import InvalidInputError, ExternalServiceError

    body = await request.json()
    reference: str = (body.get("reference") or "").strip()
    plan_id: str = (body.get("plan") or "").strip().lower()

    if not reference:
        raise InvalidInputError("reference is required")
    if plan_id not in PLAN_TO_TIER:
        raise InvalidInputError(f"Plan must be one of: {list(PLAN_TO_TIER.keys())}")

    secret_key = os.environ.get("PAYSTACK_SECRET_KEY", "").strip()
    if not secret_key:
        raise ExternalServiceError("PAYSTACK_SECRET_KEY not configured")

    # Verify with Paystack
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"https://api.paystack.co/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {secret_key}"},
            )
        data = resp.json()
        if not data.get("status"):
            raise ExternalServiceError(f"Paystack verify failed: {data.get('message')}")

        tx = data["data"]
        if tx["status"] != "success":
            raise ExternalServiceError(
                f"Payment not successful. Status: {tx['status']}"
            )
    except ExternalServiceError:
        raise
    except Exception as exc:
        raise ExternalServiceError(f"Paystack verification failed: {exc}") from exc

    # Activate the subscription in the DB
    user_id = uuid.UUID(payload["sub"])
    tier = PLAN_TO_TIER[plan_id]

    # Use the same session pattern as the gateway (async_sessionmaker, not context manager)
    session = request.app.state.session_factory()
    try:
        sub = await upgrade_subscription(
            session, user_id, tier, request.app.state.rabbitmq_channel
        )
        # Set expiry to 30 days from now
        from datetime import datetime, timezone, timedelta
        sub.current_period_start = datetime.now(tz=timezone.utc)
        sub.current_period_end   = datetime.now(tz=timezone.utc) + timedelta(days=30)
        sub.is_active = True
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()

    # Restore any archived listings up to the new plan limit
    try:
        from pathlib import Path as _Path
        _db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
        _new_limit = TIER_LISTING_LIMITS.get(tier, 0)
        await _restore_listings_on_renewal(str(user_id), _new_limit, _db_path)
    except Exception as _e:
        import logging as _log
        _log.getLogger(__name__).warning(f"restore_listings_skipped: {_e}")

    # Record payment in sub_payments table for admin reporting
    try:
        import aiosqlite as _aio
        from datetime import datetime as _dt, timezone as _tz
        _db = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
        _amount = PLAN_PRICES_KOBO.get(plan_id, 0) // 100  # convert kobo → NGN
        async with _aio.connect(str(_db)) as _db_conn:
            await _db_conn.execute("""
                CREATE TABLE IF NOT EXISTS sub_payments (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    plan TEXT NOT NULL,
                    reference TEXT NOT NULL,
                    amount_ngn INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'success',
                    paid_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await _db_conn.execute(
                "CREATE INDEX IF NOT EXISTS ix_sub_pay_user ON sub_payments(user_id)"
            )
            await _db_conn.execute(
                """INSERT OR IGNORE INTO sub_payments
                   (id, user_id, plan, reference, amount_ngn, status, paid_at)
                   VALUES (?, ?, ?, ?, ?, 'success', ?)""",
                [str(uuid.uuid4()), str(user_id), plan_id, reference, _amount,
                 _dt.now(tz=_tz.utc).isoformat()],
            )
            # Also write to audit_log
            from datetime import datetime as _dt2, timezone as _tz2
            await _db_conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id TEXT PRIMARY KEY, actor_id TEXT, actor_email TEXT, actor_name TEXT,
                    category TEXT NOT NULL DEFAULT 'system', action TEXT NOT NULL,
                    resource TEXT, resource_id TEXT, ip_address TEXT,
                    status TEXT NOT NULL DEFAULT 'success', detail TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await _db_conn.execute(
                """INSERT OR IGNORE INTO audit_log
                   (id, actor_id, actor_email, action, resource, resource_id,
                    category, status, detail, created_at)
                   VALUES (?,?,?,?,?,?,'admin','success',?,?)""",
                [str(uuid.uuid4()), str(user_id), user_email,
                 "subscription.payment", "subscriptions", reference,
                 f"Subscription payment: {plan_id} plan ₦{_amount:,}",
                 _dt.now(tz=_tz.utc).isoformat()],
            )
            await _db_conn.commit()
            _notif_id = str(uuid.uuid4())
            _plan_name = plan_id.capitalize()
            await _db_conn.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'system',
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    is_read INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await _db_conn.execute(
                """INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
                   VALUES (?, ?, 'payment', ?, ?, 0, ?)""",
                [_notif_id, str(user_id),
                 f"✅ {_plan_name} Plan Activated",
                 f"Your payment of ₦{_amount:,} was successful. Your {_plan_name} subscription is now active for 30 days.",
                 _dt.now(tz=_tz.utc).isoformat()],
            )
            await _db_conn.commit()
    except Exception as _e:
        import logging as _log2
        _log2.getLogger(__name__).warning(f"payment_record_skipped: {_e}")

    return SuccessResponse(
        message=f"Subscription activated: {plan_id}",
        data={
            "plan": plan_id,
            "tier": sub.tier,
            "is_active": sub.is_active,
            "reference": reference,
        },
    )


@router.post(
    "/subscriptions/paystack/webhook",
    response_model=SuccessResponse,
    summary="Paystack webhook — activates subscription on charge.success",
    include_in_schema=False,
)
async def paystack_webhook(
    request: Request,
) -> SuccessResponse:
    """
    Paystack sends a POST here when a payment succeeds.
    We verify the HMAC signature, then activate the subscription.
    This runs independently of the frontend redirect callback —
    it's the server-side confirmation that money actually moved.
    """
    import hashlib
    import hmac
    import os

    secret_key = os.environ.get("PAYSTACK_SECRET_KEY", "").strip()
    body_bytes  = await request.body()
    signature   = request.headers.get("x-paystack-signature", "")

    # Verify HMAC-SHA512 signature
    if secret_key:
        expected = hmac.new(
            secret_key.encode(), body_bytes, hashlib.sha512
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            from shared.errors import UnauthorizedError
            raise UnauthorizedError("Invalid Paystack webhook signature.")

    import json
    event = json.loads(body_bytes)

    if event.get("event") != "charge.success":
        # We only handle charge.success; acknowledge other events silently
        return SuccessResponse(message="Event ignored.", data={"event": event.get("event")})

    data     = event.get("data", {})
    metadata = data.get("metadata", {})
    user_id_str = metadata.get("user_id", "")
    plan_id     = metadata.get("plan", "")

    if not user_id_str or not plan_id or plan_id not in PLAN_TO_TIER:
        return SuccessResponse(message="Skipped — missing metadata.", data={})

    tier = PLAN_TO_TIER[plan_id]
    try:
        user_id = uuid.UUID(user_id_str)
        session = request.app.state.session_factory()
        try:
            sub = await upgrade_subscription(
                session, user_id, tier, request.app.state.rabbitmq_channel
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(
            "paystack_webhook_activate_failed",
            extra={"user_id": user_id_str, "plan": plan_id, "error": str(exc)},
        )
        # Return 200 so Paystack doesn't retry
        return SuccessResponse(message="Activation failed — logged.", data={"error": str(exc)})

    return SuccessResponse(
        message="Subscription activated via webhook.",
        data={"user_id": user_id_str, "plan": plan_id, "tier": tier},
    )


# ── Subscription expiry enforcement ──────────────────────────────────────────

# Free plan listing limit
FREE_PLAN_LIMIT = 3

# Tier → listing limit (0 = unlimited)
# Note: our UI 'starter' plan → DB tier 'growth' (20 slots)
#       our UI 'business' plan → DB tier 'pro' (100 slots)
TIER_LISTING_LIMITS = {
    "starter":    3,    # expired/free fallback tier — same as free plan limit
    "growth":     20,   # corresponds to our UI 'Starter' plan (₦2,500/mo)
    "pro":        100,  # corresponds to our UI 'Business' plan (₦7,500/mo)
    "enterprise": 0,    # unlimited
}


async def _enforce_subscription_expiry(session_factory) -> None:
    """
    Called periodically. For each user whose paid subscription has expired:
    1. Downgrade them to 'starter' tier (effectively free behaviour).
    2. Archive all listings beyond the free plan limit (3).
    When they renew, their listings are restored.
    """
    import aiosqlite
    from pathlib import Path
    from datetime import datetime, timezone

    db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
    now_iso = datetime.now(tz=timezone.utc).isoformat()

    import logging
    log = logging.getLogger(__name__)

    try:
        async with aiosqlite.connect(str(db_path)) as db:
            db.row_factory = aiosqlite.Row

            # Ensure subscriptions table exists — auto-migrate on first run
            await db.execute("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL UNIQUE,
                    tier TEXT NOT NULL DEFAULT 'starter',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    pending_downgrade_tier TEXT,
                    current_period_start TEXT,
                    current_period_end TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS ix_subscriptions_user ON subscriptions(user_id)"
            )
            await db.commit()

            # Find subscriptions that have expired and are not already on 'starter'
            expired = await db.execute_fetchall(
                """
                SELECT id, user_id, tier, current_period_end
                FROM subscriptions
                WHERE is_active = 1
                  AND tier != 'starter'
                  AND current_period_end IS NOT NULL
                  AND current_period_end < ?
                """,
                [now_iso],
            )

            for row in expired:
                user_id_str = str(row["user_id"])
                old_tier    = row["tier"]
                log.info(f"subscription_expired: user={user_id_str} tier={old_tier}")

                # Downgrade to starter
                await db.execute(
                    "UPDATE subscriptions SET tier='starter', is_active=1 WHERE id=?",
                    [str(row["id"])],
                )

                # Count active listings for this user
                active = await db.execute_fetchall(
                    "SELECT id FROM listings WHERE CAST(seller_id AS TEXT)=? AND status='active' ORDER BY created_at DESC",
                    [user_id_str],
                )

                # Archive listings beyond the free limit
                archived_count = 0
                if len(active) > FREE_PLAN_LIMIT:
                    to_archive = active[FREE_PLAN_LIMIT:]  # keep newest 3
                    archived_count = len(to_archive)
                    for listing in to_archive:
                        await db.execute(
                            "UPDATE listings SET status='archived' WHERE id=?",
                            [str(listing["id"])],
                        )
                        log.info(f"listing_archived_expired_sub: listing={listing['id']} user={user_id_str}")

                # Create in-app expiry notification
                try:
                    import uuid as _u
                    _plan_label = old_tier.capitalize()
                    _msg = (
                        f"Your {_plan_label} subscription has expired. "
                        f"You are now on the Free plan ({FREE_PLAN_LIMIT} listings). "
                        + (f"{archived_count} listing(s) have been archived. Renew your plan to restore them." if archived_count > 0 else "")
                    )
                    await db.execute("""
                        CREATE TABLE IF NOT EXISTS notifications (
                            id TEXT PRIMARY KEY,
                            user_id TEXT NOT NULL,
                            type TEXT NOT NULL DEFAULT 'system',
                            title TEXT NOT NULL,
                            message TEXT NOT NULL,
                            is_read INTEGER NOT NULL DEFAULT 0,
                            created_at TEXT NOT NULL DEFAULT (datetime('now'))
                        )
                    """)
                    await db.execute(
                        "INSERT INTO notifications (id, user_id, type, title, message, is_read) VALUES (?,?,?,?,?,0)",
                        [str(_u.uuid4()), user_id_str, "payment", "⚠️ Subscription Expired", _msg],
                    )
                except Exception:
                    pass

            await db.commit()
            if expired:
                log.info(f"subscription_expiry_run: expired={len(expired)}")
    except Exception as e:
        log.error(f"subscription_expiry_error: {e}")


async def _restore_listings_on_renewal(user_id_str: str, new_limit: int, db_path) -> None:
    """Restore archived listings when a user renews their subscription."""
    import aiosqlite
    import logging
    log = logging.getLogger(__name__)

    try:
        async with aiosqlite.connect(str(db_path)) as db:
            db.row_factory = aiosqlite.Row

            # Count currently active listings
            active = await db.execute_fetchall(
                "SELECT COUNT(*) as cnt FROM listings WHERE CAST(seller_id AS TEXT)=? AND status='active'",
                [user_id_str],
            )
            current_active = active[0]["cnt"] if active else 0

            if new_limit == 0:  # unlimited
                slots = 9999
            else:
                slots = max(0, new_limit - current_active)

            if slots > 0:
                # Restore archived listings up to the new limit
                archived = await db.execute_fetchall(
                    "SELECT id FROM listings WHERE CAST(seller_id AS TEXT)=? AND status='archived' ORDER BY created_at DESC LIMIT ?",
                    [user_id_str, slots],
                )
                for row in archived:
                    await db.execute(
                        "UPDATE listings SET status='active' WHERE id=?",
                        [str(row["id"])],
                    )
                    log.info(f"listing_restored_renewal: listing={row['id']} user={user_id_str}")
                await db.commit()
    except Exception as e:
        logging.getLogger(__name__).error(f"restore_listings_error: {e}")


@router.post(
    "/subscriptions/run-expiry",
    response_model=SuccessResponse,
    summary="[Admin] Manually trigger subscription expiry check",
    include_in_schema=False,
)
async def run_expiry_check(request: Request) -> SuccessResponse:
    """Trigger the expiry enforcement job manually (admin/cron use)."""
    await _enforce_subscription_expiry(request.app.state.session_factory)
    return SuccessResponse(message="Expiry check completed.", data={})
