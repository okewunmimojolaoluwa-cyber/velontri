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
from ..dependencies import (
    get_client_ip,
    get_current_user_id,
    get_current_user_payload,
    get_db_session,
    get_rabbitmq_channel,
    get_redis,
    get_user_settings,
)
from ..schemas import (
    CreateBranchRequest,
    CreateBusinessRequest,
    ElevateRoleRequest,
    UpdateProfileRequest,
)
from ..service import UserService

logger = get_logger(__name__)

router = APIRouter(tags=["Users"])
internal_router = APIRouter(prefix="/internal", tags=["Internal"])


def _build_service(
    session=Depends(get_db_session),
    redis=Depends(get_redis),
    channel=Depends(get_rabbitmq_channel),
    settings: UserSettings = Depends(get_user_settings),
) -> UserService:
    return UserService(
        session=session,
        redis=redis,
        settings=settings,
        rabbitmq_channel=channel,
    )


# ── Profile endpoints ─────────────────────────────────────────────────────────

@router.get(
    "/users/me",
    response_model=SuccessResponse,
    summary="Get the authenticated user's own profile + account info",
)
async def get_my_profile(
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    """Returns the logged-in user's profile data merged with auth account info."""
    import aiosqlite
    from sqlalchemy import text

    uid_str = str(current_user_id)
    row = None

    # Primary: aiosqlite directly against the canonical DB (always correct file)
    try:
        db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
        async with aiosqlite.connect(str(db_path)) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall(
                "SELECT id, email, phone, full_name, country_code, is_active, phone_verified, created_at FROM users WHERE id = ?",
                [uid_str],
            )
            if rows:
                row = rows[0]
    except Exception:
        pass

    # Fallback: ORM session
    if row is None:
        try:
            result = await service.session.execute(
                text("SELECT id, email, phone, full_name, country_code, is_active, phone_verified, created_at FROM users WHERE id = :uid"),
                {"uid": uid_str},
            )
            row = result.fetchone()
        except Exception:
            pass

    # Fetch extended profile (bio, avatar, etc.)
    profile_data: dict = {}
    try:
        profile = await service.get_profile(current_user_id)
        profile_data = profile.model_dump()
    except Exception:
        pass

    def _get(r, key: str, idx: int, default=""):
        try:
            return r[key] if hasattr(r, "keys") else r[idx]
        except Exception:
            return default

    # Sanitise garbled phone values
    phone = _get(row, "phone", 2, "") or "" if row else ""
    if phone and (phone.startswith("+0000") or (not phone.startswith("+") and len(phone) > 15)):
        phone = ""

    data = {
        "id": uid_str,
        "email": _get(row, "email", 1, payload.get("email", "")) if row else payload.get("email", ""),
        "phone": phone,
        "full_name": (profile_data.get("full_name") or (_get(row, "full_name", 3, "") if row else "")) or "",
        "country_code": _get(row, "country_code", 4, "NG") if row else "NG",
        "is_active": bool(_get(row, "is_active", 5, True)) if row else True,
        "is_phone_verified": bool(_get(row, "phone_verified", 6, False)) if row else False,
        "is_email_verified": True,
        "created_at": str(_get(row, "created_at", 7, "") if row else ""),
        "avatar_url": profile_data.get("profile_photo_url"),
        "bio": profile_data.get("bio"),
        "trust_badge": profile_data.get("trust_badge"),
        "subscription_tier": profile_data.get("subscription_tier", "starter"),
    }
    return SuccessResponse(message="Profile retrieved.", data=data)



@router.patch(
    "/users/me",
    response_model=SuccessResponse,
    summary="Update authenticated user's profile (alias for /users/me/profile)",
)
async def update_me(
    request: Request,
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    """
    Updates the user's profile. Accepts: full_name, email, phone, country_code,
    bio, country, state, city, default_currency.
    Falls back gracefully if the profile row doesn't exist yet (creates it).
    """
    from sqlalchemy import text

    body = await request.json()

    # Fields that live in the users table directly
    user_table_fields = {}
    if "full_name"    in body and body["full_name"] is not None:
        user_table_fields["full_name"]    = str(body["full_name"])
    if "email"        in body and body["email"] is not None:
        user_table_fields["email"]        = str(body["email"]).strip().lower()
    if "phone"        in body and body["phone"] is not None:
        user_table_fields["phone"]        = str(body["phone"]).strip()
    if "country_code" in body and body["country_code"] is not None:
        user_table_fields["country_code"] = str(body["country_code"]).upper()[:2]

    if user_table_fields:
        # Write via aiosqlite to the canonical DB (guaranteed correct file)
        import aiosqlite as _aio
        _db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
        set_parts = ", ".join(f"{k} = ?" for k in user_table_fields)
        values = list(user_table_fields.values()) + [str(current_user_id)]
        try:
            async with _aio.connect(str(_db_path)) as _db:
                await _db.execute(
                    f"UPDATE users SET {set_parts} WHERE id = ?", values
                )
                await _db.commit()
        except Exception:
            # Fallback to ORM session
            set_clause = ", ".join(f"{k} = :{k}" for k in user_table_fields)
            user_table_fields["uid"] = str(current_user_id)
            await service.session.execute(
                text(f"UPDATE users SET {set_clause} WHERE id = :uid"),
                user_table_fields,
            )
            await service.session.commit()

    # Also update profile table if profile fields are provided
    profile_body = {k: v for k, v in body.items()
                    if k in ("bio", "country", "state", "city", "default_currency")}
    if profile_body:
        try:
            from ..schemas import UpdateProfileRequest as _UPR
            update_req = _UPR(**profile_body)
            await service.update_profile(current_user_id, update_req)
        except Exception:
            pass

    return SuccessResponse(message="Profile updated.", data={"updated": True})



# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get(
    "/users/admin/list",
    response_model=SuccessResponse,
    summary="Admin: list all users with search and pagination",
)
async def admin_list_users(
    request: Request,
    search: str = Query(default="", description="Search by name, email or phone"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    """List all platform users. Requires enterprise_admin, moderator, or ops role."""
    from shared.errors import ForbiddenError
    roles = payload.get("roles", [])
    allowed = {"enterprise_admin", "moderator", "ops", "super_admin"}
    if not allowed.intersection(roles):
        raise ForbiddenError("Admin access required.")

    import aiosqlite
    db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()

    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row

        # Build WHERE clause for search
        where = ""
        params: list = []
        if search and search.strip():
            q = f"%{search.strip()}%"
            where = "WHERE (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)"
            params = [q, q, q]

        # Total count
        count_rows = await db.execute_fetchall(
            f"SELECT COUNT(*) as cnt FROM users u {where}", params
        )
        total = int(count_rows[0]["cnt"]) if count_rows else 0
        total_pages = max(1, (total + page_size - 1) // page_size)
        offset = (page - 1) * page_size

        # Fetch users
        rows = await db.execute_fetchall(
            f"""SELECT u.id, u.email, u.phone, u.full_name, u.country_code,
                       u.is_active, u.phone_verified, u.created_at
                FROM users u {where}
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?""",
            params + [page_size, offset],
        )

        # Fetch roles for each user in one query
        if rows:
            uid_list = [str(r["id"]) for r in rows]
            placeholders = ",".join(["?" for _ in uid_list])
            role_rows = await db.execute_fetchall(
                f"SELECT user_id, role FROM user_roles WHERE user_id IN ({placeholders})",
                uid_list,
            )
            role_map: dict[str, list[str]] = {}
            for rr in role_rows:
                role_map.setdefault(str(rr["user_id"]), []).append(str(rr["role"]))
        else:
            role_map = {}

        users = []
        for r in rows:
            uid = str(r["id"])
            phone = str(r["phone"] or "")
            # Sanitise garbled phone values (UUID fragments stored as phone numbers)
            if phone and not phone.startswith("+") and len(phone) > 15:
                phone = ""
            elif phone and phone.startswith("+0000"):
                phone = ""
            users.append({
                "id": uid,
                "email": str(r["email"] or ""),
                "phone": phone,
                "full_name": str(r["full_name"] or ""),
                "country_code": str(r["country_code"] or "NG"),
                "is_active": bool(r["is_active"]),
                "is_phone_verified": bool(r["phone_verified"]),
                "created_at": str(r["created_at"] or ""),
                "roles": role_map.get(uid, []),
            })

    return SuccessResponse(
        message=f"{total} users found.",
        data=users,
        meta={
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_prev": page > 1,
            "has_next": page < total_pages,
        },
    )


@router.patch(
    "/users/admin/{user_id}",
    response_model=SuccessResponse,
    summary="Admin: update a user's status or roles",
)
async def admin_update_user(
    user_id: uuid.UUID,
    request: Request,
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    """Toggle is_active or update roles. Requires enterprise_admin or moderator."""
    from shared.errors import ForbiddenError, InvalidInputError
    roles = payload.get("roles", [])
    if not {"enterprise_admin", "moderator", "super_admin"}.intersection(roles):
        raise ForbiddenError("Admin access required.")

    body = await request.json()
    import aiosqlite
    db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()

    async with aiosqlite.connect(str(db_path)) as db:
        if "is_active" in body:
            is_active = 1 if body["is_active"] else 0
            await db.execute(
                "UPDATE users SET is_active = ? WHERE id = ?",
                [is_active, str(user_id)],
            )
            await db.commit()

    return SuccessResponse(message="User updated.", data={"updated": True})


@router.post(
    "/users/me/change-password",
    response_model=SuccessResponse,
    summary="Change the authenticated user's password",
)
async def change_password(
    request: Request,
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:

    """
    Verify current password and immediately apply the new password.
    No OTP step — password changes are instant.
    """
    import asyncio, functools
    from sqlalchemy import text
    from shared.errors import InvalidInputError

    body = await request.json()
    current_password = (body.get("current_password") or "").strip()
    new_password     = (body.get("new_password") or "").strip()

    if not current_password or not new_password:
        raise InvalidInputError("current_password and new_password are required.")
    if len(new_password) < 8:
        raise InvalidInputError("New password must be at least 8 characters.")

    session = service.session

    # Fetch current password hash — try ORM session first, fall back to aiosqlite
    row = None
    try:
        row = (await session.execute(
            text("SELECT password_hash FROM users WHERE id = :uid"),
            {"uid": str(current_user_id)},
        )).fetchone()
    except Exception:
        pass

    if not row or not row[0]:
        # aiosqlite fallback
        try:
            import aiosqlite
            db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
            async with aiosqlite.connect(str(db_path)) as db:
                db.row_factory = aiosqlite.Row
                rows = await db.execute_fetchall(
                    "SELECT password_hash FROM users WHERE id = ?", [str(current_user_id)]
                )
                if rows:
                    row = rows[0]
        except Exception:
            pass

    if not row or not row[0]:
        raise InvalidInputError("User not found.")

    stored_hash = str(row[0]) if not hasattr(row, '__getitem__') else str(row["password_hash"] if "password_hash" in row.keys() else row[0])

    # Verify current password (bcrypt is CPU-bound — run in executor)
    import bcrypt
    loop = asyncio.get_event_loop()
    try:
        match = await loop.run_in_executor(
            None,
            functools.partial(bcrypt.checkpw, current_password.encode(), stored_hash.encode()),
        )
    except Exception:
        match = False

    if not match:
        raise InvalidInputError("Current password is incorrect.")

    # Hash the new password
    salt = bcrypt.gensalt()
    new_hash_bytes = await loop.run_in_executor(
        None,
        functools.partial(bcrypt.hashpw, new_password.encode(), salt),
    )
    new_hash = new_hash_bytes.decode()

    # Update password in DB — try ORM session first, then aiosqlite fallback
    updated = False
    try:
        await session.execute(
            text("UPDATE users SET password_hash = :h WHERE id = :uid"),
            {"h": new_hash, "uid": str(current_user_id)},
        )
        await session.commit()
        updated = True
    except Exception:
        pass

    if not updated:
        try:
            import aiosqlite
            db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
            async with aiosqlite.connect(str(db_path)) as db:
                await db.execute(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    [new_hash, str(current_user_id)]
                )
                await db.commit()
            updated = True
        except Exception as e:
            raise InvalidInputError(f"Failed to update password: {e}")

    return SuccessResponse(message="Password changed successfully.", data={"updated": True})


@router.post(
    "/users/me/change-password/verify-otp",
    response_model=SuccessResponse,
    summary="(Deprecated) OTP step — no longer required",
    include_in_schema=False,
)
async def change_password_verify_otp(
    request: Request,
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    """Kept for backwards compatibility — OTP flow has been removed."""
    return SuccessResponse(message="Password changed successfully.", data={"updated": True})




@router.get(
    "/users/{user_id}/profile",
    response_model=SuccessResponse,
    summary="Get a user's public profile",
)
async def get_profile(
    user_id: uuid.UUID,
    service: UserService = Depends(_build_service),
) -> SuccessResponse:
    from sqlalchemy import text
    # Always return at least the basic user info, even if no profile row exists
    try:
        result = await service.get_profile(user_id)
        profile_data = result.model_dump()
    except Exception:
        profile_data = {}

    # Enrich with users table: name, email, phone
    try:
        row = (await service.session.execute(
            text("SELECT full_name, email, phone FROM users WHERE id = :uid"),
            {"uid": str(user_id)},
        )).fetchone()
        if row:
            if not profile_data.get("full_name"):
                profile_data["full_name"] = row[0] or row[1] or "Seller"
            if not profile_data.get("display_name"):
                profile_data["display_name"] = row[0] or row[1]
            # Always include phone — used as WhatsApp fallback on listing detail page
            profile_data["phone"] = row[2] or profile_data.get("phone") or ""
    except Exception:
        pass

    return SuccessResponse(data=profile_data)


@router.post(
    "/users/me/avatar",
    response_model=SuccessResponse,
    summary="Upload a profile avatar image",
)
async def upload_avatar(
    file: UploadFile = File(..., description="Profile image (JPEG or PNG, max 5MB)"),
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    """
    Accepts a JPEG/PNG image, encodes it as a base64 data-URL, and stores it
    in the user_profiles.profile_photo_url column (or users table fallback).
    No external storage needed for development.
    """
    import base64
    import aiosqlite
    from pathlib import Path
    from shared.errors import InvalidInputError

    # Validate content type
    allowed = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    ct = (file.content_type or "").lower()
    if ct not in allowed:
        raise InvalidInputError("Only JPEG, PNG, WebP or GIF images are allowed.")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise InvalidInputError("Image must be smaller than 5 MB.")

    # Encode to data URL
    ext = ct.split("/")[-1]
    data_url = f"data:{ct};base64,{base64.b64encode(content).decode()}"

    db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
    uid_str = str(current_user_id)

    try:
        async with aiosqlite.connect(str(db_path)) as db:
            # Try user_profiles table first
            schema = await db.execute_fetchall("PRAGMA table_info(user_profiles)")
            col_names = [r[1] for r in schema]

            if "profile_photo_url" in col_names:
                existing = await db.execute_fetchall(
                    "SELECT id FROM user_profiles WHERE user_id = ?", [uid_str]
                )
                if existing:
                    await db.execute(
                        "UPDATE user_profiles SET profile_photo_url = ? WHERE user_id = ?",
                        [data_url, uid_str],
                    )
                else:
                    await db.execute(
                        "INSERT INTO user_profiles (id, user_id, profile_photo_url) VALUES (?, ?, ?)",
                        [str(uuid.uuid4()), uid_str, data_url],
                    )
            else:
                # Fallback: store on users table if it has avatar_url column
                user_schema = await db.execute_fetchall("PRAGMA table_info(users)")
                user_cols = [r[1] for r in user_schema]
                if "avatar_url" not in user_cols:
                    await db.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
                await db.execute(
                    "UPDATE users SET avatar_url = ? WHERE id = ?",
                    [data_url, uid_str],
                )

            await db.commit()
    except Exception as exc:
        raise InvalidInputError(f"Failed to save avatar: {exc}") from exc

    return SuccessResponse(
        message="Avatar updated.",
        data={"avatar_url": data_url},
    )


@router.patch(
    "/users/me/profile",
    response_model=SuccessResponse,
    summary="Update authenticated user's profile",
)
async def update_my_profile(
    body: UpdateProfileRequest,
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    result = await service.update_profile(current_user_id, body)
    return SuccessResponse(data=result.model_dump())


# ── KYC endpoints ─────────────────────────────────────────────────────────────

@router.post(
    "/users/me/kyc/government-id",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit government ID for Silver trust badge",
)
async def submit_government_id(
    file: UploadFile = File(..., description="Government ID document (PDF or image)"),
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    content = await file.read()
    result = await service.submit_kyc_document(
        user_id=current_user_id,
        document_type="government_id",
        file_content=content,
        filename=file.filename or "",
    )
    return SuccessResponse(
        data=result.model_dump(),
    )


@router.post(
    "/users/me/kyc/business-reg",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit business registration certificate for Gold trust badge",
)
async def submit_business_registration(
    file: UploadFile = File(..., description="Business registration certificate (PDF)"),
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    content = await file.read()
    result = await service.submit_kyc_document(
        user_id=current_user_id,
        document_type="business_registration",
        file_content=content,
        filename=file.filename or "",
    )
    return SuccessResponse(data=result.model_dump())


# ── Business endpoints ────────────────────────────────────────────────────────

@router.post(
    "/businesses",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new business entity",
)
async def create_business(
    body: CreateBusinessRequest,
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    result = await service.create_business(current_user_id, body)
    return SuccessResponse(data=result.model_dump())


@router.get(
    "/businesses",
    response_model=SuccessResponse,
    summary="List businesses owned by authenticated user",
)
async def list_my_businesses(
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    results = await service.list_businesses(current_user_id)
    return SuccessResponse(data=[r.model_dump() for r in results])


@router.post(
    "/businesses/{business_id}/branches",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a branch under a business",
)
async def create_branch(
    business_id: uuid.UUID,
    body: CreateBranchRequest,
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    result = await service.create_branch(business_id, current_user_id, body)
    return SuccessResponse(data=result.model_dump())


@router.get(
    "/businesses/{business_id}/branches",
    response_model=SuccessResponse,
    summary="List branches under a business",
)
async def list_branches(
    business_id: uuid.UUID,
    service: UserService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    roles = payload.get("roles", [])
    results = await service.list_branches(business_id, current_user_id, roles)
    return SuccessResponse(data=[r.model_dump() for r in results])


# ── Role management (admin only) ──────────────────────────────────────────────

@router.patch(
    "/users/{user_id}/roles",
    response_model=SuccessResponse,
    summary="Elevate a user's role (admin only)",
)
async def elevate_user_role(
    user_id: uuid.UUID,
    body: ElevateRoleRequest,
    service: UserService = Depends(_build_service),
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    roles: list[str] = payload.get("roles", [])
    if "enterprise_admin" not in roles:
        raise ForbiddenError("Only enterprise admins can elevate user roles.")

    await service.elevate_role(user_id, body.role, body.scope_id)
    return SuccessResponse(
        data={"message": f"Role '{body.role}' granted to user {user_id}."}
    )


# ── Internal endpoints ────────────────────────────────────────────────────────

@internal_router.get(
    "/users/{user_id}/roles",
    response_model=SuccessResponse,
    summary="[Internal] Get user roles for JWT token claims",
    include_in_schema=False,
)
async def get_user_roles_internal(
    user_id: uuid.UUID,
    service: UserService = Depends(_build_service),
) -> SuccessResponse:
    result = await service.get_user_roles(user_id)
    return SuccessResponse(data=result.model_dump())


@internal_router.get(
    "/users/{user_id}/subscription-tier",
    response_model=SuccessResponse,
    summary="[Internal] Get user subscription tier for JWT token claims",
    include_in_schema=False,
)
async def get_subscription_tier_internal(
    user_id: uuid.UUID,
    service: UserService = Depends(_build_service),
) -> SuccessResponse:
    result = await service.get_subscription_tier(user_id)
    return SuccessResponse(data=result.model_dump())



# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get(
    "/users/admin/list",
    response_model=SuccessResponse,
    summary="Admin: list all users with search and filter",
)
async def admin_list_users(
    service: UserService = Depends(_build_service),
    payload: dict = Depends(get_current_user_payload),
    search: str | None = Query(default=None),
    kyc_verified: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    import aiosqlite
    from pathlib import Path
    from shared.errors import paginated_meta

    db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()
    offset = (page - 1) * page_size

    try:
        async with aiosqlite.connect(str(db_path)) as db:
            db.row_factory = aiosqlite.Row

            # Subquery to exclude enterprise_admin (the business owner / super admin)
            # They should never appear in the Users management table
            exclude_admin = """
                AND u.id NOT IN (
                    SELECT CAST(user_id AS TEXT) FROM user_roles
                    WHERE role IN ('enterprise_admin', 'super_admin')
                )
            """

            if search:
                s = f"%{search}%"
                rows = await db.execute_fetchall(
                    f"""
                    SELECT u.id, u.email, u.phone, u.full_name, u.country_code,
                           u.is_active, u.phone_verified, u.created_at,
                           GROUP_CONCAT(r.role, ',') as roles
                    FROM users u
                    LEFT JOIN user_roles r ON CAST(r.user_id AS TEXT) = CAST(u.id AS TEXT)
                    WHERE (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)
                    {exclude_admin}
                    GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?
                    """,
                    [s, s, s, page_size, offset]
                )
                count_rows = await db.execute_fetchall(
                    f"SELECT COUNT(*) AS cnt FROM users u WHERE "
                    f"(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?) {exclude_admin}",
                    [s, s, s]
                )
            else:
                rows = await db.execute_fetchall(
                    f"""
                    SELECT u.id, u.email, u.phone, u.full_name, u.country_code,
                           u.is_active, u.phone_verified, u.created_at,
                           GROUP_CONCAT(r.role, ',') as roles
                    FROM users u
                    LEFT JOIN user_roles r ON CAST(r.user_id AS TEXT) = CAST(u.id AS TEXT)
                    WHERE 1=1 {exclude_admin}
                    GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?
                    """,
                    [page_size, offset]
                )
                count_rows = await db.execute_fetchall(
                    f"SELECT COUNT(*) AS cnt FROM users u WHERE 1=1 {exclude_admin}"
                )

            total = count_rows[0]["cnt"] if count_rows else 0
            data = [
                {
                    "id": str(r["id"]),
                    "email": r["email"],
                    "phone": r["phone"],
                    "full_name": r["full_name"],
                    "country_code": r["country_code"],
                    "is_active": bool(r["is_active"]),
                    "is_phone_verified": bool(r["phone_verified"]),
                    "created_at": str(r["created_at"]),
                    "roles": r["roles"].split(",") if r["roles"] else [],
                }
                for r in rows
            ]
    except Exception:
        data, total = [], 0

    return SuccessResponse(
        message=f"{total} user(s) found.",
        data=data,
        meta=paginated_meta(page, page_size, total),
    )


@router.patch(
    "/users/admin/{user_id}",
    response_model=SuccessResponse,
    summary="Admin: activate or suspend a user",
)
async def admin_update_user(
    user_id: uuid.UUID,
    request: Request,
    service: UserService = Depends(_build_service),
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    from sqlalchemy import text
    # Protect enterprise_admin from being suspended
    check = (await service.session.execute(
        text("SELECT role FROM user_roles WHERE CAST(user_id AS TEXT) = :uid AND role IN ('enterprise_admin', 'moderator')"),
        {"uid": str(user_id)},
    )).fetchone()
    if check:
        caller_roles = payload.get("roles", [])
        # Only enterprise_admin can suspend moderators
        if check[0] == 'enterprise_admin':
            from shared.errors import ForbiddenError
            raise ForbiddenError("The platform owner account cannot be modified.")
        if check[0] == 'moderator' and 'enterprise_admin' not in caller_roles:
            from shared.errors import ForbiddenError
            raise ForbiddenError("Only the platform owner can suspend a moderator account.")
    # Also prevent self-suspension
    caller_id = payload.get("sub", "")
    if str(user_id) == str(caller_id):
        from shared.errors import ForbiddenError
        raise ForbiddenError("You cannot suspend your own account.")
    body = await request.json()
    session = service.session
    is_active = body.get("is_active")
    if is_active is not None:
        await session.execute(
            text("UPDATE users SET is_active = :v WHERE CAST(id AS TEXT) = :uid"),
            {"v": 1 if is_active else 0, "uid": str(user_id)},
        )
        await session.commit()
    return SuccessResponse(data={"updated": True})


@router.get(
    "/users/admin/kyc",
    response_model=SuccessResponse,
    summary="Admin: list KYC documents",
)
async def admin_list_kyc(
    service: UserService = Depends(_build_service),
    payload: dict = Depends(get_current_user_payload),
    kyc_status: str | None = Query(default=None, alias="status"),
    page_size: int = Query(default=50, ge=1, le=100),
) -> SuccessResponse:
    from sqlalchemy import text
    from shared.errors import paginated_meta
    session = service.session
    try:
        if kyc_status and kyc_status != "all":
            q = await session.execute(
                text("SELECT id, user_id, doc_type, status, submitted_at FROM kyc_documents WHERE status = :s LIMIT :l"),
                {"s": kyc_status, "l": page_size},
            )
        else:
            q = await session.execute(
                text("SELECT id, user_id, doc_type, status, submitted_at FROM kyc_documents LIMIT :l"),
                {"l": page_size},
            )
        rows = q.fetchall()
        data = [
            {
                "id": str(r[0]), "user_id": str(r[1]),
                "doc_type": r[2] or "national_id",
                "status": r[3] or "pending",
                "submitted_at": str(r[4]) if r[4] else None,
                "user_name": "User",
            }
            for r in rows
        ]
    except Exception:
        data = []
    return SuccessResponse(data=data, meta=paginated_meta(1, page_size, len(data)))


@router.post(
    "/users/admin/kyc/{doc_id}/review",
    response_model=SuccessResponse,
    summary="Admin: approve or reject a KYC document",
)
async def admin_review_kyc(
    doc_id: uuid.UUID,
    request: Request,
    service: UserService = Depends(_build_service),
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    from sqlalchemy import text
    body = await request.json()
    review_status = body.get("status", "approved")
    session = service.session
    try:
        await session.execute(
            text("UPDATE kyc_documents SET status = :s WHERE id = :id"),
            {"s": review_status, "id": str(doc_id)},
        )
    except Exception:
        pass
    return SuccessResponse(data={"reviewed": True, "status": review_status})


@router.post(
    "/users/admin/moderators",
    response_model=SuccessResponse,
    status_code=201,
    summary="Admin: create a new moderator account",
)
async def admin_create_moderator(
    request: Request,
    service: UserService = Depends(_build_service),
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    """
    Creates a moderator directly in the DB via aiosqlite (bypasses ORM constraints).
    The user_roles CheckConstraint in the ORM only allows legacy roles — we bypass it
    by writing directly to SQLite so 'moderator' role can be inserted.
    """
    import bcrypt
    import aiosqlite
    from pathlib import Path

    body = await request.json()
    email    = (body.get("email", "") or "").strip().lower()
    phone    = (body.get("phone", "") or "").strip()
    password = (body.get("password", "") or "")
    full_name = (body.get("full_name", "") or "Moderator").strip()
    country_code = (body.get("country_code", "NG") or "NG").strip().upper()[:2]

    if not email or not password or not full_name:
        from shared.errors import InvalidInputError
        raise InvalidInputError("email, password and full_name are required.")

    # Ensure phone is E.164 — if not provided/valid, generate a placeholder
    import re
    if not re.match(r"^\+[1-9]\d{6,14}$", phone):
        import time
        phone = f"+234{int(time.time()) % 10_000_000_000:010d}"

    # Hash the password with bcrypt
    import asyncio
    import functools
    loop = asyncio.get_event_loop()
    salt = bcrypt.gensalt()
    pw_hash = await loop.run_in_executor(
        None,
        functools.partial(bcrypt.hashpw, password.encode(), salt)
    )
    pw_hash_str = pw_hash.decode()
    new_user_id = str(uuid.uuid4())

    # Use aiosqlite directly — bypasses SQLAlchemy ORM CheckConstraint on user_roles.role
    db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()

    try:
        async with aiosqlite.connect(str(db_path)) as db:
            # Check email not already in use
            rows = await db.execute_fetchall(
                "SELECT id FROM users WHERE email = ?", [email]
            )
            if rows:
                return SuccessResponse(data={"error": f"Email {email} is already registered."})

            # Insert user — include ALL NOT NULL columns from the actual DB schema
            await db.execute(
                """
                INSERT INTO users (id, email, phone, phone_verified, password_hash, full_name,
                                   country_code, is_active, is_locked, failed_attempts, created_at)
                VALUES (?, ?, ?, 1, ?, ?, ?, 1, 0, 0, datetime('now'))
                """,
                [new_user_id, email, phone, pw_hash_str, full_name, country_code]
            )

            # Check if user_roles has 'id' column (surrogate PK)
            schema = await db.execute_fetchall("PRAGMA table_info(user_roles)")
            col_names = [r[1] for r in schema]
            role_id = str(uuid.uuid4())

            if "id" in col_names and "granted_at" in col_names:
                await db.execute(
                    "INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (?, ?, 'moderator', datetime('now'))",
                    [role_id, new_user_id]
                )
            elif "id" in col_names:
                await db.execute(
                    "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'moderator')",
                    [role_id, new_user_id]
                )
            elif "granted_at" in col_names:
                await db.execute(
                    "INSERT INTO user_roles (user_id, role, granted_at) VALUES (?, 'moderator', datetime('now'))",
                    [new_user_id]
                )
            else:
                await db.execute(
                    "INSERT INTO user_roles (user_id, role) VALUES (?, 'moderator')",
                    [new_user_id]
                )

            await db.commit()

        # ── Send sign-in credentials to the new moderator via Gmail SMTP ──
        try:
            import os, smtplib, ssl
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            gmail_user = os.environ.get("GMAIL_USER", "").strip()
            gmail_pass = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
            platform_url = "http://localhost:3000/login"

            if gmail_user and gmail_pass:
                subject = "🛡️ Your Velontri Moderator Account"
                html_body = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;
       overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:36px 40px 28px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
        Velontri
      </h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
        Africa's Marketplace Platform
      </p>
    </div>
    <!-- Body -->
    <div style="padding:36px 40px;">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">
        Welcome aboard, {full_name}! 👋
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
        A moderator account has been created for you on Velontri.
        Here are your sign-in credentials:
      </p>

      <!-- Credentials box -->
      <div style="background:#f1f5f9;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:12px;font-weight:700;color:#94a3b8;
                       text-transform:uppercase;letter-spacing:0.08em;width:90px;">Email</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1e293b;">{email}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:12px;font-weight:700;color:#94a3b8;
                       text-transform:uppercase;letter-spacing:0.08em;">Password</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1e293b;
                       font-family:monospace;letter-spacing:0.05em;">{password}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:12px;font-weight:700;color:#94a3b8;
                       text-transform:uppercase;letter-spacing:0.08em;">Role</td>
            <td style="padding:6px 0;">
              <span style="background:#eef2ff;color:#4F46E5;font-size:12px;font-weight:700;
                           padding:3px 10px;border-radius:99px;">Moderator</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA button -->
      <a href="{platform_url}" style="display:inline-block;background:#4F46E5;color:#ffffff;
         text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;
         border-radius:12px;margin-bottom:28px;">
        Sign in to Velontri →
      </a>

      <!-- Security notice -->
      <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
          🔒 <strong>Security tip:</strong> Please change your password after your first sign-in.
          If you did not expect this email, contact <a href="mailto:support@velontri.com"
          style="color:#4F46E5;">support@velontri.com</a>.
        </p>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:center;">
        © {__import__('datetime').datetime.now().year} Velontri Technologies Ltd.
      </p>
    </div>
  </div>
</body>
</html>"""
                plain_body = (
                    f"Welcome to Velontri Moderator Portal\n\n"
                    f"Name: {full_name}\n"
                    f"Email: {email}\n"
                    f"Password: {password}\n"
                    f"Role: Moderator\n\n"
                    f"Sign in at: {platform_url}\n\n"
                    f"Please change your password after first sign-in."
                )
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"]    = f"Velontri <{gmail_user}>"
                msg["To"]      = email
                msg.attach(MIMEText(plain_body, "plain"))
                msg.attach(MIMEText(html_body, "html"))

                ctx = ssl.create_default_context()
                def _send():
                    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as s:
                        s.login(gmail_user, gmail_pass)
                        s.sendmail(gmail_user, email, msg.as_string())

                await loop.run_in_executor(None, _send)
                import logging
                logging.getLogger(__name__).info(f"moderator_welcome_email_sent: {email}")
        except Exception as email_exc:
            import logging
            logging.getLogger(__name__).warning(f"moderator_email_failed: {email_exc}")
            # Don't fail the account creation if email fails

        return SuccessResponse(
            message="Moderator account created. Sign-in details sent to their email.",
            data={"user_id": new_user_id, "email": email, "role": "moderator"},
        )
    except Exception as exc:
        return SuccessResponse(data={"error": str(exc)})



@router.delete(
    "/users/admin/{user_id}",
    response_model=SuccessResponse,
    summary="Admin: permanently delete a user account",
)
async def admin_delete_user(
    user_id: uuid.UUID,
    service: UserService = Depends(_build_service),
    payload: dict = Depends(get_current_user_payload),
) -> SuccessResponse:
    """Hard-deletes a user and all their roles. Super admin only."""
    from sqlalchemy import text
    roles = payload.get("roles", [])
    if "enterprise_admin" not in roles and "super_admin" not in roles:
        from shared.errors import ForbiddenError
        raise ForbiddenError("Super admin role required.")
    session = service.session
    await session.execute(
        text("DELETE FROM user_roles WHERE user_id = :uid"),
        {"uid": str(user_id)},
    )
    await session.execute(
        text("DELETE FROM users WHERE id = :uid"),
        {"uid": str(user_id)},
    )
    await session.commit()
    return SuccessResponse(
        message="User deleted.",
        data={"user_id": str(user_id)},
    )
