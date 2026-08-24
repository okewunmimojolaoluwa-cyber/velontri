"""Subscription Service router — uses Authorization: Bearer JWT."""
from __future__ import annotations
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Request
from shared.auth import get_user_id, get_user_payload
from shared.errors import SuccessResponse
from ..models import TIER_ENTITLEMENTS
from ..repository import get_invoices, get_or_create_subscription, upgrade_subscription
router = APIRouter(tags=['Subscriptions'])

@router.get('/subscriptions/tiers', response_model=SuccessResponse, summary='List all subscription tiers with entitlements')
async def list_tiers() -> SuccessResponse:
    return SuccessResponse(message='Subscription tiers retrieved.', data=TIER_ENTITLEMENTS)

@router.get('/subscriptions/me', response_model=SuccessResponse, summary="Get current user's subscription and entitlements")
async def get_my_subscription(request: Request, payload: Annotated[dict, Depends(get_user_payload)]=None) -> SuccessResponse:
    user_id = uuid.UUID(payload['sub'])
    session = request.app.state.session_factory()
    try:
        sub = await get_or_create_subscription(session, user_id)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
    entitlements = TIER_ENTITLEMENTS.get(sub.tier, TIER_ENTITLEMENTS['starter'])
    return SuccessResponse(message='Subscription retrieved.', data={'tier': sub.tier, 'is_active': sub.is_active, 'current_period_start': sub.current_period_start.isoformat() if sub.current_period_start else None, 'current_period_end': sub.current_period_end.isoformat() if sub.current_period_end else None, 'entitlements': entitlements})

@router.post('/subscriptions/upgrade', response_model=SuccessResponse, summary='Upgrade subscription tier')
async def upgrade(request: Request, new_tier: str=Query(..., pattern='^(growth|pro|enterprise)$'), payload: Annotated[dict, Depends(get_user_payload)]=None) -> SuccessResponse:
    user_id = uuid.UUID(payload['sub'])
    session = request.app.state.session_factory()
    try:
        sub = await upgrade_subscription(session, user_id, new_tier, request.app.state.rabbitmq_channel)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
    return SuccessResponse(message=f'Subscription upgraded to {new_tier}.', data={'tier': sub.tier, 'is_active': sub.is_active})

@router.post('/subscriptions/downgrade', response_model=SuccessResponse, summary='Schedule a subscription downgrade at end of billing cycle')
async def downgrade(request: Request, new_tier: str=Query(..., pattern='^(starter|growth|pro)$'), payload: Annotated[dict, Depends(get_user_payload)]=None) -> SuccessResponse:
    """Schedules a downgrade — effective at end of current billing cycle."""
    user_id = uuid.UUID(payload['sub'])
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
    return SuccessResponse(message=f"Downgrade to '{new_tier}' scheduled for end of billing cycle.", data={'current_tier': sub.tier, 'pending_downgrade_tier': new_tier})

@router.get('/subscriptions/invoices', response_model=SuccessResponse, summary='Paginated invoice history for current user')
async def list_invoices(request: Request, page: int=Query(default=1, ge=1), payload: Annotated[dict, Depends(get_user_payload)]=None) -> SuccessResponse:
    user_id = uuid.UUID(payload['sub'])
    session = request.app.state.session_factory()
    try:
        invoices = await get_invoices(session, user_id, page)
    finally:
        await session.close()
    data = [{'id': str(i.id), 'tier': i.tier, 'amount': str(i.amount), 'currency': i.currency, 'fx_rate': str(i.fx_rate) if i.fx_rate else None, 'status': i.status, 'invoice_date': i.invoice_date.isoformat() if i.invoice_date else None} for i in invoices]
    return SuccessResponse(message='Invoices retrieved.', data=data, meta={'page': page, 'count': len(data)})
PLAN_PRICES_KOBO = {'starter': 250000, 'business': 750000}
PLAN_TO_TIER = {'starter': 'growth', 'business': 'pro', 'enterprise': 'enterprise'}

