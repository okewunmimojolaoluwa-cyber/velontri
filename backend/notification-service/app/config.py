from __future__ import annotations
from functools import lru_cache
from shared.config import BaseServiceSettings


class NotificationSettings(BaseServiceSettings):
    SERVICE_NAME: str = "notification-service"
    AFRICASTALKING_API_KEY: str = ""
    AFRICASTALKING_USERNAME: str = "sandbox"
    AFRICASTALKING_SENDER_ID: str = "Velontri"
    SENDGRID_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@velontri.com"
    WHATSAPP_API_URL: str = ""
    WHATSAPP_TOKEN: str = ""
    FCM_SERVER_KEY: str = ""
    MAX_DELIVERY_RETRIES: int = 3
    NOTIFICATION_HISTORY_DAYS: int = 90


@lru_cache(maxsize=1)
def get_settings() -> NotificationSettings:
    return NotificationSettings()
