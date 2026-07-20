"""
Redis connection management for all Velontri microservices.

Uses redis.asyncio (formerly aioredis) with a shared connection pool.
Every service creates one pool at startup and reuses it for the process lifetime.
"""
from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis
from redis.asyncio import Redis
from redis.asyncio.connection import ConnectionPool
from redis.exceptions import RedisError

from shared.logging import get_logger

logger = get_logger(__name__)


def create_redis_pool(
    redis_url: str,
    max_connections: int = 50,
    decode_responses: bool = True,
) -> ConnectionPool:
    """
    Create a Redis connection pool.

    :param redis_url: Redis DSN, e.g. redis://localhost:6379/0
    :param max_connections: maximum number of connections in the pool
    :param decode_responses: if True, all responses are decoded to str
    """
    return ConnectionPool.from_url(
        redis_url,
        max_connections=max_connections,
        decode_responses=decode_responses,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )


def get_redis_client(pool: ConnectionPool) -> Redis:
    """Return a Redis client that uses the given pool."""
    return aioredis.Redis(connection_pool=pool)


async def check_redis_health(client: Redis) -> bool:
    """
    Ping Redis to verify connectivity.
    Returns True on success, False on any error.
    """
    try:
        return await client.ping()
    except RedisError:
        logger.warning("redis_health_check_failed", exc_info=True)
        return False


async def close_redis_pool(pool: ConnectionPool) -> None:
    """Close all connections in the pool. Call during application shutdown."""
    await pool.disconnect()
    logger.info("redis_pool_closed")


# ── Typed key helpers ─────────────────────────────────────────────────────────
# Centralised key construction prevents key collisions across services.

class RedisKeys:
    """
    Namespace helpers for Redis keys used across all Velontri services.
    Always use these methods — never construct keys inline.
    """

    # Auth Service
    @staticmethod
    def otp(user_id: str, purpose: str) -> str:
        return f"auth:otp:{user_id}:{purpose}"

    @staticmethod
    def lockout(user_id: str) -> str:
        return f"auth:lockout:{user_id}"

    @staticmethod
    def rate_limit_auth(ip: str) -> str:
        return f"auth:rate_limit:{ip}"

    @staticmethod
    def reset_token(token_hash: str) -> str:
        return f"auth:reset_token:{token_hash}"

    # Marketplace Service
    @staticmethod
    def listing_cache(listing_id: str) -> str:
        return f"marketplace:listing:{listing_id}"

    @staticmethod
    def seller_listing_count(seller_id: str) -> str:
        return f"marketplace:seller_listing_count:{seller_id}"

    # Search Service
    @staticmethod
    def autocomplete(prefix: str) -> str:
        return f"search:autocomplete:{prefix}"

    # AI Service
    @staticmethod
    def ai_session(user_id: str, session_id: str) -> str:
        return f"ai:session:{user_id}:{session_id}"

    # Chat Service
    @staticmethod
    def chat_online(user_id: str) -> str:
        return f"chat:online:{user_id}"

    @staticmethod
    def chat_typing(thread_id: str, user_id: str) -> str:
        return f"chat:typing:{thread_id}:{user_id}"
