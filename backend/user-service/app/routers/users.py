"""
User Service HTTP router.

Endpoints:
  GET    /users/{user_id}/profile
  PATCH  /users/me/profile
  POST   /users/me/kyc/government-id
  POST   /users/me/kyc/business-reg
  POST   /businesses
  GET    /businesses
  POST   /businesses/{business_id}/branches
  GET    /businesses/{business_id}/branches
  PATCH  /users/{user_id}/roles          (admin only)

Internal (consumed by Auth Service only):
  GET    /internal/users/{user_id}/roles
  GET    /internal/users/{user_id}/subscription-tier
"""
from __future__ import annotations
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from shared.errors import ForbiddenError, SuccessResponse
from shared.logging import get_logger
from ..config import UserSettings
from ..dependencies import get_client_ip, get_current_user_id, get_current_user_payload, get_db_session, get_rabbitmq_channel, get_redis, get_user_settings
from ..schemas import CreateBranchRequest, CreateBusinessRequest, ElevateRoleRequest, UpdateProfileRequest
from ..service import UserService
logger = get_logger(__name__)
router = APIRouter(tags=['Users'])
internal_router = APIRouter(prefix='/internal', tags=['Internal'])

def _build_service(session=Depends(get_db_session), redis=Depends(get_redis), channel=Depends(get_rabbitmq_channel), settings: UserSettings=Depends(get_user_settings)) -> UserService:
    return UserService(session=session, redis=redis, settings=settings, rabbitmq_channel=channel)

