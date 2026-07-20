from __future__ import annotations
from functools import lru_cache
from shared.config import BaseServiceSettings


class SubscriptionSettings(BaseServiceSettings):
    SERVICE_NAME: str = "subscription-service"
    PRICE_GROWTH_NGN: int = 10000
    PRICE_PRO_NGN: int = 50000
    FX_PROVIDER_URL: str = "https://api.exchangerate.host/latest"
    FX_CACHE_TTL: int = 14400  # 4 hours in seconds
    PAYMENT_SERVICE_URL: str = "http://payment-service:8000"


@lru_cache(maxsize=1)
def get_settings() -> SubscriptionSettings:
    return SubscriptionSettings()
