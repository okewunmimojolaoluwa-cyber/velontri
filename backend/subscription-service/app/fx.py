"""FX rate utilities — Property 7: FX Conversion Determinism."""
from __future__ import annotations
from decimal import Decimal, ROUND_HALF_UP
import httpx
from redis.asyncio import Redis
from shared.logging import get_logger

logger = get_logger(__name__)
_FX_CACHE_PREFIX = "subscription:fx_rate:"


def convert(amount: Decimal, rate: Decimal) -> Decimal:
    """Pure conversion function — deterministic, no side effects."""
    if rate <= 0:
        raise ValueError("FX rate must be positive")
    return (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def get_rate(base: str, target: str, redis: Redis, ttl: int, provider_url: str) -> Decimal:
    """Fetch rate with Redis caching. Falls back to 1.0 on error."""
    if base == target:
        return Decimal("1.0")
    cache_key = f"{_FX_CACHE_PREFIX}{base}_{target}"
    cached = await redis.get(cache_key)
    if cached:
        return Decimal(cached)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{provider_url}?base={base}&symbols={target}")
            if resp.status_code == 200:
                rate_raw = resp.json().get("rates", {}).get(target, 1.0)
                rate = Decimal(str(rate_raw))
                await redis.setex(cache_key, ttl, str(rate))
                return rate
    except Exception:
        logger.warning("fx_rate_fetch_failed", base=base, target=target)
    return Decimal("1.0")
