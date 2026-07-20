from __future__ import annotations
from functools import lru_cache
from shared.config import BaseServiceSettings

class AnalyticsSettings(BaseServiceSettings):
    SERVICE_NAME: str = "analytics-service"

@lru_cache(maxsize=1)
def get_settings() -> AnalyticsSettings:
    return AnalyticsSettings()
