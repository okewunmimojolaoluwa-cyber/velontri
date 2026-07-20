"""Search Service configuration."""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field

from shared.config import BaseServiceSettings


class SearchSettings(BaseServiceSettings):
    SERVICE_NAME: str = "search-service"

    # Search service has no database — override with a safe default so
    # BaseServiceSettings validation doesn't fail at startup.
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://velontri:velontri@postgres-auth:5432/auth_db",
        description="Not used by search-service; kept for base class compatibility",
    )

    # Elasticsearch
    ELASTICSEARCH_URL: str = "http://elasticsearch:9200"
    ELASTICSEARCH_INDEX: str = "listings"

    # AI Service for NL query parsing and voice transcription
    AI_SERVICE_URL: str = "http://ai-service:8000"

    # HTTP client timeouts (seconds)
    HTTP_TIMEOUT: float = 10.0
    AI_TIMEOUT: float = 5.0


@lru_cache(maxsize=1)
def get_settings() -> SearchSettings:
    return SearchSettings()