@router.post('/subscriptions/paystack/initiate', response_model=SuccessResponse, summary='Initiate a Paystack subscription payment')
async def paystack_initiate(request: Request, payload: Annotated[dict, Depends(get_user_payload)]) -> SuccessResponse:
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
    plan_id: str = (body.get('plan') or '').strip().lower()
    callback_url: str = body.get('callback_url') or ''
    if plan_id not in PLAN_PRICES_KOBO:
        raise InvalidInputError(f'Plan must be one of: {list(PLAN_PRICES_KOBO.keys())}')
    if not callback_url:
        raise InvalidInputError('callback_url is required')
    user_id = payload['sub']
    user_email = (payload.get('email') or '').strip()
    if not user_email:
        try:
            async with request.app.state.session_factory() as db:
                from sqlalchemy import text as _text
                rows = (await db.execute(_text('SELECT email FROM users WHERE id = :p0'), {'p0': user_id})).mappings().all()
                if rows:
                    user_email = (rows[0]['email'] or '').strip()
        except Exception as e:
            log.warning(f'email_lookup_failed: {e}')
    if not user_email or '@' not in user_email:
        from shared.errors import InvalidInputError
        raise InvalidInputError('Your account email could not be found. Please log out, sign back in, and try again.')
    amount_kobo = PLAN_PRICES_KOBO[plan_id]
    reference = f'vlt-sub-{plan_id}-{_secrets.token_hex(8)}'
    secret_key = os.environ.get('PAYSTACK_SECRET_KEY', '').strip()
    log.info(f'paystack_initiate plan={plan_id} email={user_email} key_set={bool(secret_key)}')
    if not secret_key:
        raise ExternalServiceError('PAYSTACK_SECRET_KEY is not configured. Add it to backend/.env — get your key at dashboard.paystack.com')
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post('https://api.paystack.co/transaction/initialize', headers={'Authorization': f'Bearer {secret_key}', 'Content-Type': 'application/json'}, json={'email': user_email, 'amount': amount_kobo, 'reference': reference, 'callback_url': callback_url, 'metadata': {'user_id': user_id, 'plan': plan_id, 'custom_fields': [{'display_name': 'Plan', 'variable_name': 'plan', 'value': plan_id}]}})
        data = resp.json()
        log.info(f"paystack_response status={data.get('status')} message={data.get('message')}")
        if not data.get('status'):
            raise ExternalServiceError(f"Paystack error: {data.get('message', 'Unknown error')} (HTTP {resp.status_code})")
        return SuccessResponse(message='Payment link created.', data={'authorization_url': data['data']['authorization_url'], 'reference': data['data']['reference'], 'access_code': data['data']['access_code'], 'plan': plan_id})
    except ExternalServiceError:
        raise
    except Exception as exc:
        log.error(f'paystack_initiate_exception: {type(exc).__name__}: {exc}')
        raise ExternalServiceError(f'Failed to create Paystack payment: {type(exc).__name__}: {exc}') from exc

