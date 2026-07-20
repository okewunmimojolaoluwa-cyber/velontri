from __future__ import annotations
from functools import lru_cache
from shared.config import BaseServiceSettings


class LogisticsSettings(BaseServiceSettings):
    SERVICE_NAME: str = "logistics-service"
    GIG_API_URL: str = "https://api.giglogistics.com/v1"
    GIG_API_KEY: str = ""
    DHL_API_URL: str = "https://api.dhl.com/rate"
    DHL_API_KEY: str = ""
    FEDEX_API_URL: str = "https://apis.fedex.com/rate/v1/rates/quotes"
    FEDEX_API_KEY: str = ""
    PROOF_COLLECTION_TIMEOUT_HOURS: int = 2


@lru_cache(maxsize=1)
def get_settings() -> LogisticsSettings:
    return LogisticsSettings()