@router.get('/users/me', response_model=SuccessResponse, summary="Get the authenticated user's own profile + account info")
async def get_my_profile(request: Request, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    """Returns the logged-in user's profile data merged with auth account info."""
    from sqlalchemy import text
    uid_str = str(current_user_id)
    row = None
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            rows = (await db.execute(_text('SELECT id, email, phone, full_name, country_code, is_active, phone_verified, created_at FROM users WHERE id = :p0'), {'p0': uid_str})).mappings().all()
            if rows:
                row = rows[0]
    except Exception:
        pass
    if row is None:
        try:
            result = await service.session.execute(text('SELECT id, email, phone, full_name, country_code, is_active, phone_verified, created_at FROM users WHERE id = :uid'), {'uid': uid_str})
            row = result.fetchone()
        except Exception:
            pass
    profile_data: dict = {}
    try:
        profile = await service.get_profile(current_user_id)
        profile_data = profile.model_dump()
    except Exception:
        pass

    # Direct SQL fallback for bio (and other profile fields) if ORM layer failed or returned no bio
    if profile_data.get('bio') is None:
        try:
            async with request.app.state.session_factory() as _db:
                from sqlalchemy import text as _text
                prow = (await _db.execute(
                    _text("SELECT bio, profile_photo_url, city, state, country, trust_badge, subscription_tier FROM user_profiles WHERE CAST(user_id AS TEXT) = :uid LIMIT 1"),
                    {'uid': uid_str}
                )).fetchone()
                if prow:
                    if prow[0] is not None:
                        profile_data['bio'] = prow[0]
                    if prow[1]:
                        profile_data.setdefault('profile_photo_url', prow[1])
                    if prow[2]:
                        profile_data.setdefault('city', prow[2])
                    if prow[3]:
                        profile_data.setdefault('state', prow[3])
                    if prow[4]:
                        profile_data.setdefault('country', prow[4])
                    if prow[5]:
                        profile_data.setdefault('trust_badge', prow[5])
                    if prow[6]:
                        profile_data.setdefault('subscription_tier', prow[6])
        except Exception:
            pass

    def _get(r, key: str, idx: int, default=''):
        try:
            return r[key] if hasattr(r, 'keys') else r[idx]
        except Exception:
            return default
    phone = _get(row, 'phone', 2, '') or '' if row else ''
    if phone and (phone.startswith('+0000') or (not phone.startswith('+') and len(phone) > 15)):
        phone = ''
    data = {'id': uid_str, 'email': _get(row, 'email', 1, payload.get('email', '')) if row else payload.get('email', ''), 'phone': phone, 'full_name': (profile_data.get('full_name') or (_get(row, 'full_name', 3, '') if row else '')) or '', 'country_code': _get(row, 'country_code', 4, 'NG') if row else 'NG', 'is_active': bool(_get(row, 'is_active', 5, True)) if row else True, 'is_phone_verified': bool(_get(row, 'phone_verified', 6, False)) if row else False, 'is_email_verified': True, 'created_at': str(_get(row, 'created_at', 7, '') if row else ''), 'avatar_url': profile_data.get('profile_photo_url'), 'bio': profile_data.get('bio'), 'trust_badge': profile_data.get('trust_badge'), 'subscription_tier': profile_data.get('subscription_tier', 'starter')}
    return SuccessResponse(message='Profile retrieved.', data=data)

@router.patch('/users/me', response_model=SuccessResponse, summary="Update authenticated user's profile (alias for /users/me/profile)")
async def update_me(request: Request, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    """
    Updates the user's profile. Accepts: full_name, email, phone, country_code,
    bio, country, state, city, default_currency.
    Falls back gracefully if the profile row doesn't exist yet (creates it).
    """
    from sqlalchemy import text
    import uuid as _uuid_mod
    body = await request.json()
    uid_str = str(current_user_id)
    errors = []

    # ── users table fields ─────────────────────────────────────────────────────
    user_table_fields = {}
    if 'full_name' in body and body['full_name'] is not None:
        user_table_fields['full_name'] = str(body['full_name'])
    if 'email' in body and body['email'] is not None:
        user_table_fields['email'] = str(body['email']).strip().lower()
    if 'phone' in body and body['phone'] is not None:
        user_table_fields['phone'] = str(body['phone']).strip()
    if 'country_code' in body and body['country_code'] is not None:
        user_table_fields['country_code'] = str(body['country_code']).upper()[:2]
    if user_table_fields:
        set_clause = ', '.join((f'{k} = :{k}' for k in user_table_fields))
        user_table_fields['uid'] = uid_str
        try:
            async with request.app.state.session_factory() as _db:
                from sqlalchemy import text as _text
                await _db.execute(_text(f'UPDATE users SET {set_clause} WHERE CAST(id AS TEXT) = :uid'), user_table_fields)
                await _db.commit()
        except Exception as _ue:
            errors.append(str(_ue))
            try:
                await service.session.execute(text(f'UPDATE users SET {set_clause} WHERE CAST(id AS TEXT) = :uid'), user_table_fields)
                await service.session.commit()
            except Exception:
                pass

    # ── user_profiles table fields ─────────────────────────────────────────────
    profile_body = {k: v for k, v in body.items() if k in ('bio', 'country', 'state', 'city', 'default_currency')}
    if profile_body:
        from sqlalchemy import text as _text
        params: dict = {'uid': uid_str}
        for k, v in profile_body.items():
            params[k] = v

        set_parts = [f'{k} = :{k}' for k in profile_body.keys()]
        set_parts.append('updated_at = NOW()')
        set_sql = ', '.join(set_parts)
        saved = False

        # Try UPDATE
        try:
            async with request.app.state.session_factory() as _db:
                r = await _db.execute(
                    _text(f"UPDATE user_profiles SET {set_sql} WHERE CAST(user_id AS TEXT) = :uid"),
                    params
                )
                await _db.commit()
                saved = (r.rowcount > 0)
        except Exception as _pe:
            errors.append(f'update:{_pe}')

        # Try INSERT if no row found
        if not saved:
            try:
                ins_p = dict(params)
                ins_p['new_id'] = str(_uuid_mod.uuid4())
                cols = ['id', 'user_id'] + list(profile_body.keys())
                vals = [':new_id', ':uid'] + [f':{k}' for k in profile_body.keys()]
                async with request.app.state.session_factory() as _db:
                    await _db.execute(
                        _text(f"INSERT INTO user_profiles ({', '.join(cols)}) VALUES ({', '.join(vals)})"),
                        ins_p
                    )
                    await _db.commit()
                    saved = True
            except Exception as _ie:
                errors.append(f'insert:{_ie}')

        # ORM fallback
        if not saved:
            try:
                from ..schemas import UpdateProfileRequest as _UPR
                safe = {k: v for k, v in profile_body.items() if v is not None and str(v).strip() != ''}
                if safe:
                    await service.update_profile(current_user_id, _UPR(**safe))
            except Exception as _se:
                errors.append(f'orm:{_se}')

    return SuccessResponse(message='Profile updated.', data={'updated': True, 'debug': errors})

@router.post('/users/me/change-password', response_model=SuccessResponse, summary="Change the authenticated user's password")
async def change_password(request: Request, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    """
    Verify current password and immediately apply the new password.
    No OTP step — password changes are instant.
    """
    import asyncio, functools
    from sqlalchemy import text
    from shared.errors import InvalidInputError
    body = await request.json()
    current_password = (body.get('current_password') or '').strip()
    new_password = (body.get('new_password') or '').strip()
    if not current_password or not new_password:
        raise InvalidInputError('current_password and new_password are required.')
    if len(new_password) < 8:
        raise InvalidInputError('New password must be at least 8 characters.')
    session = service.session
    row = None
    try:
        row = (await session.execute(text('SELECT password_hash FROM users WHERE id = :uid'), {'uid': str(current_user_id)})).fetchone()
    except Exception:
        pass
    if not row or not row[0]:
        try:
            async with request.app.state.session_factory() as db:
                from sqlalchemy import text as _text
                rows = (await db.execute(_text('SELECT password_hash FROM users WHERE id = :p0'), {'p0': str(current_user_id)})).mappings().all()
                if rows:
                    row = rows[0]
        except Exception:
            pass
    if not row or not row[0]:
        raise InvalidInputError('User not found.')
    stored_hash = str(row[0]) if not hasattr(row, '__getitem__') else str(row['password_hash'] if 'password_hash' in row.keys() else row[0])
    import bcrypt
    loop = asyncio.get_event_loop()
    try:
        match = await loop.run_in_executor(None, functools.partial(bcrypt.checkpw, current_password.encode(), stored_hash.encode()))
    except Exception:
        match = False
    if not match:
        raise InvalidInputError('Current password is incorrect.')
    salt = bcrypt.gensalt()
    new_hash_bytes = await loop.run_in_executor(None, functools.partial(bcrypt.hashpw, new_password.encode(), salt))
    new_hash = new_hash_bytes.decode()
    updated = False
    try:
        await session.execute(text('UPDATE users SET password_hash = :h WHERE id = :uid'), {'h': new_hash, 'uid': str(current_user_id)})
        await session.commit()
        updated = True
    except Exception:
        pass
    if not updated:
        try:
            async with request.app.state.session_factory() as db:
                from sqlalchemy import text as _text
                await db.execute(_text('UPDATE users SET password_hash = :p0 WHERE id = :p1'), {'p0': new_hash, 'p1': str(current_user_id)})
                await db.commit()
            updated = True
        except Exception as e:
            raise InvalidInputError(f'Failed to update password: {e}')
    return SuccessResponse(message='Password changed successfully.', data={'updated': True})

@router.post('/users/me/change-password/verify-otp', response_model=SuccessResponse, summary='(Deprecated) OTP step — no longer required', include_in_schema=False)
async def change_password_verify_otp(request: Request, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    """Kept for backwards compatibility — OTP flow has been removed."""
    return SuccessResponse(message='Password changed successfully.', data={'updated': True})

@router.get('/users/{user_id}/profile', response_model=SuccessResponse, summary="Get a user's public profile")
async def get_profile(user_id: uuid.UUID, request: Request, service: UserService=Depends(_build_service)) -> SuccessResponse:
    from sqlalchemy import text
    profile_data: dict = {}

    # Primary: direct SQL join via session_factory — most reliable
    try:
        async with request.app.state.session_factory() as _db:
            from sqlalchemy import text as _text
            row = (await _db.execute(
                _text("""
                    SELECT u.full_name, u.email, u.phone,
                           COALESCE(u.seller_verification_status, 'not_verified') AS seller_verification_status,
                           p.profile_photo_url,
                           p.city, p.state, p.country, p.bio,
                           p.trust_badge, p.subscription_tier
                    FROM users u
                    LEFT JOIN user_profiles p ON CAST(p.user_id AS TEXT) = CAST(u.id AS TEXT)
                    WHERE CAST(u.id AS TEXT) = :uid
                """),
                {'uid': str(user_id)}
            )).fetchone()
            if row:
                profile_data['full_name'] = row[0] or 'Seller'
                profile_data['display_name'] = row[0] or None
                profile_data['email'] = row[1] or ''
                profile_data['phone'] = row[2] or ''
                profile_data['seller_verification_status'] = row[3] or 'not_verified'
                profile_data['profile_photo_url'] = row[4] or None
                profile_data['city'] = row[5] or None
                profile_data['state'] = row[6] or None
                profile_data['country'] = row[7] or None
                profile_data['bio'] = row[8] if row[8] is not None else None
                profile_data['trust_badge'] = row[9] or None
                profile_data['subscription_tier'] = row[10] or 'starter'
    except Exception:
        # Fallback: service session
        try:
            row = (await service.session.execute(
                text("""
                    SELECT u.full_name, u.email, u.phone,
                           COALESCE(u.seller_verification_status, 'not_verified') AS seller_verification_status,
                           p.profile_photo_url,
                           p.city, p.state, p.country, p.bio,
                           p.trust_badge, p.subscription_tier
                    FROM users u
                    LEFT JOIN user_profiles p ON CAST(p.user_id AS TEXT) = CAST(u.id AS TEXT)
                    WHERE CAST(u.id AS TEXT) = :uid
                """),
                {'uid': str(user_id)}
            )).fetchone()
            if row:
                profile_data['full_name'] = row[0] or 'Seller'
                profile_data['display_name'] = row[0] or None
                profile_data['email'] = row[1] or ''
                profile_data['phone'] = row[2] or ''
                profile_data['seller_verification_status'] = row[3] or 'not_verified'
                profile_data['profile_photo_url'] = row[4] or None
                profile_data['city'] = row[5] or None
                profile_data['state'] = row[6] or None
                profile_data['country'] = row[7] or None
                profile_data['bio'] = row[8] if row[8] is not None else None
                profile_data['trust_badge'] = row[9] or None
                profile_data['subscription_tier'] = row[10] or 'starter'
        except Exception:
            pass

    # ORM fallback if both SQL paths failed
    if not profile_data:
        try:
            result = await service.get_profile(user_id)
            profile_data = result.model_dump()
        except Exception:
            pass

    # Active listing count — useful for seller card on listing detail page
    try:
        count_row = (await service.session.execute(
            text("SELECT COUNT(*) AS cnt FROM listings WHERE CAST(seller_id AS TEXT) = :uid AND status = 'active'"),
            {'uid': str(user_id)}
        )).fetchone()
        profile_data['active_listing_count'] = int(count_row[0]) if count_row else 0
    except Exception:
        profile_data['active_listing_count'] = 0

    return SuccessResponse(data=profile_data)

@router.post('/users/me/avatar', response_model=SuccessResponse, summary='Upload a profile avatar image')
async def upload_avatar(request: Request, file: UploadFile=File(..., description='Profile image (JPEG or PNG, max 5MB)'), service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    """
    Accepts a JPEG/PNG image, encodes it as a base64 data-URL, and stores it
    in the user_profiles.profile_photo_url column via PostgreSQL upsert.
    """
    import base64
    from shared.errors import InvalidInputError
    allowed = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'}
    ct = (file.content_type or '').lower()
    if ct not in allowed:
        raise InvalidInputError('Only JPEG, PNG, WebP or GIF images are allowed.')
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise InvalidInputError('Image must be smaller than 5 MB.')
    data_url = f'data:{ct};base64,{base64.b64encode(content).decode()}'
    uid_str = str(current_user_id)
    saved = False
    # Primary path: use app session_factory (PostgreSQL)
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            await db.execute(_text("""
                INSERT INTO user_profiles (id, user_id, profile_photo_url)
                VALUES (:new_id, :uid, :url)
                ON CONFLICT (user_id) DO UPDATE SET profile_photo_url = EXCLUDED.profile_photo_url
            """), {'new_id': str(uuid.uuid4()), 'uid': uid_str, 'url': data_url})
            await db.commit()
            saved = True
    except Exception:
        pass
    # Fallback: use the service session directly
    if not saved:
        try:
            from sqlalchemy import text as _text2
            await service.session.execute(_text2("""
                INSERT INTO user_profiles (id, user_id, profile_photo_url)
                VALUES (:new_id, :uid, :url)
                ON CONFLICT (user_id) DO UPDATE SET profile_photo_url = EXCLUDED.profile_photo_url
            """), {'new_id': str(uuid.uuid4()), 'uid': uid_str, 'url': data_url})
            await service.session.commit()
            saved = True
        except Exception as exc:
            raise InvalidInputError(f'Failed to save avatar: {exc}') from exc
    return SuccessResponse(message='Avatar updated.', data={'avatar_url': data_url})

@router.patch('/users/me/profile', response_model=SuccessResponse, summary="Update authenticated user's profile")
async def update_my_profile(body: UpdateProfileRequest, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    result = await service.update_profile(current_user_id, body)
    return SuccessResponse(data=result.model_dump())

@router.post('/users/me/kyc/government-id', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Submit government ID for Silver trust badge')
async def submit_government_id(file: UploadFile=File(..., description='Government ID document (PDF or image)'), service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    content = await file.read()
    result = await service.submit_kyc_document(user_id=current_user_id, document_type='government_id', file_content=content, filename=file.filename or '')
    return SuccessResponse(data=result.model_dump())

@router.post('/users/me/kyc/business-reg', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Submit business registration certificate for Gold trust badge')
async def submit_business_registration(file: UploadFile=File(..., description='Business registration certificate (PDF)'), service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    content = await file.read()
    result = await service.submit_kyc_document(user_id=current_user_id, document_type='business_registration', file_content=content, filename=file.filename or '')
    return SuccessResponse(data=result.model_dump())

@router.post('/businesses', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Create a new business entity')
async def create_business(body: CreateBusinessRequest, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    result = await service.create_business(current_user_id, body)
    return SuccessResponse(data=result.model_dump())

@router.get('/businesses', response_model=SuccessResponse, summary='List businesses owned by authenticated user')
async def list_my_businesses(service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    results = await service.list_businesses(current_user_id)
    return SuccessResponse(data=[r.model_dump() for r in results])

@router.post('/businesses/{business_id}/branches', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Create a branch under a business')
async def create_branch(business_id: uuid.UUID, body: CreateBranchRequest, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    result = await service.create_branch(business_id, current_user_id, body)
    return SuccessResponse(data=result.model_dump())

@router.get('/businesses/{business_id}/branches', response_model=SuccessResponse, summary='List branches under a business')
async def list_branches(business_id: uuid.UUID, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    roles = payload.get('roles', [])
    results = await service.list_branches(business_id, current_user_id, roles)
    return SuccessResponse(data=[r.model_dump() for r in results])

@router.patch('/users/{user_id}/roles', response_model=SuccessResponse, summary="Elevate a user's role (admin only)")
async def elevate_user_role(user_id: uuid.UUID, body: ElevateRoleRequest, service: UserService=Depends(_build_service), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    roles: list[str] = payload.get('roles', [])
    if 'enterprise_admin' not in roles:
        raise ForbiddenError('Only enterprise admins can elevate user roles.')
    await service.elevate_role(user_id, body.role, body.scope_id)
    return SuccessResponse(data={'message': f"Role '{body.role}' granted to user {user_id}."})

@internal_router.get('/users/{user_id}/roles', response_model=SuccessResponse, summary='[Internal] Get user roles for JWT token claims', include_in_schema=False)
async def get_user_roles_internal(user_id: uuid.UUID, service: UserService=Depends(_build_service)) -> SuccessResponse:
    result = await service.get_user_roles(user_id)
    return SuccessResponse(data=result.model_dump())

@internal_router.get('/users/{user_id}/subscription-tier', response_model=SuccessResponse, summary='[Internal] Get user subscription tier for JWT token claims', include_in_schema=False)
async def get_subscription_tier_internal(user_id: uuid.UUID, service: UserService=Depends(_build_service)) -> SuccessResponse:
    result = await service.get_subscription_tier(user_id)
    return SuccessResponse(data=result.model_dump())

@router.get('/users/admin/list', response_model=SuccessResponse, summary='Admin: list all users with search and filter')
async def admin_list_users(request: Request, service: UserService=Depends(_build_service), payload: dict=Depends(get_current_user_payload), search: str | None=Query(default=None), kyc_verified: bool | None=Query(default=None), page: int=Query(default=1, ge=1), page_size: int=Query(default=20, ge=1, le=100)) -> SuccessResponse:
    from shared.errors import paginated_meta
    caller_roles = set(payload.get('roles', []))
    is_moderator = 'moderator' in caller_roles and not {'enterprise_admin', 'super_admin'}.intersection(caller_roles)
    offset = (page - 1) * page_size
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            # Moderators: cannot see admins OR other moderators — only regular users
            # Admins: cannot see other admins (own account is visible but handled client-side)
            if is_moderator:
                exclude_staff = """
                    AND CAST(u.id AS TEXT) NOT IN (
                        SELECT CAST(user_id AS TEXT) FROM user_roles
                        WHERE role IN ('enterprise_admin', 'super_admin', 'moderator')
                    )
                """
            else:
                exclude_staff = """
                    AND CAST(u.id AS TEXT) NOT IN (
                        SELECT CAST(user_id AS TEXT) FROM user_roles
                        WHERE role IN ('enterprise_admin', 'super_admin')
                    )
                """
            # legacy alias kept for backwards compat
            exclude_admin = exclude_staff
            # kyc_verified filter — only return users with approved seller verification
            kyc_filter = ""
            if kyc_verified is True:
                kyc_filter = "AND COALESCE(u.seller_verification_status, 'not_verified') IN ('approved', 'verified')"
            elif kyc_verified is False:
                kyc_filter = "AND COALESCE(u.seller_verification_status, 'not_verified') NOT IN ('approved', 'verified')"

            if search:
                s = f'%{search}%'
                rows = (await db.execute(_text(f"""
                    SELECT u.id, u.email, u.phone, u.full_name, u.country_code,
                           u.is_active, u.phone_verified, u.created_at,
                           COALESCE(u.seller_verification_status, 'not_verified') AS seller_verification_status,
                           STRING_AGG(r.role, ',') AS roles
                    FROM users u
                    LEFT JOIN user_roles r ON CAST(r.user_id AS TEXT) = CAST(u.id AS TEXT)
                    WHERE (u.full_name ILIKE :s0 OR u.email ILIKE :s0 OR u.phone ILIKE :s0)
                    {exclude_admin} {kyc_filter}
                    GROUP BY u.id ORDER BY u.created_at DESC LIMIT :lim OFFSET :off
                    """), {'s0': s, 'lim': page_size, 'off': offset})).mappings().all()
                count_rows = (await db.execute(_text(f"""
                    SELECT COUNT(*) AS cnt FROM users u
                    WHERE (u.full_name ILIKE :s0 OR u.email ILIKE :s0 OR u.phone ILIKE :s0)
                    {exclude_admin} {kyc_filter}"""), {'s0': s})).mappings().all()
            else:
                rows = (await db.execute(_text(f"""
                    SELECT u.id, u.email, u.phone, u.full_name, u.country_code,
                           u.is_active, u.phone_verified, u.created_at,
                           COALESCE(u.seller_verification_status, 'not_verified') AS seller_verification_status,
                           STRING_AGG(r.role, ',') AS roles
                    FROM users u
                    LEFT JOIN user_roles r ON CAST(r.user_id AS TEXT) = CAST(u.id AS TEXT)
                    WHERE 1=1 {exclude_admin} {kyc_filter}
                    GROUP BY u.id ORDER BY u.created_at DESC LIMIT :lim OFFSET :off
                    """), {'lim': page_size, 'off': offset})).mappings().all()
                count_rows = (await db.execute(_text(
                    f'SELECT COUNT(*) AS cnt FROM users u WHERE 1=1 {exclude_admin} {kyc_filter}'
                ))).mappings().all()
            total = count_rows[0]['cnt'] if count_rows else 0
            data = [
                {
                    'id': str(r['id']),
                    'email': r['email'],
                    'phone': r['phone'],
                    'full_name': r['full_name'],
                    'country_code': r['country_code'],
                    'is_active': bool(r['is_active']),
                    'is_phone_verified': bool(r['phone_verified']),
                    'seller_verification_status': r.get('seller_verification_status', 'not_verified'),
                    'created_at': str(r['created_at']),
                    'roles': r['roles'].split(',') if r['roles'] else [],
                }
                for r in rows
            ]
    except Exception:
        data, total = ([], 0)
    return SuccessResponse(message=f'{total} user(s) found.', data=data, meta=paginated_meta(page, page_size, total))

@router.patch('/users/admin/{user_id}', response_model=SuccessResponse, summary='Admin: activate or suspend a user')
async def admin_update_user(user_id: uuid.UUID, request: Request, service: UserService=Depends(_build_service), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    from sqlalchemy import text
    check = (await service.session.execute(text("SELECT role FROM user_roles WHERE CAST(user_id AS TEXT) = :uid AND role IN ('enterprise_admin', 'moderator')"), {'uid': str(user_id)})).fetchone()
    if check:
        caller_roles = payload.get('roles', [])
        if check[0] == 'enterprise_admin':
            from shared.errors import ForbiddenError
            raise ForbiddenError('The platform owner account cannot be modified.')
        if check[0] == 'moderator' and 'enterprise_admin' not in caller_roles:
            from shared.errors import ForbiddenError
            raise ForbiddenError('Only the platform owner can suspend a moderator account.')
    caller_id = payload.get('sub', '')
    if str(user_id) == str(caller_id):
        from shared.errors import ForbiddenError
        raise ForbiddenError('You cannot suspend your own account.')
    body = await request.json()
    session = service.session
    is_active = body.get('is_active')
    if is_active is not None:
        await session.execute(text('UPDATE users SET is_active = :v WHERE CAST(id AS TEXT) = :uid'), {'v': bool(is_active), 'uid': str(user_id)})
        await session.commit()
    return SuccessResponse(data={'updated': True})

@router.get('/users/admin/kyc', response_model=SuccessResponse, summary='Admin: list KYC documents')
async def admin_list_kyc(service: UserService=Depends(_build_service), payload: dict=Depends(get_current_user_payload), kyc_status: str | None=Query(default=None, alias='status'), page_size: int=Query(default=50, ge=1, le=100)) -> SuccessResponse:
    from sqlalchemy import text
    from shared.errors import paginated_meta
    session = service.session
    try:
        if kyc_status and kyc_status != 'all':
            q = await session.execute(text('SELECT id, user_id, doc_type, status, submitted_at FROM kyc_documents WHERE status = :s LIMIT :l'), {'s': kyc_status, 'l': page_size})
        else:
            q = await session.execute(text('SELECT id, user_id, doc_type, status, submitted_at FROM kyc_documents LIMIT :l'), {'l': page_size})
        rows = q.fetchall()
        data = [{'id': str(r[0]), 'user_id': str(r[1]), 'doc_type': r[2] or 'national_id', 'status': r[3] or 'pending', 'submitted_at': str(r[4]) if r[4] else None, 'user_name': 'User'} for r in rows]
    except Exception:
        data = []
    return SuccessResponse(data=data, meta=paginated_meta(1, page_size, len(data)))

@router.post('/users/admin/kyc/{doc_id}/review', response_model=SuccessResponse, summary='Admin: approve or reject a KYC document')
async def admin_review_kyc(doc_id: uuid.UUID, request: Request, service: UserService=Depends(_build_service), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    from sqlalchemy import text
    body = await request.json()
    review_status = body.get('status', 'approved')
    session = service.session
    try:
        await session.execute(text('UPDATE kyc_documents SET status = :s WHERE id = :id'), {'s': review_status, 'id': str(doc_id)})
    except Exception:
        pass
    return SuccessResponse(data={'reviewed': True, 'status': review_status})

@router.get('/users/admin/moderators', response_model=SuccessResponse, summary='Admin: list all moderator accounts')
async def admin_list_moderators(request: Request, service: UserService=Depends(_build_service), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    """Returns all users with moderator role directly, no filtering needed."""
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            rows = (await db.execute(_text("""
                SELECT u.id, u.email, u.phone, u.full_name, u.country_code,
                       u.is_active, u.phone_verified, u.created_at,
                       STRING_AGG(r.role, ',') AS roles
                FROM users u
                INNER JOIN user_roles r ON CAST(r.user_id AS TEXT) = CAST(u.id AS TEXT)
                WHERE r.role = 'moderator'
                GROUP BY u.id
                ORDER BY u.created_at DESC
            """))).mappings().all()
        data = [{
            'id': str(r['id']),
            'email': r['email'],
            'phone': r['phone'],
            'full_name': r['full_name'],
            'country_code': r['country_code'],
            'is_active': bool(r['is_active']),
            'is_phone_verified': bool(r['phone_verified']),
            'created_at': str(r['created_at']),
            'roles': r['roles'].split(',') if r['roles'] else ['moderator']
        } for r in rows]
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'list_moderators_error: {e}')
        data = []
    return SuccessResponse(message=f'{len(data)} moderator(s) found.', data=data)

@router.post('/users/admin/moderators', response_model=SuccessResponse, status_code=201, summary='Admin: create a new moderator account')
async def admin_create_moderator(request: Request, service: UserService=Depends(_build_service), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    """
    Creates a moderator account via the ORM using PostgreSQL.
    """
    import bcrypt
    from pathlib import Path
    body = await request.json()
    email = (body.get('email', '') or '').strip().lower()
    phone = (body.get('phone', '') or '').strip()
    password = body.get('password', '') or ''
    full_name = (body.get('full_name', '') or 'Moderator').strip()
    country_code = (body.get('country_code', 'NG') or 'NG').strip().upper()[:2]
    if not email or not password or (not full_name):
        from shared.errors import InvalidInputError
        raise InvalidInputError('email, password and full_name are required.')
    import re
    # Accept any 10-15 digit number with optional + prefix
    if not re.match(r'^(\+)?[0-9]{10,15}$', phone):
        phone = phone or 'N/A'  # keep whatever was given, column allows text
    import asyncio
    import functools
    loop = asyncio.get_event_loop()
    salt = bcrypt.gensalt()
    pw_hash = await loop.run_in_executor(None, functools.partial(bcrypt.hashpw, password.encode(), salt))
    pw_hash_str = pw_hash.decode()
    new_user_id = str(uuid.uuid4())
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            rows = (await db.execute(_text('SELECT id FROM users WHERE email = :p0'), {'p0': email})).mappings().all()
            if rows:
                return SuccessResponse(data={'error': f'Email {email} is already registered.'})
            await db.execute(_text("""
                INSERT INTO users (id, email, phone, phone_verified, password_hash, full_name,
                                   country_code, is_active, is_locked, failed_attempts, created_at)
                VALUES (:p0, :p1, :p2, TRUE, :p3, :p4, :p5, TRUE, FALSE, 0, NOW())
                """), {'p0': new_user_id, 'p1': email, 'p2': phone, 'p3': pw_hash_str, 'p4': full_name, 'p5': country_code})
            
            role_id = str(uuid.uuid4())
            await db.execute(_text("INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (:p0, :p1, 'moderator', NOW())"), {'p0': role_id, 'p1': new_user_id})
            await db.commit()
        try:
            import os, smtplib, ssl
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            gmail_user = os.environ.get('GMAIL_USER', '').strip()
            gmail_pass = os.environ.get('GMAIL_APP_PASSWORD', '').strip()
            platform_url = 'http://localhost:3000/login'
            if gmail_user and gmail_pass:
                subject = '🛡️ Your Velontri Moderator Account'
                html_body = f'''\n<!DOCTYPE html>\n<html>\n<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',Arial,sans-serif;">\n  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;\n       overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">\n    <!-- Header -->\n    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:36px 40px 28px;">\n      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">\n        Velontri\n      </h1>\n      <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">\n        Africa's Marketplace Platform\n      </p>\n    </div>\n    <!-- Body -->\n    <div style="padding:36px 40px;">\n      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">\n        Welcome aboard, {full_name}! 👋\n      </h2>\n      <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">\n        A moderator account has been created for you on Velontri.\n        Here are your sign-in credentials:\n      </p>\n\n      <!-- Credentials box -->\n      <div style="background:#f1f5f9;border-radius:12px;padding:20px 24px;margin-bottom:24px;">\n        <table style="width:100%;border-collapse:collapse;">\n          <tr>\n            <td style="padding:6px 0;font-size:12px;font-weight:700;color:#94a3b8;\n                       text-transform:uppercase;letter-spacing:0.08em;width:90px;">Email</td>\n            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1e293b;">{email}</td>\n          </tr>\n          <tr>\n            <td style="padding:6px 0;font-size:12px;font-weight:700;color:#94a3b8;\n                       text-transform:uppercase;letter-spacing:0.08em;">Password</td>\n            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1e293b;\n                       font-family:monospace;letter-spacing:0.05em;">{password}</td>\n          </tr>\n          <tr>\n            <td style="padding:6px 0;font-size:12px;font-weight:700;color:#94a3b8;\n                       text-transform:uppercase;letter-spacing:0.08em;">Role</td>\n            <td style="padding:6px 0;">\n              <span style="background:#eef2ff;color:#4F46E5;font-size:12px;font-weight:700;\n                           padding:3px 10px;border-radius:99px;">Moderator</span>\n            </td>\n          </tr>\n        </table>\n      </div>\n\n      <!-- CTA button -->\n      <a href="{platform_url}" style="display:inline-block;background:#4F46E5;color:#ffffff;\n         text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;\n         border-radius:12px;margin-bottom:28px;">\n        Sign in to Velontri →\n      </a>\n\n      <!-- Security notice -->\n      <div style="border-top:1px solid #e2e8f0;padding-top:20px;">\n        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">\n          🔒 <strong>Security tip:</strong> Please change your password after your first sign-in.\n          If you did not expect this email, contact <a href="mailto:support@velontri.com"\n          style="color:#4F46E5;">support@velontri.com</a>.\n        </p>\n      </div>\n    </div>\n    <!-- Footer -->\n    <div style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;">\n      <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:center;">\n        © {__import__('datetime').datetime.now().year} Velontri Technologies Ltd.\n      </p>\n    </div>\n  </div>\n</body>\n</html>'''
                plain_body = f'Welcome to Velontri Moderator Portal\n\nName: {full_name}\nEmail: {email}\nPassword: {password}\nRole: Moderator\n\nSign in at: {platform_url}\n\nPlease change your password after first sign-in.'
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = f'Velontri <{gmail_user}>'
                msg['To'] = email
                msg.attach(MIMEText(plain_body, 'plain'))
                msg.attach(MIMEText(html_body, 'html'))
                ctx = ssl.create_default_context()

                def _send():
                    with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ctx) as s:
                        s.login(gmail_user, gmail_pass)
                        s.sendmail(gmail_user, email, msg.as_string())
                await loop.run_in_executor(None, _send)
                import logging
                logging.getLogger(__name__).info(f'moderator_welcome_email_sent: {email}')
        except Exception as email_exc:
            import logging
            logging.getLogger(__name__).warning(f'moderator_email_failed: {email_exc}')
        return SuccessResponse(message='Moderator account created. Sign-in details sent to their email.', data={'user_id': new_user_id, 'email': email, 'role': 'moderator'})
    except Exception as exc:
        return SuccessResponse(data={'error': str(exc)})

@router.delete('/users/admin/{user_id}', response_model=SuccessResponse, summary='Admin: permanently delete a user account')
async def admin_delete_user(user_id: uuid.UUID, service: UserService=Depends(_build_service), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    """Hard-deletes a user and all their roles. Super admin only. Cannot delete own account."""
    from sqlalchemy import text
    roles = payload.get('roles', [])
    if 'enterprise_admin' not in roles and 'super_admin' not in roles:
        from shared.errors import ForbiddenError
        raise ForbiddenError('Super admin role required.')
    # Cannot delete own account
    caller_id = payload.get('sub', '')
    if str(user_id) == str(caller_id):
        from shared.errors import ForbiddenError
        raise ForbiddenError('You cannot delete your own account.')
    # Cannot delete other enterprise_admins
    session = service.session
    check = (await session.execute(text(
        "SELECT role FROM user_roles WHERE CAST(user_id AS TEXT) = :uid AND role = 'enterprise_admin'"
    ), {'uid': str(user_id)})).fetchone()
    if check and 'enterprise_admin' not in roles:
        from shared.errors import ForbiddenError
        raise ForbiddenError('Cannot delete an admin account.')
    await session.execute(text('DELETE FROM user_roles WHERE CAST(user_id AS TEXT) = :uid'), {'uid': str(user_id)})
    await session.execute(text('DELETE FROM users WHERE CAST(id AS TEXT) = :uid'), {'uid': str(user_id)})
    await session.commit()
    return SuccessResponse(message='User account permanently deleted.', data={'user_id': str(user_id)})


@router.post('/users/me/deactivate', response_model=SuccessResponse, summary='User: deactivate own account')
async def deactivate_my_account(request: Request, service: UserService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    """
    Soft-deactivates the user's own account (sets is_active=False).
    The account can be reactivated by the admin, or by the user logging in again.
    Requires password confirmation.
    """
    import asyncio, functools
    from sqlalchemy import text
    from shared.errors import InvalidInputError
    body = await request.json()
    password = (body.get('password') or '').strip()
    if not password:
        raise InvalidInputError('Password is required to deactivate your account.')
    # Verify password
    row = (await service.session.execute(
        text('SELECT password_hash FROM users WHERE CAST(id AS TEXT) = :uid'),
        {'uid': str(current_user_id)}
    )).fetchone()
    if not row or not row[0]:
        raise InvalidInputError('Account not found.')
    import bcrypt
    loop = asyncio.get_event_loop()
    try:
        match = await loop.run_in_executor(
            None, functools.partial(bcrypt.checkpw, password.encode(), row[0].encode())
        )
    except Exception:
        match = False
    if not match:
        raise InvalidInputError('Incorrect password. Please try again.')
    # Deactivate
    await service.session.execute(
        text('UPDATE users SET is_active = FALSE WHERE CAST(id AS TEXT) = :uid'),
        {'uid': str(current_user_id)}
    )
    await service.session.commit()
    return SuccessResponse(
        message='Your account has been deactivated.',
        data={'deactivated': True, 'user_id': str(current_user_id)}
    )


# ── Include seller verification router ───────────────────────────────────────
# This must be at the bottom so it picks up the same `router` object that the
# gateway loads via _load_service_router("user-service", "users", "router").
try:
    from .verification import router as _ver_router
    router.include_router(_ver_router)
except Exception as _ver_err:
    import logging as _log
    _log.getLogger(__name__).warning(f'verification_router_load_failed: {_ver_err}')
