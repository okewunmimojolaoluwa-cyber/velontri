"""
Payment Service fraud scoring module.

Implements a rule-based heuristic scorer as a drop-in replacement for
an ML model. Each heuristic contributes a score delta; the final score
is clamped to [0.0, 1.0].

Model version: "heuristic-v1"

Redis key schema (all managed within this module):
  - payment:avg_amount:{buyer_id}        — running average order amount
  - payment:dispute_flag:{buyer_id}:{seller_id} — recent dispute marker (30d TTL)
  - payment:velocity:{buyer_id}          — sorted set of recent tx timestamps
"""
from __future__ import annotations

from decimal import Decimal

from redis.asyncio import Redis

from shared.logging import get_logger

logger = get_logger(__name__)

# Heuristic score contribution weights
_WEIGHT_HIGH_AMOUNT = 0.30       # Amount > 10× buyer's average
_WEIGHT_RECENT_DISPUTE = 0.40    # Dispute between this buyer+seller in last 30 days
_WEIGHT_HIGH_VELOCITY = 0.30     # > 3 transactions from buyer in last 5 minutes

_MODEL_VERSION = "heuristic-v1"

# TTL constants (seconds)
_AVG_AMOUNT_TTL = 30 * 24 * 3600        # 30 days
_DISPUTE_FLAG_TTL = 30 * 24 * 3600      # 30 days
_VELOCITY_WINDOW_SECONDS = 5 * 60       # 5 minutes
_VELOCITY_KEY_TTL = 10 * 60             # keep sorted set for 10 min


def _avg_amount_key(buyer_id: str) -> str:
    return f"payment:avg_amount:{buyer_id}"


def _dispute_flag_key(buyer_id: str, seller_id: str) -> str:
    return f"payment:dispute_flag:{buyer_id}:{seller_id}"


def _velocity_key(buyer_id: str) -> str:
    return f"payment:velocity:{buyer_id}"


async def score_transaction(
    amount: Decimal,
    currency: str,  # noqa: ARG001 — reserved for currency-normalised scoring
    buyer_id: str,
    seller_id: str,
    redis: Redis,
) -> tuple[float, str]:
    """
    Score a transaction and return ``(score, model_version)``.

    Score 0.0 = very likely safe.
    Score 1.0 = very likely fraud.

    Heuristics applied:
    1. High-amount anomaly  — amount > 10× buyer's rolling average → +0.30
    2. Recent dispute flag  — this buyer+seller had an open dispute in last
                              30 days → +0.40
    3. Velocity check       — buyer submitted > 3 payments in the last
                              5 minutes → +0.30

    All Redis errors are caught and logged; the heuristic is skipped
    rather than failing the entire scoring.
    """
    import time

    score: float = 0.0

    # ── Heuristic 1: High-amount anomaly ─────────────────────────────────────
    try:
        avg_key = _avg_amount_key(buyer_id)
        raw = await redis.get(avg_key)
        if raw is not None:
            avg = Decimal(raw)
            if avg > 0 and amount > avg * 10:
                score += _WEIGHT_HIGH_AMOUNT
                logger.debug(
                    "fraud_high_amount",
                    buyer_id=buyer_id,
                    amount=float(amount),
                    avg=float(avg),
                )
    except Exception as exc:
        logger.warning("fraud_heuristic_1_error", error=str(exc))

    # ── Heuristic 2: Recent dispute between same buyer+seller ─────────────────
    try:
        flag_key = _dispute_flag_key(buyer_id, seller_id)
        has_dispute = await redis.exists(flag_key)
        if has_dispute:
            score += _WEIGHT_RECENT_DISPUTE
            logger.debug(
                "fraud_recent_dispute",
                buyer_id=buyer_id,
                seller_id=seller_id,
            )
    except Exception as exc:
        logger.warning("fraud_heuristic_2_error", error=str(exc))

    # ── Heuristic 3: Transaction velocity check ───────────────────────────────
    try:
        velocity_key = _velocity_key(buyer_id)
        now_ts = time.time()
        window_start = now_ts - _VELOCITY_WINDOW_SECONDS

        # Add current timestamp and prune entries older than the window
        pipe = redis.pipeline()
        pipe.zadd(velocity_key, {str(now_ts): now_ts})
        pipe.zremrangebyscore(velocity_key, "-inf", window_start)
        pipe.zcard(velocity_key)
        pipe.expire(velocity_key, _VELOCITY_KEY_TTL)
        results = await pipe.execute()

        tx_count: int = results[2]  # result of zcard
        if tx_count > 3:
            score += _WEIGHT_HIGH_VELOCITY
            logger.debug(
                "fraud_high_velocity",
                buyer_id=buyer_id,
                tx_count=tx_count,
            )
    except Exception as exc:
        logger.warning("fraud_heuristic_3_error", error=str(exc))

    # Clamp score to [0.0, 1.0]
    final_score = min(max(score, 0.0), 1.0)

    logger.info(
        "fraud_score_computed",
        buyer_id=buyer_id,
        seller_id=seller_id,
        score=final_score,
        model_version=_MODEL_VERSION,
    )

    return final_score, _MODEL_VERSION


async def update_buyer_average(
    redis: Redis,
    buyer_id: str,
    amount: Decimal,
) -> None:
    """
    Update the rolling average transaction amount for a buyer after a
    successful payment. Uses an exponential moving average (EMA, α=0.2)
    so recent transactions have more weight.

    Call this after a payment moves to held_in_escrow.
    """
    avg_key = _avg_amount_key(buyer_id)
    try:
        raw = await redis.get(avg_key)
        if raw is None:
            # First transaction — use the current amount as baseline
            new_avg = amount
        else:
            alpha = Decimal("0.2")
            prev_avg = Decimal(raw)
            new_avg = alpha * amount + (1 - alpha) * prev_avg

        await redis.set(avg_key, str(new_avg), ex=_AVG_AMOUNT_TTL)
    except Exception as exc:
        logger.warning(
            "fraud_update_avg_error", buyer_id=buyer_id, error=str(exc)
        )


async def flag_dispute_for_pair(
    redis: Redis,
    buyer_id: str,
    seller_id: str,
) -> None:
    """
    Set a Redis flag indicating that this buyer+seller pair had a dispute
    in the last 30 days. Consumed by heuristic 2 in score_transaction.
    """
    flag_key = _dispute_flag_key(buyer_id, seller_id)
    try:
        await redis.set(flag_key, "1", ex=_DISPUTE_FLAG_TTL)
    except Exception as exc:
        logger.warning(
            "fraud_flag_dispute_error",
            buyer_id=buyer_id,
            seller_id=seller_id,
            error=str(exc),
        )
