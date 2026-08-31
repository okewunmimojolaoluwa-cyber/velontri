"""
Seller Verification Application System.
All endpoints use the existing session_factory pattern via request.app.state.
Documents are stored as base64 data URLs — never returned in list/mod endpoints.
Moderator identity always comes from JWT payload — never trusted from the frontend.
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Request, Query
from shared.errors import (
    SuccessResponse, ForbiddenError, NotFoundError, InvalidInputError
)
from shared.logging import get_logger
from ..dependencies import get_current_user_id, get_current_user_payload

logger = get_logger(__name__)
router = APIRouter(prefix='/verification', tags=['Seller Verification'])


# ── Internal helpers ─────────────────────────────────────────────────────────

async def _notify(request: Request, user_id: str, title: str, message: str,
                  notif_type: str = 'system', action_url: str | None = None) -> None:
    """Insert a notification and send an email to the user."""
    import os, asyncio
    # In-app notification
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            await db.execute(_t("""
                INSERT INTO notifications (id, user_id, type, title, message, is_read, action_url, created_at)
                VALUES (:id, :uid, :ntype, :title, :msg, false, :url, NOW())
            """), {'id': str(uuid.uuid4()), 'uid': user_id, 'ntype': notif_type,
                   'title': title, 'msg': message, 'url': action_url})
            await db.commit()
    except Exception as e:
        logger.warning('verification_notify_failed', error=str(e))

    # Email notification (fire-and-forget)
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            row = (await db.execute(
                _t("SELECT email, full_name FROM users WHERE CAST(id AS TEXT) = :uid LIMIT 1"),
                {'uid': user_id}
            )).fetchone()
            if row and row[0]:
                email = row[0]
                full_name = row[1] or 'User'
                first_name = full_name.split()[0]
                brevo_key = os.environ.get('BREVO_API_KEY', '').strip()
                gmail_user = os.environ.get('GMAIL_USER', '').strip()
                gmail_pass = os.environ.get('GMAIL_APP_PASSWORD', '').strip()
                sender_email = os.environ.get('EMAIL_FROM', gmail_user or 'noreply@velontri.pxxl.click').strip()
                app_url = 'https://velontri.pxxl.click'
                cta_url = action_url or f'{app_url}/dashboard/notifications'
                is_approved = 'approved' in title.lower() or 'congratulations' in title.lower()
                accent = '#16a34a' if is_approved else '#dc2626'
                emoji = '🎉' if is_approved else '⚠️'

                html_body = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <tr><td style="background:{accent};padding:28px 40px;text-align:center">
    <p style="margin:0;font-size:36px">{emoji}</p>
    <h1 style="margin:10px 0 0;color:#fff;font-size:20px;font-weight:900">{title}</h1>
  </td></tr>
  <tr><td style="padding:28px 40px">
    <p style="margin:0 0 16px;color:#334155;font-size:15px">Hi {first_name},</p>
    <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:24px;color:#334155;font-size:14px;line-height:1.6;border-left:4px solid {accent}">
{message}
    </div>
    <a href="{cta_url}" style="display:inline-block;background:{accent};color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700">View Details →</a>
  </td></tr>
  <tr><td style="padding:16px 40px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:12px">
      <a href="{app_url}" style="color:#6366f1">Velontri</a> &nbsp;·&nbsp;
      <a href="{app_url}/dashboard/notifications" style="color:#94a3b8">All notifications</a>
    </p>
  </td></tr>
</table></td></tr></table></body></html>"""

                subject = f'{emoji} {title} — Velontri'

                sent = False
                if brevo_key:
                    try:
                        import httpx as _hx
                        async with _hx.AsyncClient(timeout=10.0) as c:
                            r = await c.post(
                                'https://api.brevo.com/v3/smtp/email',
                                headers={'api-key': brevo_key, 'Content-Type': 'application/json'},
                                json={'to': [{'email': email, 'name': full_name}],
                                      'from': {'email': sender_email, 'name': 'Velontri'},
                                      'subject': subject, 'htmlContent': html_body}
                            )
                        sent = r.status_code in (200, 201, 202)
                    except Exception:
                        pass

                if not sent and gmail_user and gmail_pass:
                    import smtplib
                    from email.mime.multipart import MIMEMultipart
                    from email.mime.text import MIMEText
                    def _smtp():
                        m = MIMEMultipart('alternative')
                        m['Subject'] = subject
                        m['From'] = f'Velontri <{gmail_user}>'
                        m['To'] = email
                        m.attach(MIMEText(html_body, 'html', 'utf-8'))
                        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
                            s.login(gmail_user, gmail_pass)
                            s.sendmail(gmail_user, [email], m.as_string())
                    loop = asyncio.get_event_loop()
                    await asyncio.wait_for(loop.run_in_executor(None, _smtp), timeout=20.0)
    except Exception as e:
        logger.warning('verification_email_notify_failed', error=str(e))


