"""Auth Service configuration."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field

from shared.config import BaseServiceSettings


class AuthSettings(BaseServiceSettings):
    """Auth-service-specific settings."""

    SERVICE_NAME: str = "auth-service"

    # JWT — Auth Service needs the private key to sign tokens
    JWT_PRIVATE_KEY_PATH: str = "/run/secrets/jwt_private_key"

    # OTP / 2FA
    OTP_TTL_SECONDS: int = 300           # 5 minutes
    OTP_LENGTH: int = 6
    LOCKOUT_WINDOW_SECONDS: int = 900    # 15 minutes
    MAX_FAILED_ATTEMPTS: int = 5
    LOCKOUT_TTL_SECONDS: int = 900       # 15 minutes

    # Password reset
    RESET_TOKEN_TTL_SECONDS: int = 1800  # 30 minutes

    # OAuth providers
    GOOGLE_CLIENT_ID: str = Field(default="", description="Google OAuth client ID")
    GOOGLE_CLIENT_SECRET: str = Field(default="", description="Google OAuth client secret")
    APPLE_CLIENT_ID: str = Field(default="", description="Apple OAuth client ID")
    APPLE_TEAM_ID: str = Field(default="", description="Apple Developer Team ID")
    APPLE_KEY_ID: str = Field(default="", description="Apple private key ID")
    APPLE_PRIVATE_KEY: str = Field(default="", description="Apple private key (PEM)")

    # Email providers — set ONE of these to enable real email sending
    SENDGRID_API_KEY: str = Field(default="", description="SendGrid API key for transactional email")
    RESEND_API_KEY: str = Field(default="", description="Resend API key (resend.com) — alternative to SendGrid")
    EMAIL_FROM: str = Field(default="", description="From address (your Gmail address)")
    EMAIL_FROM_NAME: str = Field(default="Velontri", description="From name for transactional emails")

    # Gmail SMTP — simplest zero-cost option, no domain needed
    GMAIL_USER: str = Field(default="", description="Your Gmail address e.g. you@gmail.com")
    GMAIL_APP_PASSWORD: str = Field(default="", description="Gmail App Password (16 chars, from myaccount.google.com/apppasswords)")
    GMAIL_REFRESH_TOKEN: str = Field(default="", description="Google OAuth Refresh Token for Gmail API (overcomes SMTP blocks)")

    # SMS provider (for OTP delivery)
    SMS_PROVIDER: str = "africastalking"  # africastalking | twilio
    AFRICASTALKING_API_KEY: str = Field(default="", description="Africa's Talking API key")
    AFRICASTALKING_USERNAME: str = Field(default="", description="Africa's Talking username")
    AFRICASTALKING_SENDER_ID: str = "Velontri"

    # Notification service URL (for emailing lockout alerts)
    NOTIFICATION_SERVICE_URL: str = "http://notification-service:8000"

    # TOTP encryption key (for encrypting stored TOTP secrets)
    TOTP_ENCRYPTION_KEY: str = Field(
        description="32-byte Fernet key for TOTP secret encryption at rest"
    )


@lru_cache(maxsize=1)
def get_settings() -> AuthSettings:
    return AuthSettings()
