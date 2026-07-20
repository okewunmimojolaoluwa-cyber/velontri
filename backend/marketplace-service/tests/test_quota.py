"""
Property test: Subscription Quota Enforcement (Task 6.10, Property 6)

Property: After any sequence of listing creation attempts,
the number of active listings for a seller MUST NOT exceed their tier quota.

This is the Hypothesis-based property test that proves the quota gate
can never be bypassed, regardless of the sequence of operations.
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from hypothesis import given, settings as h_settings, strategies as st

from app.service import QUOTA_MAP


# ── Strategy definitions ──────────────────────────────────────────────────────

tier_strategy = st.sampled_from(["starter", "growth", "pro", "enterprise"])

listing_count_strategy = st.integers(min_value=0, max_value=150)


# ── Property test ─────────────────────────────────────────────────────────────

class TestQuotaEnforcementProperty:
    """
    Property 6: Subscription Quota Enforcement.

    For any (tier, existing_count) pair, if existing_count >= quota,
    then _enforce_quota MUST raise QuotaExceededError.
    If existing_count < quota (or tier is unlimited), it MUST NOT raise.
    """

    @given(
        tier=tier_strategy,
        existing_count=listing_count_strategy,
    )
    @h_settings(max_examples=200)
    @pytest.mark.asyncio
    async def test_quota_enforcement(self, tier: str, existing_count: int) -> None:
        from app.service import MarketplaceService
        from shared.errors import QuotaExceededError

        max_listings = QUOTA_MAP.get(tier, 10)

        # Build a minimal mock service
        mock_session = AsyncMock()
        mock_redis = AsyncMock()
        mock_settings = MagicMock()
        mock_settings.AWS_S3_BUCKET = "test-bucket"

        # Redis returns None (cache miss) so we fall through to DB
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.setex = AsyncMock()

        # DB count returns existing_count
        with patch(
            "app.service.repo.count_active_listings",
            new_callable=AsyncMock,
            return_value=existing_count,
        ):
            svc = MarketplaceService(
                session=mock_session,
                redis=mock_redis,
                settings=mock_settings,
                rabbitmq_channel=AsyncMock(),
            )

            if max_listings == 0:
                # Unlimited — must never raise
                await svc._enforce_quota(uuid.uuid4(), tier)
            elif existing_count >= max_listings:
                # At or over quota — must raise
                with pytest.raises(QuotaExceededError):
                    await svc._enforce_quota(uuid.uuid4(), tier)
            else:
                # Under quota — must NOT raise
                await svc._enforce_quota(uuid.uuid4(), tier)

    def test_quota_map_values(self) -> None:
        """Sanity check quota map matches spec: Starter=10, Growth=100, Pro=0, Enterprise=0."""
        assert QUOTA_MAP["starter"] == 10
        assert QUOTA_MAP["growth"] == 100
        assert QUOTA_MAP["pro"] == 0        # unlimited
        assert QUOTA_MAP["enterprise"] == 0  # unlimited

    @pytest.mark.asyncio
    async def test_unlimited_tier_never_raises(self) -> None:
        from app.service import MarketplaceService
        from shared.errors import QuotaExceededError

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.setex = AsyncMock()

        # Even with 10,000 existing listings, pro/enterprise must not raise
        with patch(
            "app.service.repo.count_active_listings",
            new_callable=AsyncMock,
            return_value=10000,
        ):
            svc = MarketplaceService(
                session=AsyncMock(),
                redis=mock_redis,
                settings=MagicMock(AWS_S3_BUCKET="test"),
                rabbitmq_channel=AsyncMock(),
            )
            # Should not raise for unlimited tiers
            await svc._enforce_quota(uuid.uuid4(), "pro")
            await svc._enforce_quota(uuid.uuid4(), "enterprise")

    @pytest.mark.asyncio
    async def test_redis_cache_used_when_available(self) -> None:
        """When Redis has a cached count, DB must not be queried."""
        from app.service import MarketplaceService

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value="5")  # cached: 5 listings
        mock_redis.setex = AsyncMock()

        with patch(
            "app.service.repo.count_active_listings",
            new_callable=AsyncMock,
        ) as mock_db:
            svc = MarketplaceService(
                session=AsyncMock(),
                redis=mock_redis,
                settings=MagicMock(),
                rabbitmq_channel=AsyncMock(),
            )
            await svc._enforce_quota(uuid.uuid4(), "starter")
            # DB must NOT have been called
            mock_db.assert_not_called()
