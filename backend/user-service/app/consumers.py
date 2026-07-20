"""
User Service RabbitMQ event consumers.

Consumes:
- user.registered     → create profile record
- user.phone_verified → set trust_badge = 'bronze'
- subscription.tier_changed → update subscription_tier on profile
"""
from __future__ import annotations

from typing import Any

from shared.logging import get_logger

logger = get_logger(__name__)


async def handle_user_registered(
    payload: dict[str, Any],
    session_factory: Any,
) -> None:
    """
    Create a profile record when a new user registers via Auth Service.
    This consumer is idempotent — if the profile already exists, it's a no-op.
    """
    from .repository import create_profile, get_profile
    from shared.database import get_session
    import uuid

    user_id_str: str | None = payload.get("user_id")
    if not user_id_str:
        logger.warning("user_registered_missing_user_id", payload=payload)
        return

    user_id = uuid.UUID(user_id_str)

    async with get_session(session_factory) as session:
        existing = await get_profile(session, user_id)
        if existing:
            logger.debug("profile_already_exists", user_id=user_id_str)
            return

        await create_profile(
            session,
            user_id=user_id,
            full_name=payload.get("full_name", ""),
            email=payload.get("email", ""),
            phone=payload.get("phone", ""),
            country_code=payload.get("country_code", "NG"),
        )

    logger.info("profile_created", user_id=user_id_str)


async def handle_phone_verified(
    payload: dict[str, Any],
    session_factory: Any,
) -> None:
    """Award Bronze trust badge when phone is verified."""
    from .repository import set_trust_badge
    from shared.database import get_session
    import uuid

    user_id_str: str | None = payload.get("user_id")
    if not user_id_str:
        return

    user_id = uuid.UUID(user_id_str)
    async with get_session(session_factory) as session:
        await set_trust_badge(session, user_id, "bronze")

    logger.info("trust_badge_set_bronze", user_id=user_id_str)


async def handle_subscription_tier_changed(
    payload: dict[str, Any],
    session_factory: Any,
) -> None:
    """Sync subscription tier on the profile within 60 seconds of the event."""
    from .repository import update_subscription_tier
    from shared.database import get_session
    import uuid

    user_id_str: str | None = payload.get("user_id")
    new_tier: str | None = payload.get("tier")

    if not user_id_str or not new_tier:
        logger.warning("tier_changed_missing_fields", payload=payload)
        return

    user_id = uuid.UUID(user_id_str)
    async with get_session(session_factory) as session:
        await update_subscription_tier(session, user_id, new_tier)

    logger.info(
        "subscription_tier_synced", user_id=user_id_str, tier=new_tier
    )
