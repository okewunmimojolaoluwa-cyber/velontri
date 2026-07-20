"""Marketplace Service configuration."""
from __future__ import annotations

from functools import lru_cache
from shared.config import BaseServiceSettings


class MarketplaceSettings(BaseServiceSettings):
    SERVICE_NAME: str = "marketplace-service"

    # Listing quotas per tier (0 = unlimited)
    LISTING_QUOTA_STARTER: int = 10
    LISTING_QUOTA_GROWTH: int = 100
    LISTING_QUOTA_PRO: int = 0       # unlimited
    LISTING_QUOTA_ENTERPRISE: int = 0

    # AI Service URL for spam detection and CV scoring
    AI_SERVICE_URL: str = "http://ai-service:8000"

    # Logistics Service URL for VIN lookup
    VIN_LOOKUP_PROVIDER_URL: str = "https://api.vindecoder.eu/3.2"
    VIN_LOOKUP_API_KEY: str = ""

    # Financing config (defaults; can be overridden per listing)
    DEFAULT_FINANCING_DEPOSIT_PCT: float = 20.0
    DEFAULT_FINANCING_INTEREST_RATE_PCT: float = 18.0


@lru_cache(maxsize=1)
def get_settings() -> MarketplaceSettings:
    return MarketplaceSettings()
