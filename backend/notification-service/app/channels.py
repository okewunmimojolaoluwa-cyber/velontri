"""
Notification channel delivery implementations.

Each channel returns (success: bool, failure_reason: str | None).
None failure_reason means success.
Never raises — all exceptions are caught and returned as failures.
"""
from __future__ import annotations
import httpx
from shared.logging import get_logger

logger = get_logger(__name__)


async def send_sms(phone: str, message: str, api_key: str, username: str, sender_id: str) -> tuple[bool, str | None]:
    """Send SMS via Africa's Talking API."""
    if not api_key or not phone:
        return False, "SMS not configured or missing phone"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.africastalking.com/version1/messaging",
                headers={"apiKey": api_key, "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
                data={"username": username, "to": phone, "message": message, "from": sender_id},
            )
            if resp.status_code in (200, 201):
                return True, None
            return False, f"AT API returned {resp.status_code}"
    except Exception as exc:
        logger.warning("sms_send_failed", error=str(exc))
        return False, str(exc)


async def send_email(to_email: str, subject: str, html_body: str, api_key: str, from_email: str) -> tuple[bool, str | None]:
    """Send email via SendGrid."""
    if not api_key or not to_email:
        return False, "Email not configured or missing recipient"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"personalizations": [{"to": [{"email": to_email}]}], "from": {"email": from_email}, "subject": subject, "content": [{"type": "text/html", "value": html_body}]},
            )
            if resp.status_code in (200, 202):
                return True, None
            return False, f"SendGrid returned {resp.status_code}"
    except Exception as exc:
        logger.warning("email_send_failed", error=str(exc))
        return False, str(exc)


async def send_whatsapp(to_phone: str, message: str, api_url: str, token: str) -> tuple[bool, str | None]:
    """Send WhatsApp message via Meta Cloud API."""
    if not api_url or not token or not to_phone:
        return False, "WhatsApp not configured"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                api_url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"messaging_product": "whatsapp", "to": to_phone, "type": "text", "text": {"body": message}},
            )
            if resp.status_code in (200, 201):
                return True, None
            return False, f"WhatsApp API returned {resp.status_code}"
    except Exception as exc:
        logger.warning("whatsapp_send_failed", error=str(exc))
        return False, str(exc)


async def send_push(user_id: str, title: str, body: str, fcm_key: str) -> tuple[bool, str | None]:
    """Send FCM push notification (topic-based for simplicity)."""
    if not fcm_key:
        return False, "FCM not configured"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://fcm.googleapis.com/fcm/send",
                headers={"Authorization": f"key={fcm_key}", "Content-Type": "application/json"},
                json={"to": f"/topics/{user_id}", "notification": {"title": title, "body": body}},
            )
            if resp.status_code == 200:
                return True, None
            return False, f"FCM returned {resp.status_code}"
    except Exception as exc:
        logger.warning("push_send_failed", error=str(exc))
        return False, str(exc)
