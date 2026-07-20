"""Notification Service business logic."""
from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from shared.logging import get_logger
from .channels import send_email, send_push, send_sms, send_whatsapp
from .config import NotificationSettings
from .models import NotificationRecord

logger = get_logger(__name__)


async def deliver_notification(
    session: AsyncSession,
    settings: NotificationSettings,
    recipient_user_id: str,
    channel: str,
    notification_type: str,
    content: dict[str, Any],
    recipient_phone: str | None = None,
    recipient_email: str | None = None,
) -> NotificationRecord:
    """
    Create a notification record and attempt delivery.
    Retries up to MAX_DELIVERY_RETRIES. Marks failed after exhaustion.
    """
    content_str = json.dumps(content)
    record = NotificationRecord(
        recipient_user_id=uuid.UUID(recipient_user_id),
        channel=channel,
        notification_type=notification_type,
        content=content_str,
        status="pending",
        attempts=0,
    )
    session.add(record)
    await session.flush()

    success = False
    failure_reason: str | None = None
    message_text = content.get("message", content_str)

    for attempt in range(1, settings.MAX_DELIVERY_RETRIES + 1):
        record.attempts = attempt
        if channel == "sms" and recipient_phone:
            success, failure_reason = await send_sms(recipient_phone, message_text, settings.AFRICASTALKING_API_KEY, settings.AFRICASTALKING_USERNAME, settings.AFRICASTALKING_SENDER_ID)
        elif channel == "email" and recipient_email:
            subject = content.get("subject", "Velontri Notification")
            success, failure_reason = await send_email(recipient_email, subject, message_text, settings.SENDGRID_API_KEY, settings.EMAIL_FROM)
        elif channel == "whatsapp" and recipient_phone:
            success, failure_reason = await send_whatsapp(recipient_phone, message_text, settings.WHATSAPP_API_URL, settings.WHATSAPP_TOKEN)
        elif channel == "push":
            title = content.get("title", "Velontri")
            success, failure_reason = await send_push(recipient_user_id, title, message_text, settings.FCM_SERVER_KEY)
        else:
            failure_reason = f"Unsupported channel '{channel}' or missing contact info"
            break

        if success:
            break

    if success:
        record.status = "sent"
        record.sent_at = datetime.now(tz=timezone.utc)
        record.failure_reason = None
    else:
        record.status = "failed"
        record.failure_reason = failure_reason
        logger.warning("notification_failed", channel=channel, user_id=recipient_user_id, reason=failure_reason)

    await session.flush()
    return record
