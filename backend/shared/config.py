"""
Shared configuration base for all Velontri microservices.
Each service imports this and extends it with service-specific settings.
All settings are sourced exclusively from environment variables — never
hardcoded defaults for secrets.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseServiceSettings(BaseSettings):
    """Base configuration shared by every Velontri microservice."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Service identity ───────────────────────────────────────────────
    SERVICE_NAME: str
    SERVICE_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # ── PostgreSQL ─────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./dev_gateway.db",
        description="Database DSN. For local dev, defaults to SQLite"
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    # ── Redis ──────────────────────────────────────────────────────────
    REDIS_URL: str | None = Field(
        default=None,
        description="Redis DSN, e.g. redis://localhost:6379/0. Set to None to disable."
    )
    REDIS_MAX_CONNECTIONS: int = 50

    # ── RabbitMQ ───────────────────────────────────────────────────────
    RABBITMQ_URL: str | None = Field(
        default=None,
        description="AMQP DSN, e.g. amqp://user:pass@localhost:5672/. Set to None to disable."
    )
    RABBITMQ_PREFETCH_COUNT: int = 10
    RABBITMQ_RECONNECT_DELAY: float = 2.0
    RABBITMQ_RECONNECT_MAX_DELAY: float = 60.0

    # ── AWS S3 ─────────────────────────────────────────────────────────
    AWS_REGION: str = "af-south-1"
    AWS_S3_BUCKET: str = Field(
        default="velontri-local",
        description="Primary S3 bucket name for this service"
    )
    AWS_ACCESS_KEY_ID: str | None = None   # Use IAM role in production
    AWS_SECRET_ACCESS_KEY: str | None = None

    # ── JWT ────────────────────────────────────────────────────────────
    JWT_ALGORITHM: str = "RS256"
    JWT_PUBLIC_KEY_PATH: str = "/run/secrets/jwt_public_key"
    JWT_PRIVATE_KEY_PATH: str | None = None  # Only needed by Auth Service

    # ── Observability ─────────────────────────────────────────────────
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    SENTRY_DSN: str | None = None

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        # Allow SQLite for local development
        if not (v.startswith("postgresql+asyncpg://") or v.startswith("sqlite+aiosqlite://")):
            raise ValueError(
                "DATABASE_URL must use asyncpg (postgresql+asyncpg://...) or aiosqlite (sqlite+aiosqlite://...)"
            )
        return v

    @field_validator("REDIS_URL")
    @classmethod
    def validate_redis_url(cls, v: str | None) -> str | None:
        if v is not None and not (v.startswith("redis://") or v.startswith("rediss://")):
            raise ValueError("REDIS_URL must start with redis:// or rediss://")
        return v

    @field_validator("RABBITMQ_URL")
    @classmethod
    def validate_rabbitmq_url(cls, v: str | None) -> str | None:
        if v is not None and not (v.startswith("amqp://") or v.startswith("amqps://")):
            raise ValueError("RABBITMQ_URL must start with amqp:// or amqps://")
        return v