@router.post('/subscriptions/paystack/verify', response_model=SuccessResponse, summary='Verify a Paystack payment and activate the subscription')
async def paystack_verify(request: Request, payload: Annotated[dict, Depends(get_user_payload)]) -> SuccessResponse:
    """
    Verifies a Paystack transaction by reference, then activates the plan.
    Body: { reference: 'vlt-sub-starter-abc123', plan: 'starter' }
    """
    import os
    import httpx
    from shared.errors import InvalidInputError, ExternalServiceError
    body = await request.json()
    reference: str = (body.get('reference') or '').strip()
    plan_id: str = (body.get('plan') or '').strip().lower()
    if not reference:
        raise InvalidInputError('reference is required')
    if plan_id not in PLAN_TO_TIER:
        raise InvalidInputError(f'Plan must be one of: {list(PLAN_TO_TIER.keys())}')
    secret_key = os.environ.get('PAYSTACK_SECRET_KEY', '').strip()
    if not secret_key:
        raise ExternalServiceError('PAYSTACK_SECRET_KEY not configured')
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f'https://api.paystack.co/transaction/verify/{reference}', headers={'Authorization': f'Bearer {secret_key}'})
        data = resp.json()
        if not data.get('status'):
            raise ExternalServiceError(f"Paystack verify failed: {data.get('message')}")
        tx = data['data']
        if tx['status'] != 'success':
            raise ExternalServiceError(f"Payment not successful. Status: {tx['status']}")
    except ExternalServiceError:
        raise
    except Exception as exc:
        raise ExternalServiceError(f'Paystack verification failed: {exc}') from exc
    user_id = uuid.UUID(payload['sub'])
    tier = PLAN_TO_TIER[plan_id]
    session = request.app.state.session_factory()
    try:
        sub = await upgrade_subscription(session, user_id, tier, request.app.state.rabbitmq_channel)
        from datetime import datetime, timezone, timedelta
        sub.current_period_start = datetime.now(tz=timezone.utc)
        sub.current_period_end = datetime.now(tz=timezone.utc) + timedelta(days=30)
        sub.is_active = True
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()

    # ── Immediately update user_profiles.subscription_tier ────────────────
    # This ensures the NEXT token refresh picks up the correct tier in the JWT.
    try:
        async with request.app.state.session_factory() as _pdb:
            from sqlalchemy import text as _ptext
            await _pdb.execute(_ptext("""
                INSERT INTO user_profiles (id, user_id, subscription_tier, updated_at)
                VALUES (gen_random_uuid(), :uid, :tier, NOW())
                ON CONFLICT (user_id) DO UPDATE
                  SET subscription_tier = :tier, updated_at = NOW()
            """), {'uid': str(user_id), 'tier': tier})
            await _pdb.commit()
    except Exception as _pe:
        import logging as _plog
        _plog.getLogger(__name__).warning(f'subscription_tier_profile_update_failed: {_pe}')
    try:
        from pathlib import Path as _Path
        _new_limit = TIER_LISTING_LIMITS.get(tier, 0)
        await _restore_listings_on_renewal(str(user_id), _new_limit, request.app.state.session_factory)
    except Exception as _e:
        import logging as _log
        _log.getLogger(__name__).warning(f'restore_listings_skipped: {_e}')
    try:
        from datetime import datetime as _dt, timezone as _tz
        _amount = PLAN_PRICES_KOBO.get(plan_id, 0) // 100
        async with request.app.state.session_factory() as _db_conn:
            from sqlalchemy import text as _text
            # Record the payment (idempotent via ON CONFLICT DO NOTHING)
            await _db_conn.execute(_text("""
                INSERT INTO sub_payments (id, user_id, plan, reference, amount_ngn, status, paid_at)
                VALUES (:id, :user_id, :plan, :ref, :amount, 'success', NOW())
                ON CONFLICT (id) DO NOTHING
            """), {'id': str(uuid.uuid4()), 'user_id': str(user_id), 'plan': plan_id,
                   'ref': reference, 'amount': _amount})
            # Audit log
            await _db_conn.execute(_text("""
                INSERT INTO audit_log (id, actor_id, actor_email, action, resource, resource_id,
                                       category, status, detail, created_at)
                VALUES (:id, :actor_id, :actor_email, :action, :resource, :resource_id,
                        'admin', 'success', :detail, NOW())
                ON CONFLICT (id) DO NOTHING
            """), {'id': str(uuid.uuid4()), 'actor_id': str(user_id), 'actor_email': payload.get('email'),
                   'action': 'subscription.payment', 'resource': 'subscriptions',
                   'resource_id': reference,
                   'detail': f'Subscription payment: {plan_id} plan ₦{_amount:,}'})
            # Notification
            _plan_name = plan_id.capitalize()
            await _db_conn.execute(_text("""
                INSERT INTO notifications (id, user_id, type, title, message, is_read)
                VALUES (:id, :user_id, 'payment', :title, :message, FALSE)
                ON CONFLICT (id) DO NOTHING
            """), {'id': str(uuid.uuid4()), 'user_id': str(user_id),
                   'title': f'✅ {_plan_name} Plan Activated',
                   'message': f'Your payment of ₦{_amount:,} was successful. Your {_plan_name} subscription is now active for 30 days.'})
            await _db_conn.commit()
    except Exception as _e:
        import logging as _log2
        _log2.getLogger(__name__).warning(f'payment_record_skipped: {_e}')
    # ── Auto-verify seller on any paid subscription ─────────────────────────
    # A user who pays for starter/business/enterprise is a verified seller.
    try:
        async with request.app.state.session_factory() as _vdb:
            from sqlalchemy import text as _vtext
            import uuid as _uv
            # Grant 'seller' role if not already present
            existing_role = (await _vdb.execute(_vtext(
                "SELECT id FROM user_roles WHERE CAST(user_id AS TEXT)=:uid AND role='seller'"
            ), {'uid': str(user_id)})).fetchone()
            if not existing_role:
                await _vdb.execute(_vtext(
                    "INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (:rid, :uid, 'seller', NOW())"
                ), {'rid': str(_uv.uuid4()), 'uid': str(user_id)})
            # Set trust_badge = 'verified' in user_profiles
            await _vdb.execute(_vtext("""
                INSERT INTO user_profiles (id, user_id, trust_badge, updated_at)
                VALUES (gen_random_uuid(), :uid, 'verified', NOW())
                ON CONFLICT (user_id) DO UPDATE SET trust_badge='verified', updated_at=NOW()
            """), {'uid': str(user_id)})
            await _vdb.commit()
    except Exception as _ve:
        import logging as _vlog
        _vlog.getLogger(__name__).warning(f'auto_verify_seller_failed: {_ve}')

    return SuccessResponse(message=f'Subscription activated: {plan_id}', data={'plan': plan_id, 'tier': sub.tier, 'is_active': sub.is_active, 'reference': reference})

