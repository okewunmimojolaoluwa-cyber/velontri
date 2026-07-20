"""User Service configuration."""
from __future__ import annotations

from functools import lru_cache
from shared.config import BaseServiceSettings


class UserSettings(BaseServiceSettings):
    SERVICE_NAME: str = "user-service"

    # KYC document validation SLAs (in seconds, used for background task scheduling)
    KYC_SILVER_SLA_SECONDS: int = 86400   # 24 hours
    KYC_GOLD_SLA_SECONDS: int = 172800    # 48 hours

    # Auth service URL for token introspection
    AUTH_SERVICE_URL: str = "http://auth-service:8000"


@lru_cache(maxsize=1)
def get_settings() -> UserSettings:
    return UserSettings()
