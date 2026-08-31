"""Notification Service router."""
from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import and_, select, text as _text
from shared.errors import SuccessResponse
from shared.jwt_utils import verify_token
from ..config import NotificationSettings, get_settings
from ..models import NotificationRecord
from ..service import deliver_notification

router = APIRouter(tags=["Notifications"])

# Internal endpoint for Auth Service SMS OTPs
internal_router = APIRouter(prefix="/internal", tags=["Internal"])

class AdminPushRequest(BaseModel):
    title: str
    body: str
    audience: str


def _settings() -> NotificationSettings:
    return get_settings()


def _user(token: str = Query(...), settings: NotificationSettings = Depends(_settings)) -> dict:
    return verify_token(settings.JWT_PUBLIC_KEY_PATH, token)


@router.get("/notifications/unread-count", response_model=SuccessResponse, summary="Get unread notification count only")
async def get_unread_count(request: Request) -> SuccessResponse:
    from shared.jwt_utils import verify_token as _vt
    settings = get_settings()
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = _vt(settings.JWT_PUBLIC_KEY_PATH, token)
        user_id = payload["sub"]
    except Exception:
        from shared.errors import ForbiddenError
        raise ForbiddenError("Invalid or missing token.")
    async with request.app.state.session_factory() as session:
        try:
            count = (await session.execute(
                _text("SELECT COUNT(*) FROM notifications WHERE (recipient_user_id = :uid OR user_id = :uid) AND is_read = FALSE"),
                {"uid": user_id}
            )).scalar() or 0
        except Exception:
            count = 0
    return SuccessResponse(data={"unread_count": int(count)})
async def get_notifications(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
) -> SuccessResponse:
    from shared.jwt_utils import verify_token as _vt
    settings = get_settings()
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = _vt(settings.JWT_PUBLIC_KEY_PATH, token)
        user_id = payload["sub"]
    except Exception:
        from shared.errors import ForbiddenError
        raise ForbiddenError("Invalid or missing token.")

    async with request.app.state.session_factory() as session:
        # Try the notifications table (may have either schema — support both)
        try:
            conditions = "WHERE (recipient_user_id = :uid OR user_id = :uid)"
            if unread_only:
                conditions += " AND is_read = FALSE"
            offset = (page - 1) * page_size
            rows = (await session.execute(
                _text(f"""
                    SELECT id,
                           COALESCE(notification_type, type, 'system') AS notification_type,
                           title,
                           message,
                           COALESCE(content, '{{}}') AS content,
                           is_read,
                           created_at,
                           sender_user_id,
                           sender_role,
                           action_url,
                           related_resource_type,
                           related_resource_id
                    FROM notifications
                    {conditions}
                    ORDER BY created_at DESC
                    LIMIT :lim OFFSET :offset
                """),
                {"uid": user_id, "offset": offset, "lim": page_size}
            )).mappings().all()
            unread_count = (await session.execute(
                _text("SELECT COUNT(*) FROM notifications WHERE (recipient_user_id = :uid OR user_id = :uid) AND is_read = FALSE"),
                {"uid": user_id}
            )).scalar() or 0
        except Exception:
            rows = []
            unread_count = 0

    notifications = []
    for r in rows:
        # title/message may be direct columns (new format) or packed in content JSON (old format)
        direct_title = r.get("title") or ""
        direct_msg   = r.get("message") or ""
        content_raw  = r.get("content") or "{}"
        try:
            content_parsed = json.loads(content_raw) if content_raw.strip().startswith("{") else {}
        except Exception:
            content_parsed = {}
        title   = direct_title or content_parsed.get("title", "Notification")
        message = direct_msg   or content_parsed.get("message", "")
        notifications.append({
            "id":                    str(r["id"]),
            "type":                  r["notification_type"],
            "title":                 title,
            "message":               message,
            "listing_id":            content_parsed.get("listing_id") or r.get("related_resource_id"),
            "is_read":               r["is_read"],
            "sender_user_id":        r.get("sender_user_id"),
            "sender_role":           r.get("sender_role"),
            "sender_name":           r.get("sender_role"),   # role doubles as display name
            "action_url":            r.get("action_url"),
            "related_resource_type": r.get("related_resource_type"),
            "related_resource_id":   r.get("related_resource_id"),
            "created_at":            str(r["created_at"]),
        })
    return SuccessResponse(data={"notifications": notifications, "unread_count": unread_count})


