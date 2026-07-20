from __future__ import annotations
from functools import lru_cache
from shared.config import BaseServiceSettings

class CRMSettings(BaseServiceSettings):
    SERVICE_NAME: str = "crm-service"

@lru_cache(maxsize=1)
def get_settings() -> CRMSettings:
    return CRMSettings()