@router.post('/subscriptions/paystack/webhook', response_model=SuccessResponse, summary='Paystack webhook — activates subscription on charge.success', include_in_schema=False)
async def paystack_webhook(request: Request) -> SuccessResponse:
    """
    Paystack sends a POST here when a payment succeeds.
    We verify the HMAC signature, then activate the subscription.
    This runs independently of the frontend redirect callback —
    it's the server-side confirmation that money actually moved.
    """
    import hashlib
    import hmac
    import os
    secret_key = os.environ.get('PAYSTACK_SECRET_KEY', '').strip()
    body_bytes = await request.body()
    signature = request.headers.get('x-paystack-signature', '')
    if secret_key:
        expected = hmac.new(secret_key.encode(), body_bytes, hashlib.sha512).hexdigest()
        if not hmac.compare_digest(expected, signature):
            from shared.errors import UnauthorizedError
            raise UnauthorizedError('Invalid Paystack webhook signature.')
    import json
    event = json.loads(body_bytes)
    if event.get('event') != 'charge.success':
        return SuccessResponse(message='Event ignored.', data={'event': event.get('event')})
    data = event.get('data', {})
    metadata = data.get('metadata', {})
    user_id_str = metadata.get('user_id', '')
    plan_id = metadata.get('plan', '')
    if not user_id_str or not plan_id or plan_id not in PLAN_TO_TIER:
        return SuccessResponse(message='Skipped — missing metadata.', data={})
    tier = PLAN_TO_TIER[plan_id]
    try:
        user_id = uuid.UUID(user_id_str)
        session = request.app.state.session_factory()
        try:
            sub = await upgrade_subscription(session, user_id, tier, request.app.state.rabbitmq_channel)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error('paystack_webhook_activate_failed', extra={'user_id': user_id_str, 'plan': plan_id, 'error': str(exc)})
        return SuccessResponse(message='Activation failed — logged.', data={'error': str(exc)})
    return SuccessResponse(message='Subscription activated via webhook.', data={'user_id': user_id_str, 'plan': plan_id, 'tier': tier})
FREE_PLAN_LIMIT = 3
TIER_LISTING_LIMITS = {'starter': 3, 'growth': 20, 'pro': 100, 'enterprise': 0}