async def _audit(
    request: Request, actor_id: str, action: str,
    resource_id: str, detail: str
) -> None:
    """Write to the existing audit_log table."""
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            await db.execute(_t("""
                INSERT INTO audit_log (id, actor_id, category, action, resource,
                    resource_id, status, detail, created_at)
                VALUES (:id, :actor, 'verification', :action, 'seller_verification',
                    :rid, 'success', :detail, NOW())
            """), {
                'id': str(uuid.uuid4()), 'actor': actor_id,
                'action': action, 'rid': resource_id, 'detail': detail,
            })
            await db.commit()
    except Exception as e:
        logger.warning('verification_audit_failed', error=str(e))


def _safe_app(app: dict) -> dict:
    """Strip sensitive document content — return only metadata."""
    s = dict(app)
    s.pop('id_front_url', None)
    s.pop('id_back_url', None)
    return s


def _mod_app(app: dict) -> dict:
    """For moderators: replace doc content with has_* booleans."""
    s = dict(app)
    s['has_id_front'] = bool(s.pop('id_front_url', None))
    s['has_id_back'] = bool(s.pop('id_back_url', None))
    return s


def _iso(row: dict) -> dict:
    """Convert datetime values to ISO strings."""
    out = {}
    for k, v in row.items():
        out[k] = v.isoformat() if (v is not None and hasattr(v, 'isoformat')) else v
    return out


# ── User routes ───────────────────────────────────────────────────────────────

@router.get('/me', response_model=SuccessResponse,
    summary="Get own verification status and application")
