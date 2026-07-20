from __future__ import annotations
from functools import lru_cache
from pydantic import Field
from shared.config import BaseServiceSettings


class AISettings(BaseServiceSettings):
    SERVICE_NAME: str = "ai-service"

    # AI service has no database — override with a safe default
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://velontri:velontri@postgres-auth:5432/auth_db",
        description="Not used by ai-service; kept for base class compatibility",
    )

    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key")
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    SEARCH_SERVICE_URL: str = "http://search-service:8000"
    MAX_CONVERSATION_TURNS: int = 20
    SESSION_TTL_SECONDS: int = 7200  # 2 hours
    SPAM_CONFIDENCE_THRESHOLD: float = 0.85


@lru_cache(maxsize=1)
def get_settings() -> AISettings:
    return AISettings()
