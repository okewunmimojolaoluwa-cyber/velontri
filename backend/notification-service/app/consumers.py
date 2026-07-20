"""Notification Service consumers — handles notification.send events."""
from __future__ import annotations
from typing import Any
from shared.logging import get_logger

logger = get_logger(__name__)


async def handle_notification_send(payload: dict[str, Any], session_factory: Any, settings: Any) -> None:
    """
    Consume notification.send events from all services.
    Expected payload: {recipient_user_id, channel, notification_type, content, phone?, email?}
    """
    from .service import deliver_notification
    from shared.database import get_session

    recipient_user_id = payload.get("recipient_user_id")
    channel = payload.get("channel", "push")
    notification_type = payload.get("notification_type", payload.get("template", "general"))
    content = payload.get("content", payload.get("data", {}))
    if isinstance(content, str):
        import json
        try:
            content = json.loads(content)
        except Exception:
            content = {"message": content}

    recipient_phone = payload.get("phone")
    recipient_email = payload.get("email")

    if not recipient_user_id:
        logger.warning("notification_missing_recipient", payload=payload)
        return

    try:
        async with get_session(session_factory) as session:
            await deliver_notification(
                session=session,
                settings=settings,
                recipient_user_id=str(recipient_user_id),
                channel=channel,
                notification_type=notification_type,
                content=content,
                recipient_phone=recipient_phone,
                recipient_email=recipient_email,
            )
        logger.info("notification_delivered", channel=channel, user_id=str(recipient_user_id))
    except Exception:
        logger.error("notification_consumer_failed", exc_info=True)
        raise


async def handle_internal_sms(payload: dict[str, Any], session_factory: Any, settings: Any) -> None:
    """Direct SMS for OTPs — bypasses preference checks."""
    from .channels import send_sms
    phone = payload.get("phone", "")
    message = payload.get("message", "")
    if phone and message:
        await send_sms(phone, message, settings.AFRICASTALKING_API_KEY, settings.AFRICASTALKING_USERNAME, settings.AFRICASTALKING_SENDER_ID)
