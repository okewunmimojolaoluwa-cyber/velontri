"""Helper to send email notifications whenever a notification is created."""
import os
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


async def send_notification_email(
    recipient_email: str,
    recipient_name: str,
    notification_title: str,
    notification_message: str,
    action_url: str | None = None,
) -> None:
    """
    Send an email notification to the user.
    Uses Brevo API (primary) or Gmail SMTP (fallback).
    """
    brevo_key = os.getenv('BREVO_API_KEY', '')
    gmail_user = os.getenv('GMAIL_USER', '')
    gmail_pass = os.getenv('GMAIL_APP_PASSWORD', '')
    sender_email = os.getenv('EMAIL_FROM', 'noreply@velontri.com')

    # Build HTML email
    action_button = ''
    if action_url:
        full_url = action_url if action_url.startswith('http') else f"https://velontri.com{action_url}"
        action_button = f'''
        <div style="text-align: center; margin: 30px 0;">
            <a href="{full_url}" 
               style="display: inline-block; padding: 12px 32px; background: #4F46E5; color: #ffffff; 
                      text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
                View Notification
            </a>
        </div>
        '''

    html_body = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 32px 24px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                    Velontri
                </h1>
                <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 500;">
                    Africa's Marketplace
                </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px 24px;">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                    New Notification
                </p>
                <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 20px; font-weight: 700; line-height: 1.3;">
                    {notification_title}
                </h2>
                <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                    {notification_message}
                </p>
                {action_button}
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                        You're receiving this email because you have an account on Velontri. 
                        You can manage your notification preferences in your 
                        <a href="https://velontri.com/dashboard/settings" style="color: #4F46E5; text-decoration: none;">account settings</a>.
                    </p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="padding: 24px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-align: center;">
                    © 2024 Velontri. All rights reserved.
                </p>
                <p style="margin: 0; color: #94a3b8; font-size: 11px; text-align: center;">
                    Lagos, Nigeria • Accra, Ghana • Nairobi, Kenya
                </p>
            </div>
        </div>
    </body>
    </html>
    '''

    subject = f"🔔 {notification_title} — Velontri"

    # Try Brevo first
    if brevo_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    'https://api.brevo.com/v3/smtp/email',
                    headers={'api-key': brevo_key, 'Content-Type': 'application/json'},
                    json={
                        'to': [{'email': recipient_email, 'name': recipient_name}],
                        'from': {'email': sender_email, 'name': 'Velontri'},
                        'subject': subject,
                        'htmlContent': html_body,
                    },
                )
                if resp.status_code in (200, 201, 202):
                    return
        except Exception:
            pass

    # Gmail SMTP fallback
    if gmail_user and gmail_pass:
        def _send_smtp():
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f'Velontri <{gmail_user}>'
            msg['To'] = recipient_email
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))
            
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(gmail_user, gmail_pass)
                server.sendmail(gmail_user, [recipient_email], msg.as_string())
        
        try:
            loop = asyncio.get_event_loop()
            await asyncio.wait_for(loop.run_in_executor(None, _send_smtp), timeout=20.0)
        except Exception:
            pass
