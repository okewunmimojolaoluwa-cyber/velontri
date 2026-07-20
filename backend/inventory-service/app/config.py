from __future__ import annotations

from functools import lru_cache

from shared.config import BaseServiceSettings


class InventorySettings(BaseServiceSettings):
    SERVICE_NAME: str = "inventory-service"
    STOCK_MOVEMENT_PAGE_SIZE: int = 100


@lru_cache(maxsize=1)
def get_settings() -> InventorySettings:
    return InventorySettings()