async def get_my_verification(
    request: Request,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    uid = str(current_user_id)
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            row = (await db.execute(_t("""
                SELECT id, user_id, status, seller_type,
                       full_name, date_of_birth, country, state, city,
                       residential_address, phone, email,
                       id_type, id_number,
                       display_name, seller_description,
                       business_name, business_description, business_address,
                       business_reg_number, business_phone, whatsapp_number,
                       business_category, store_name, store_description, location,
                       submitted_at, reviewed_at, reviewer_name,
                       rejection_reason, rejection_category, additional_notes,
                       created_at, updated_at
                FROM seller_verification_applications
                WHERE CAST(user_id AS TEXT) = :uid
                LIMIT 1
            """), {'uid': uid})).mappings().first()

            u_row = (await db.execute(_t("""
                SELECT seller_verification_status
                FROM users WHERE CAST(id AS TEXT) = :uid
            """), {'uid': uid})).mappings().first()

    except Exception as e:
        logger.warning('get_verification_error', error=str(e))
        return SuccessResponse(data={'status': 'not_verified', 'application': None})

    app = _safe_app(_iso(dict(row))) if row else None
    status = (u_row['seller_verification_status'] if u_row else 'not_verified') or 'not_verified'
    return SuccessResponse(data={'status': status, 'application': app})


@router.post('/save', response_model=SuccessResponse,
    summary='Save verification application draft (any step)')
async def save_verification(
    request: Request,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    uid = str(current_user_id)
    body = await request.json()

    # Strip protected fields — never allow frontend to set these
    for f in ('status', 'reviewed_at', 'reviewed_by', 'reviewer_name',
              'rejection_reason', 'rejection_category', 'user_id', 'id'):
        body.pop(f, None)

    allowed = {
        'seller_type', 'full_name', 'date_of_birth', 'country', 'state', 'city',
        'residential_address', 'phone', 'email', 'id_type', 'id_number',
        'id_front_url', 'id_back_url', 'display_name', 'seller_description',
        'business_name', 'business_description', 'business_address',
        'business_reg_number', 'business_phone', 'whatsapp_number',
        'business_category', 'store_name', 'store_description',
        'store_logo_url', 'profile_photo_url', 'location',
    }
    data = {k: v for k, v in body.items() if k in allowed}

    # Convert date_of_birth string → Python date object so asyncpg can bind it
    from datetime import date as _date
    if 'date_of_birth' in data and data['date_of_birth']:
        try:
            data['date_of_birth'] = _date.fromisoformat(str(data['date_of_birth']))
        except (ValueError, TypeError):
            data.pop('date_of_birth', None)  # ignore invalid dates
    elif 'date_of_birth' in data and not data['date_of_birth']:
        data.pop('date_of_birth', None)  # don't insert empty string into DATE column

    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            existing = (await db.execute(_t("""
                SELECT id, status FROM seller_verification_applications
                WHERE CAST(user_id AS TEXT) = :uid LIMIT 1
            """), {'uid': uid})).mappings().first()

            if existing:
                if existing['status'] == 'approved':
                    raise InvalidInputError('Your verification is already approved.')
                if data:
                    set_parts = ', '.join(f'"{k}" = :{k}' for k in data)
                    data['uid'] = uid
                    await db.execute(_t(f"""
                        UPDATE seller_verification_applications
                        SET {set_parts}, updated_at = NOW()
                        WHERE CAST(user_id AS TEXT) = :uid
                    """), data)
            else:
                app_id = str(uuid.uuid4())
                cols = ['id', 'user_id', 'status'] + list(data.keys())
                vals = [':_id', ':_uid', "'draft'"] + [f':{k}' for k in data]
                data['_id'] = app_id
                data['_uid'] = uid
                await db.execute(_t(f"""
                    INSERT INTO seller_verification_applications ({', '.join(cols)})
                    VALUES ({', '.join(vals)})
                """), data)

                # Set status on user row
                await db.execute(_t("""
                    UPDATE users SET seller_verification_status = 'draft'
                    WHERE CAST(id AS TEXT) = :uid
                """), {'uid': uid})

            await db.commit()
    except InvalidInputError:
        raise
    except Exception as e:
        logger.error('save_verification_error', error=str(e))
        raise InvalidInputError(f'Failed to save: {e}')

    return SuccessResponse(message='Application saved.', data={'saved': True})


@router.post('/submit', response_model=SuccessResponse,
    summary='Submit verification application for moderator review')
async def submit_verification(
    request: Request,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    uid = str(current_user_id)
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            row = (await db.execute(_t("""
                SELECT id, status, full_name, id_type, id_number
                FROM seller_verification_applications
                WHERE CAST(user_id AS TEXT) = :uid LIMIT 1
            """), {'uid': uid})).mappings().first()

            if not row:
                raise InvalidInputError('No application found. Please complete the form first.')
            if row['status'] == 'approved':
                raise InvalidInputError('Your verification is already approved.')
            if row['status'] in ('submitted', 'under_review'):
                raise InvalidInputError('Your application is already under review.')
            if not row['full_name']:
                raise InvalidInputError('Complete Step 1 (Personal Information) first.')
            if not row['id_type'] or not row['id_number']:
                raise InvalidInputError('Complete Step 2 (Identity Verification) first.')

            await db.execute(_t("""
                UPDATE seller_verification_applications
                SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
                WHERE CAST(user_id AS TEXT) = :uid
            """), {'uid': uid})
            await db.execute(_t("""
                UPDATE users SET seller_verification_status = 'submitted'
                WHERE CAST(id AS TEXT) = :uid
            """), {'uid': uid})
            await db.commit()
            app_id = str(row['id'])

    except InvalidInputError:
        raise
    except Exception as e:
        logger.error('submit_verification_error', error=str(e))
        raise InvalidInputError(f'Failed to submit: {e}')

    await _notify(request, uid,
        'Verification Application Submitted',
        'Your seller verification application has been received. Our team will review it shortly.')
    await _audit(request, uid, 'verification.submitted', uid,
        'User submitted seller verification application')

    return SuccessResponse(
        message='Application submitted successfully.',
        data={'status': 'submitted', 'app_id': app_id},
    )


# ── Moderator routes ──────────────────────────────────────────────────────────

@router.get('/applications', response_model=SuccessResponse,
    summary='Mod: list verification applications')
async def list_applications(
    request: Request,
    payload: dict = Depends(get_current_user_payload),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(
            set(payload.get('roles', []))):
        raise ForbiddenError('Moderator access required.')

    offset = (page - 1) * page_size
    params: dict = {'lim': page_size, 'off': offset}

    if status and status != 'all':
        status_sql = 'AND sva.status = :status'
        params['status'] = status
    else:
        status_sql = "AND sva.status IN ('submitted','under_review','more_info_required')"

    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            rows = (await db.execute(_t(f"""
                SELECT sva.id, CAST(sva.user_id AS TEXT) AS user_id,
                       sva.status, sva.seller_type,
                       sva.full_name, sva.city, sva.country,
                       sva.business_name, sva.display_name,
                       sva.submitted_at, sva.reviewed_at, sva.reviewer_name,
                       sva.rejection_reason, sva.rejection_category,
                       u.email AS user_email, u.full_name AS user_name
                FROM seller_verification_applications sva
                LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(sva.user_id AS TEXT)
                WHERE 1=1 {status_sql}
                ORDER BY sva.submitted_at ASC NULLS LAST, sva.created_at DESC
                LIMIT :lim OFFSET :off
            """), params)).mappings().all()

            cnt = (await db.execute(_t(f"""
                SELECT COUNT(*) AS n FROM seller_verification_applications sva
                WHERE 1=1 {status_sql}
            """), {k: v for k, v in params.items() if k not in ('lim', 'off')})).mappings().first()
            total = cnt['n'] if cnt else 0

    except Exception as e:
        logger.error('list_applications_error', error=str(e))
        from shared.errors import paginated_meta
        return SuccessResponse(data=[], meta=paginated_meta(page, page_size, 0))

    from shared.errors import paginated_meta
    return SuccessResponse(
        data=[_iso(dict(r)) for r in rows],
        meta=paginated_meta(page, page_size, total),
    )


@router.get('/applications/{app_id}', response_model=SuccessResponse,
    summary='Mod: get full application detail')
async def get_application(
    app_id: uuid.UUID,
    request: Request,
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(
            set(payload.get('roles', []))):
        raise ForbiddenError('Moderator access required.')

    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            row = (await db.execute(_t("""
                SELECT sva.*,
                       u.email AS user_email, u.full_name AS user_name,
                       u.created_at AS user_joined
                FROM seller_verification_applications sva
                LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(sva.user_id AS TEXT)
                WHERE CAST(sva.id AS TEXT) = :aid LIMIT 1
            """), {'aid': str(app_id)})).mappings().first()
    except Exception as e:
        raise NotFoundError('Application not found.')

    if not row:
        raise NotFoundError('Application not found.')

    return SuccessResponse(data=_mod_app(_iso(dict(row))))


@router.post('/applications/{app_id}/approve', response_model=SuccessResponse,
    summary='Mod: approve a verification application')
async def approve_application(
    app_id: uuid.UUID,
    request: Request,
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(
            set(payload.get('roles', []))):
        raise ForbiddenError('Moderator access required.')

    # Moderator identity from JWT — never from the frontend
    mod_id = payload.get('sub', '')
    mod_name = payload.get('full_name', '') or payload.get('email', mod_id) or mod_id

    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            row = (await db.execute(_t("""
                SELECT id, user_id, status FROM seller_verification_applications
                WHERE CAST(id AS TEXT) = :aid LIMIT 1
            """), {'aid': str(app_id)})).mappings().first()

            if not row:
                raise NotFoundError('Application not found.')
            if row['status'] == 'approved':
                raise InvalidInputError('Already approved.')

            uid = str(row['user_id'])

            await db.execute(_t("""
                UPDATE seller_verification_applications
                SET status = 'approved', reviewed_at = NOW(),
                    reviewed_by = :mod_id, reviewer_name = :mod_name,
                    rejection_reason = NULL, updated_at = NOW()
                WHERE CAST(id AS TEXT) = :aid
            """), {'mod_id': mod_id, 'mod_name': mod_name, 'aid': str(app_id)})
            await db.execute(_t("""
                UPDATE users SET seller_verification_status = 'approved'
                WHERE CAST(id AS TEXT) = :uid
            """), {'uid': uid})
            await db.commit()

    except (NotFoundError, InvalidInputError):
        raise
    except Exception as e:
        raise InvalidInputError(f'Failed to approve: {e}')

    await _notify(request, uid,
        '🎉 Congratulations — Verified Seller!',
        'Your seller verification has been approved. Your profile now shows the Verified Seller badge.')
    await _audit(request, mod_id, 'verification.approved', str(app_id),
        f'Approved by {mod_name}')

    return SuccessResponse(message='Application approved.',
        data={'status': 'approved', 'reviewed_by': mod_name})


@router.post('/applications/{app_id}/reject', response_model=SuccessResponse,
    summary='Mod: reject a verification application (reason required)')
async def reject_application(
    app_id: uuid.UUID,
    request: Request,
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(
            set(payload.get('roles', []))):
        raise ForbiddenError('Moderator access required.')

    body = await request.json()
    cat = (body.get('rejection_category') or '').strip()
    reason = (body.get('rejection_reason') or '').strip()
    notes = (body.get('additional_notes') or '').strip()

    if not cat and not reason:
        raise InvalidInputError('A rejection reason or category is required.')

    mod_id = payload.get('sub', '')
    mod_name = payload.get('full_name', '') or payload.get('email', mod_id) or mod_id
    full_reason = f'{cat}: {reason}' if cat and reason else (cat or reason)

    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            row = (await db.execute(_t("""
                SELECT id, user_id FROM seller_verification_applications
                WHERE CAST(id AS TEXT) = :aid LIMIT 1
            """), {'aid': str(app_id)})).mappings().first()

            if not row:
                raise NotFoundError('Application not found.')

            uid = str(row['user_id'])
            await db.execute(_t("""
                UPDATE seller_verification_applications
                SET status = 'rejected', reviewed_at = NOW(),
                    reviewed_by = :mod_id, reviewer_name = :mod_name,
                    rejection_reason = :reason, rejection_category = :cat,
                    additional_notes = :notes, updated_at = NOW()
                WHERE CAST(id AS TEXT) = :aid
            """), {'mod_id': mod_id, 'mod_name': mod_name, 'reason': reason,
                   'cat': cat, 'notes': notes, 'aid': str(app_id)})
            await db.execute(_t("""
                UPDATE users SET seller_verification_status = 'rejected'
                WHERE CAST(id AS TEXT) = :uid
            """), {'uid': uid})
            await db.commit()

    except (NotFoundError, InvalidInputError):
        raise
    except Exception as e:
        raise InvalidInputError(f'Failed to reject: {e}')

    await _notify(request, uid,
        'Verification Application — Not Approved',
        f'Your seller verification was not approved. Reason: {full_reason}'
        + (f' — {notes}' if notes else '')
        + ' You may update your information and resubmit.')
    await _audit(request, mod_id, 'verification.rejected', str(app_id),
        f'Rejected by {mod_name}. Reason: {full_reason}')

    return SuccessResponse(message='Application rejected.',
        data={'status': 'rejected', 'reviewed_by': mod_name})


@router.post('/applications/{app_id}/request-info', response_model=SuccessResponse,
    summary='Mod: request more information from the applicant')
async def request_more_info(
    app_id: uuid.UUID,
    request: Request,
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(
            set(payload.get('roles', []))):
        raise ForbiddenError('Moderator access required.')

    body = await request.json()
    notes = (body.get('notes') or body.get('message') or '').strip()
    if not notes:
        raise InvalidInputError('Please specify what additional information is needed.')

    mod_id = payload.get('sub', '')
    mod_name = payload.get('full_name', '') or payload.get('email', mod_id) or mod_id

    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            row = (await db.execute(_t("""
                SELECT id, user_id FROM seller_verification_applications
                WHERE CAST(id AS TEXT) = :aid LIMIT 1
            """), {'aid': str(app_id)})).mappings().first()

            if not row:
                raise NotFoundError('Application not found.')

            uid = str(row['user_id'])
            await db.execute(_t("""
                UPDATE seller_verification_applications
                SET status = 'more_info_required', reviewed_at = NOW(),
                    reviewed_by = :mod_id, reviewer_name = :mod_name,
                    additional_notes = :notes, updated_at = NOW()
                WHERE CAST(id AS TEXT) = :aid
            """), {'mod_id': mod_id, 'mod_name': mod_name, 'notes': notes, 'aid': str(app_id)})
            await db.execute(_t("""
                UPDATE users SET seller_verification_status = 'more_info_required'
                WHERE CAST(id AS TEXT) = :uid
            """), {'uid': uid})
            await db.commit()

    except (NotFoundError, InvalidInputError):
        raise
    except Exception as e:
        raise InvalidInputError(f'Failed to update: {e}')

    await _notify(request, uid,
        'Additional Information Required',
        f'Our team needs more information to process your verification: {notes}')
    await _audit(request, mod_id, 'verification.more_info_requested', str(app_id),
        f'More info requested by {mod_name}: {notes}')

    return SuccessResponse(message='More information requested.',
        data={'status': 'more_info_required'})


# ── Admin routes ──────────────────────────────────────────────────────────────

@router.get('/admin/stats', response_model=SuccessResponse,
    summary='Admin: verification stats overview')
async def admin_stats(
    request: Request,
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    if not {'enterprise_admin', 'super_admin'}.intersection(set(payload.get('roles', []))):
        raise ForbiddenError('Admin access required.')

    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            stat_rows = (await db.execute(_t("""
                SELECT status, COUNT(*) AS n
                FROM seller_verification_applications GROUP BY status
            """))).mappings().all()
            stats = {r['status']: int(r['n']) for r in stat_rows}

            recent = (await db.execute(_t("""
                SELECT sva.id, CAST(sva.user_id AS TEXT) AS user_id,
                       sva.status, sva.full_name, sva.seller_type,
                       sva.reviewed_at, sva.reviewer_name,
                       u.email AS user_email
                FROM seller_verification_applications sva
                LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(sva.user_id AS TEXT)
                WHERE sva.status = 'approved'
                ORDER BY sva.reviewed_at DESC LIMIT 10
            """))).mappings().all()

    except Exception as e:
        logger.error('admin_stats_error', error=str(e))
        return SuccessResponse(data={'total': 0, 'by_status': {}, 'recent_approvals': []})

    return SuccessResponse(data={
        'total': sum(stats.values()),
        'by_status': stats,
        'pending': stats.get('submitted', 0) + stats.get('under_review', 0),
        'approved': stats.get('approved', 0),
        'rejected': stats.get('rejected', 0),
        'more_info_required': stats.get('more_info_required', 0),
        'recent_approvals': [_iso(dict(r)) for r in recent],
    })


@router.get('/admin/applications', response_model=SuccessResponse,
    summary='Admin: all applications with full reviewer audit trail')
async def admin_all_applications(
    request: Request,
    payload: dict = Depends(get_current_user_payload),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    if not {'enterprise_admin', 'super_admin'}.intersection(set(payload.get('roles', []))):
        raise ForbiddenError('Admin access required.')

    offset = (page - 1) * page_size
    params: dict = {'lim': page_size, 'off': offset}
    status_sql = 'AND sva.status = :status' if (status and status != 'all') else ''
    if status and status != 'all':
        params['status'] = status

    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _t
            rows = (await db.execute(_t(f"""
                SELECT sva.id, CAST(sva.user_id AS TEXT) AS user_id,
                       sva.status, sva.seller_type,
                       sva.full_name, sva.business_name, sva.display_name,
                       sva.city, sva.country,
                       sva.submitted_at, sva.reviewed_at,
                       sva.reviewer_name, sva.rejection_reason, sva.rejection_category,
                       u.email AS user_email, u.full_name AS user_name,
                       rev.full_name AS reviewer_full_name, rev.email AS reviewer_email
                FROM seller_verification_applications sva
                LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(sva.user_id AS TEXT)
                LEFT JOIN users rev ON CAST(rev.id AS TEXT) = CAST(sva.reviewed_by AS TEXT)
                WHERE 1=1 {status_sql}
                ORDER BY sva.updated_at DESC
                LIMIT :lim OFFSET :off
            """), params)).mappings().all()

            cnt = (await db.execute(_t(f"""
                SELECT COUNT(*) AS n FROM seller_verification_applications sva
                WHERE 1=1 {status_sql}
            """), {k: v for k, v in params.items() if k not in ('lim', 'off')})).mappings().first()
            total = cnt['n'] if cnt else 0

    except Exception as e:
        logger.error('admin_applications_error', error=str(e))
        from shared.errors import paginated_meta
        return SuccessResponse(data=[], meta=paginated_meta(page, page_size, 0))

    from shared.errors import paginated_meta
    return SuccessResponse(
        data=[_iso(dict(r)) for r in rows],
        meta=paginated_meta(page, page_size, total),
    )
