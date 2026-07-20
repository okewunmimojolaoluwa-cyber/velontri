"""Chat Service configuration."""
from __future__ import annotations
from functools import lru_cache
from shared.config import BaseServiceSettings

class ChatSettings(BaseServiceSettings):
    SERVICE_NAME: str = "chat-service"
    AI_SERVICE_URL: str = "http://ai-service:8000"
    MAX_MESSAGE_HISTORY: int = 500
    TYPING_INDICATOR_TTL: int = 3  # seconds
    ONLINE_STATUS_TTL: int = 30    # seconds

@lru_cache(maxsize=1)
def get_settings() -> ChatSettings:
    return ChatSettings()
