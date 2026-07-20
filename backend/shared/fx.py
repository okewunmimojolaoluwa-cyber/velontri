"""
FX rate provider integration and currency conversion utilities.

Shared across all Velontri microservices that need multi-currency support.

Supported currencies: NGN, GHS, KES, ZAR, XOF
FX rates are cached in Redis with a 4-hour TTL (refreshed on expiry).

Design principles:
- `convert()` is a PURE function — deterministic, no side effects.
  Given the same inputs it always returns the same output (Property 7).
- `get_rate()` is the async I/O layer (cache + provider call).
- All amounts are Decimal throughout to avoid floating-point drift.
- Rounding uses ROUND_HALF_UP for financial correctness.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

import httpx
from redis.asyncio import Redis

from shared.logging import get_logger

logger = get_logger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

SUPPORTED_CURRENCIES: frozenset[str] = frozenset({"NGN", "GHS", "KES", "ZAR", "XOF"})

# Cache TTL in seconds (≤4 hours per spec requirement 24.1)
FX_CACHE_TTL_SECONDS: int = 4 * 3600

_FX_CACHE_PREFIX = "velontri:fx_rate:"


# ── Pure conversion function ──────────────────────────────────────────────────

def convert(
    amount: Decimal,
    rate: Decimal,
) -> Decimal:
    """
    Convert *amount* at the given *rate* to the target currency.

    This is a PURE function — identical inputs always produce identical output.
    No side effects, no I/O, no randomness.

    :param amount: the amount in the source currency
    :param rate: the exchange rate (target / source)
    :returns: converted amount rounded to 2 decimal places
    :raises ValueError: if rate is non-positive or amount is negative
    """
    if rate <= Decimal("0"):
        raise ValueError(f"FX rate must be positive, got {rate}")
    if amount < Decimal("0"):
        raise ValueError(f"Amount must be non-negative, got {amount}")

    result = (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return result


def convert_with_currencies(
    amount: Decimal,
    base_currency: str,
    target_currency: str,
    rate: Decimal,
) -> Decimal:
    """
    Convert *amount* from *base_currency* to *target_currency* at *rate*.

    Validates that both currencies are supported before converting.

    :raises ValueError: if either currency is unsupported
    """
    base = base_currency.upper()
    target = target_currency.upper()

    if base not in SUPPORTED_CURRENCIES:
        raise ValueError(f"Unsupported base currency: {base_currency}")
    if target not in SUPPORTED_CURRENCIES:
        raise ValueError(f"Unsupported target currency: {target_currency}")

    if base == target:
        return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return convert(amount, rate)


# ── Async rate fetcher ────────────────────────────────────────────────────────

async def get_rate(
    base: str,
    target: str,
    redis: Redis,
    provider_url: str,
    ttl: int = FX_CACHE_TTL_SECONDS,
) -> Decimal:
    """
    Fetch the exchange rate from *base* to *target*.

    1. Check Redis cache (`velontri:fx_rate:{BASE}_{TARGET}`).
    2. If cache miss, call the FX provider.
    3. Cache the result with the configured TTL.
    4. On any failure, fall back to 1.0 and log a warning.

    :param base: ISO-4217 source currency code
    :param target: ISO-4217 target currency code
    :param redis: async Redis client
    :param provider_url: base URL of the FX rate API
    :param ttl: cache lifetime in seconds (default: 4 h)
    :returns: Decimal exchange rate
    """
    base = base.upper()
    target = target.upper()

    if base == target:
        return Decimal("1.0")

    cache_key = f"{_FX_CACHE_PREFIX}{base}_{target}"

    # Try cache first
    cached: bytes | None = await redis.get(cache_key)
    if cached is not None:
        try:
            return Decimal(cached.decode() if isinstance(cached, bytes) else cached)
        except Exception:
            logger.warning("fx_cache_parse_failed", key=cache_key, cached=str(cached))

    # Cache miss — fetch from provider
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                provider_url,
                params={"base": base, "symbols": target},
            )
            if resp.status_code == 200:
                data = resp.json()
                rate_raw = data.get("rates", {}).get(target)
                if rate_raw is not None:
                    rate = Decimal(str(rate_raw))
                    # Cache the fresh rate
                    await redis.setex(cache_key, ttl, str(rate))
                    logger.debug(
                        "fx_rate_fetched",
                        base=base,
                        target=target,
                        rate=str(rate),
                    )
                    return rate
                else:
                    logger.warning(
                        "fx_rate_missing_from_response",
                        base=base,
                        target=target,
                        response_keys=list(data.get("rates", {}).keys()),
                    )
            else:
                logger.warning(
                    "fx_provider_error",
                    base=base,
                    target=target,
                    status=resp.status_code,
                )
    except Exception as exc:
        logger.warning(
            "fx_rate_fetch_failed",
            base=base,
            target=target,
            error=str(exc),
        )

    # Fallback: 1.0 (same-currency behaviour)
    logger.warning(
        "fx_rate_fallback_to_1",
        base=base,
        target=target,
    )
    return Decimal("1.0")


async def get_all_rates(
    base: str,
    redis: Redis,
    provider_url: str,
    ttl: int = FX_CACHE_TTL_SECONDS,
) -> dict[str, Decimal]:
    """
    Fetch rates from *base* to all supported currencies in a single API call.

    Returns a dict mapping target currency → rate.
    Missing currencies fall back to 1.0.
    """
    base = base.upper()
    targets = sorted(SUPPORTED_CURRENCIES - {base})

    if not targets:
        return {}

    # Try to build from cache first
    result: dict[str, Decimal] = {}
    missing: list[str] = []

    for target in targets:
        cache_key = f"{_FX_CACHE_PREFIX}{base}_{target}"
        cached = await redis.get(cache_key)
        if cached is not None:
            try:
                result[target] = Decimal(
                    cached.decode() if isinstance(cached, bytes) else cached
                )
            except Exception:
                missing.append(target)
        else:
            missing.append(target)

    if missing:
        symbols = ",".join(missing)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    provider_url,
                    params={"base": base, "symbols": symbols},
                )
                if resp.status_code == 200:
                    rates_raw = resp.json().get("rates", {})
                    for target in missing:
                        rate_raw = rates_raw.get(target)
                        if rate_raw is not None:
                            rate = Decimal(str(rate_raw))
                            result[target] = rate
                            cache_key = f"{_FX_CACHE_PREFIX}{base}_{target}"
                            await redis.setex(cache_key, ttl, str(rate))
                        else:
                            result[target] = Decimal("1.0")
        except Exception as exc:
            logger.warning("fx_all_rates_fetch_failed", base=base, error=str(exc))
            for target in missing:
                result[target] = Decimal("1.0")

    return result
