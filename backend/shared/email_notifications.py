"""
Centralized email notification system using Brevo.
Every web notification should trigger an email to the user's Gmail.
"""
import httpx
import os
from typing import Optional
from shared.logging import get_logger

logger = get_logger(__name__)

BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "noreply@velontri.com")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Velontri")


async def send_notification_email(
    to_email: str,
    subject: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    notification_type: str = "info"
) -> tuple[bool, Optional[str]]:
    """
    Send notification email via Brevo API.
    
    Args:
        to_email: Recipient email address
        subject: Email subject line
        title: Notification title
        message: Notification message
        action_url: Optional URL for action button
        notification_type: Type of notification (info, success, warning, alert)
    
    Returns:
        tuple: (success: bool, error_message: Optional[str])
    """
    if not BREVO_API_KEY:
        logger.warning("email_notification_skipped", reason="BREVO_API_KEY not configured")
        return False, "Brevo API key not configured"
    
    if not to_email or not to_email.strip():
        logger.warning("email_notification_skipped", reason="No recipient email")
        return False, "No recipient email provided"
    
    # Color scheme based on notification type
    color_map = {
        "info": "#4F46E5",      # Indigo
        "success": "#10B981",   # Green
        "warning": "#F59E0B",   # Amber
        "alert": "#EF4444",     # Red
        "message": "#8B5CF6",   # Purple
        "payment": "#06B6D4",   # Cyan
        "system": "#6B7280",    # Gray
    }
    brand_color = color_map.get(notification_type, "#4F46E5")
    
    # Build HTML email template
    action_button = ""
    if action_url:
        action_button = f"""
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: separate; line-height: 100%;">
          <tbody>
            <tr>
              <td align="center" bgcolor="{brand_color}" role="presentation" style="border: none; border-radius: 8px; cursor: auto; mso-padding-alt: 12px 24px; background: {brand_color};" valign="middle">
                <a href="{action_url}" style="display: inline-block; background: {brand_color}; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; line-height: 120%; margin: 0; text-decoration: none; text-transform: none; padding: 12px 24px; mso-padding-alt: 0px; border-radius: 8px;" target="_blank">
                  View Details
                </a>
              </td>
            </tr>
          </tbody>
        </table>
        """
    
    html_body = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px 40px; text-align: center;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Velontri</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px; font-weight: bold;">{title}</h2>
                                <p style="margin: 0 0 24px 0; color: #4B5563; font-size: 15px; line-height: 1.6;">{message}</p>
                                
                                {action_button}
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #F9FAFB; padding: 24px 40px; text-align: center; border-top: 1px solid #E5E7EB;">
                                <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 13px;">
                                    You're receiving this email because you have an account on Velontri.
                                </p>
                                <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                                    © {os.getenv('CURRENT_YEAR', '2024')} Velontri. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": BREVO_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "sender": {
                        "name": EMAIL_FROM_NAME,
                        "email": EMAIL_FROM
                    },
                    "to": [{"email": to_email}],
                    "subject": subject,
                    "htmlContent": html_body
                }
            )
            
            if response.status_code in (200, 201):
                logger.info("email_notification_sent", 
                           recipient=to_email, 
                           subject=subject,
                           notification_type=notification_type)
                return True, None
            else:
                error_msg = f"Brevo API returned {response.status_code}: {response.text}"
                logger.error("email_notification_failed", 
                            recipient=to_email,
                            error=error_msg)
                return False, error_msg
                
    except Exception as exc:
        error_msg = f"Email send error: {str(exc)}"
        logger.error("email_notification_exception", 
                    recipient=to_email,
                    error=error_msg)
        return False, error_msg


async def send_notification_with_email(
    db_session,
    recipient_user_id: str,
    notification_type: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    sender_user_id: Optional[str] = None,
    sender_role: Optional[str] = None,
    related_resource_type: Optional[str] = None,
    related_resource_id: Optional[str] = None
) -> tuple[bool, Optional[str]]:
    """
    Create a notification in the database AND send an email.
    This is the ONE function all services should use to ensure emails are sent.
    
    Returns:
        tuple: (success: bool, error_message: Optional[str])
    """
    from sqlalchemy import text
    from uuid import uuid4
    
    notification_id = str(uuid4())
    
    # Insert notification into database
    try:
        await db_session.execute(
            text("""
                INSERT INTO notifications (
                    id,
                    recipient_user_id,
                    user_id,
                    notification_type,
                    type,
                    title,
                    message,
                    is_read,
                    sender_user_id,
                    sender_role,
                    action_url,
                    related_resource_type,
                    related_resource_id,
                    created_at
                ) VALUES (
                    :id,
                    :recipient_user_id,
                    :recipient_user_id,
                    :notification_type,
                    :notification_type,
                    :title,
                    :message,
                    FALSE,
                    :sender_user_id,
                    :sender_role,
                    :action_url,
                    :related_resource_type,
                    :related_resource_id,
                    NOW()
                )
            """),
            {
                "id": notification_id,
                "recipient_user_id": recipient_user_id,
                "notification_type": notification_type,
                "title": title,
                "message": message,
                "sender_user_id": sender_user_id,
                "sender_role": sender_role,
                "action_url": action_url,
                "related_resource_type": related_resource_type,
                "related_resource_id": related_resource_id
            }
        )
        await db_session.commit()
    except Exception as e:
        logger.error("notification_db_insert_failed", error=str(e))
        return False, f"Database insert failed: {str(e)}"
    
    # Get user's email
    try:
        result = await db_session.execute(
            text("SELECT email FROM users WHERE id = :uid LIMIT 1"),
            {"uid": recipient_user_id}
        )
        row = result.fetchone()
        if not row or not row[0]:
            logger.warning("notification_email_skipped", reason="User email not found", user_id=recipient_user_id)
            return True, "Notification created but email not sent (no user email)"
        
        user_email = row[0]
    except Exception as e:
        logger.error("user_email_lookup_failed", error=str(e))
        return True, "Notification created but email lookup failed"
    
    # Send email
    subject = f"Velontri: {title}"
    email_success, email_error = await send_notification_email(
        to_email=user_email,
        subject=subject,
        title=title,
        message=message,
        action_url=f"https://velontri.pxxl.click{action_url}" if action_url and not action_url.startswith("http") else action_url,
        notification_type=notification_type
    )
    
    if not email_success:
        logger.warning("notification_email_failed_but_db_created", 
                      notification_id=notification_id,
                      error=email_error)
        return True, f"Notification created but email failed: {email_error}"
    
    return True, None
