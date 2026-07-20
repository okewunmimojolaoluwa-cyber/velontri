"""Notification Service router."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_, select
from shared.errors import SuccessResponse
from shared.jwt_utils import verify_token
from ..config import NotificationSettings, get_settings
from ..models import NotificationRecord
from ..service import deliver_notification

router = APIRouter(tags=["Notifications"])

# Internal endpoint for Auth Service SMS OTPs
internal_router = APIRouter(prefix="/internal", tags=["Internal"])


def _settings() -> NotificationSettings:
    return get_settings()


def _user(token: str = Query(...), settings: NotificationSettings = Depends(_settings)) -> dict:
    return verify_token(settings.JWT_PUBLIC_KEY_PATH, token)


@router.get("/notifications/history", response_model=SuccessResponse)
async def notification_history(
    request: Request,
    payload: dict = Depends(_user),
    page: int = Query(default=1, ge=1),
) -> SuccessResponse:
    user_id = uuid.UUID(payload["sub"])
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