@router.post("/notifications/{notification_id}/read", response_model=SuccessResponse, summary="Mark a notification as read")
async def mark_notification_read(
    notification_id: str,
    request: Request,
) -> SuccessResponse:
    from shared.jwt_utils import verify_token as _vt
    settings = get_settings()
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = _vt(settings.JWT_PUBLIC_KEY_PATH, token)
        user_id = payload["sub"]
    except Exception:
        from shared.errors import ForbiddenError
        raise ForbiddenError("Invalid or missing token.")

    async with request.app.state.session_factory() as session:
        try:
            await session.execute(
                _text("UPDATE notifications SET is_read = TRUE WHERE id = :nid AND (recipient_user_id = :uid OR user_id = :uid)"),
                {"nid": notification_id, "uid": user_id}
            )
            await session.commit()
        except Exception:
            pass
    return SuccessResponse(data={"marked_read": True})


@router.post("/notifications/read-all", response_model=SuccessResponse, summary="Mark all notifications as read")
async def mark_all_read(
    request: Request,
) -> SuccessResponse:
    from shared.jwt_utils import verify_token as _vt
    settings = get_settings()
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = _vt(settings.JWT_PUBLIC_KEY_PATH, token)
        user_id = payload["sub"]
    except Exception:
        from shared.errors import ForbiddenError
        raise ForbiddenError("Invalid or missing token.")

    async with request.app.state.session_factory() as session:
        try:
            await session.execute(
                _text("UPDATE notifications SET is_read = TRUE WHERE (recipient_user_id = :uid OR user_id = :uid) AND is_read = FALSE"),
                {"uid": user_id}
            )
            await session.commit()
        except Exception:
            pass
    return SuccessResponse(data={"marked_all_read": True})


@router.get("/notifications/history", response_model=SuccessResponse)
async def notification_history(
    request: Request,
    page: int = Query(default=1, ge=1),
) -> SuccessResponse:
    from shared.jwt_utils import verify_token as _vt
    settings = get_settings()
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = _vt(settings.JWT_PUBLIC_KEY_PATH, token)
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        from shared.errors import ForbiddenError
        raise ForbiddenError("Invalid or missing token.")

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=90)
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(NotificationRecord)
            .where(and_(NotificationRecord.recipient_user_id == user_id, NotificationRecord.created_at >= cutoff))
            .order_by(NotificationRecord.created_at.desc())
            .offset((page - 1) * 20)
            .limit(20)
        )
        records = result.scalars().all()
    return SuccessResponse(data=[{"id": str(r.id), "channel": r.channel, "type": r.notification_type, "status": r.status, "created_at": str(r.created_at)} for r in records])


@internal_router.post("/sms", include_in_schema=False)
async def send_sms_internal(
    request: Request,
    settings: NotificationSettings = Depends(_settings),
) -> SuccessResponse:
    body = await request.json()
    from ..channels import send_sms
    success, reason = await send_sms(body.get("phone", ""), body.get("message", ""), settings.AFRICASTALKING_API_KEY, settings.AFRICASTALKING_USERNAME, settings.AFRICASTALKING_SENDER_ID)
    return SuccessResponse(data={"success": success, "reason": reason})


@router.post("/notification/admin/push", response_model=SuccessResponse, summary="Send admin push notification")
async def send_admin_push(
    request: Request,
    req_body: AdminPushRequest,
) -> SuccessResponse:
    from shared.jwt_utils import verify_token as _vt
    from ..channels import send_push
    settings = get_settings()
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = _vt(settings.JWT_PUBLIC_KEY_PATH, token)
    except Exception:
        from shared.errors import ForbiddenError
        raise ForbiddenError("Invalid or missing token.")

    success, reason = await send_push(
        user_id=req_body.audience,
        title=req_body.title,
        body=req_body.body,
        fcm_key=settings.FCM_SERVER_KEY
    )
    return SuccessResponse(data={"success": success, "reason": reason})