async def _enforce_subscription_expiry(session_factory) -> None:
    """
    Called periodically. For each user whose paid subscription has expired:
    1. Downgrade them to 'starter' tier (effectively free behaviour).
    2. Archive all listings beyond the free plan limit (3).
    When they renew, their listings are restored.
    """
    from datetime import datetime, timezone
    import logging
    log = logging.getLogger(__name__)
    try:
        async with session_factory() as db:
            from sqlalchemy import text as _text
            # Use PostgreSQL NOW() for comparison — avoids TEXT vs TIMESTAMPTZ mismatch
            expired = (await db.execute(_text("""
                SELECT id, user_id, tier, current_period_end
                FROM subscriptions
                WHERE is_active = TRUE
                  AND tier != 'starter'
                  AND current_period_end IS NOT NULL
                  AND current_period_end < NOW()
                """))).mappings().all()
            for row in expired:
                user_id_str = str(row['user_id'])
                old_tier = row['tier']
                log.info(f'subscription_expired: user={user_id_str} tier={old_tier}')
                await db.execute(_text("UPDATE subscriptions SET tier='starter', is_active=TRUE, updated_at=NOW() WHERE id=:p0"), {'p0': str(row['id'])})
                active = (await db.execute(_text("SELECT id FROM listings WHERE CAST(seller_id AS TEXT)=:p0 AND status='active' ORDER BY created_at DESC"), {'p0': user_id_str})).mappings().all()
                archived_count = 0
                if len(active) > FREE_PLAN_LIMIT:
                    to_archive = active[FREE_PLAN_LIMIT:]
                    archived_count = len(to_archive)
                    for listing in to_archive:
                        await db.execute(_text("UPDATE listings SET status='archived' WHERE id=:p0"), {'p0': str(listing['id'])})
                        log.info(f"listing_archived_expired_sub: listing={listing['id']} user={user_id_str}")
                try:
                    import uuid as _u
                    _plan_label = old_tier.capitalize()
                    _msg = f'Your {_plan_label} subscription has expired. You are now on the Free plan ({FREE_PLAN_LIMIT} listings). ' + (f'{archived_count} listing(s) have been archived. Renew your plan to restore them.' if archived_count > 0 else '')
                    await db.execute(_text('INSERT INTO notifications (id, user_id, type, title, message, is_read) VALUES (:p0,:p1,:p2,:p3,:p4,FALSE)'), {'p0': str(_u.uuid4()), 'p1': user_id_str, 'p2': 'payment', 'p3': 'Subscription Expired', 'p4': _msg})
                except Exception:
                    pass
            await db.commit()
            if expired:
                log.info(f'subscription_expiry_run: expired={len(expired)}')
    except Exception as e:
        log.error(f'subscription_expiry_error: {e}')

async def _restore_listings_on_renewal(user_id_str: str, new_limit: int, session_factory) -> None:
    """Restore archived listings when a user renews their subscription."""
    import logging
    log = logging.getLogger(__name__)
    try:
        async with session_factory() as db:
            from sqlalchemy import text as _text
            active = (await db.execute(_text("SELECT COUNT(*) as cnt FROM listings WHERE CAST(seller_id AS TEXT)=:p0 AND status='active'"), {'p0': user_id_str})).mappings().all()
            current_active = active[0]['cnt'] if active else 0
            if new_limit == 0:
                slots = 9999
            else:
                slots = max(0, new_limit - current_active)
            if slots > 0:
                archived = (await db.execute(_text("SELECT id FROM listings WHERE CAST(seller_id AS TEXT)=:p0 AND status='archived' ORDER BY created_at DESC LIMIT :p1"), {'p0': user_id_str, 'p1': slots})).mappings().all()
                for row in archived:
                    await db.execute(_text("UPDATE listings SET status='active' WHERE id=:p0"), {'p0': str(row['id'])})
                    log.info(f"listing_restored_renewal: listing={row['id']} user={user_id_str}")
                await db.commit()
    except Exception as e:
        logging.getLogger(__name__).error(f'restore_listings_error: {e}')

@router.post('/subscriptions/run-expiry', response_model=SuccessResponse, summary='[Admin] Manually trigger subscription expiry check', include_in_schema=False)
async def run_expiry_check(request: Request) -> SuccessResponse:
    """Trigger the expiry enforcement job manually (admin/cron use)."""
    await _enforce_subscription_expiry(request.app.state.session_factory)
    return SuccessResponse(message='Expiry check completed.', data={})