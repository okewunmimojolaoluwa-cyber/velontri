"""
Unit tests for FX utilities (Task 22.3).
Property test: FX Conversion Determinism (Task 19.4, Property 7).

Tests:
- convert() with known rates
- Stale cache refresh trigger
- Unsupported currency rejection
- Rounding behaviour for all five currencies
- Property: convert() is a pure function
"""
from __future__ import annotations

import sys
from pathlib import Path

_WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
if str(_WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(_WORKSPACE_ROOT))

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from hypothesis import given, settings as h_settings, strategies as st


# ── Property 7: FX Conversion Determinism ────────────────────────────────────

class TestFXConversionDeterminismProperty:
    """
    Property 7: FX Conversion Determinism.

    Two calls to convert(price, rate) with identical inputs ALWAYS return
    identical output. The function is pure — no side effects, no randomness.
    """

    @given(
        amount=st.decimals(
            min_value=Decimal("0.01"),
            max_value=Decimal("10000000"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
        rate=st.decimals(
            min_value=Decimal("0.0001"),
            max_value=Decimal("10000"),
            places=4,
            allow_nan=False,
            allow_infinity=False,
        ),
    )
    @h_settings(max_examples=500, deadline=None)
    def test_same_inputs_always_same_output(
        self, amount: Decimal, rate: Decimal
    ) -> None:
        """convert(amount, rate) must be deterministic — identical inputs → identical output."""
        from shared.fx import convert
        result1 = convert(amount, rate)
        result2 = convert(amount, rate)
        assert result1 == result2

    @given(
        amount=st.decimals(
            min_value=Decimal("0.01"),
            max_value=Decimal("10000000"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
        rate=st.decimals(
            min_value=Decimal("0.0001"),
            max_value=Decimal("10000"),
            places=4,
            allow_nan=False,
            allow_infinity=False,
        ),
    )
    @h_settings(max_examples=300)
    def test_result_has_two_decimal_places(
        self, amount: Decimal, rate: Decimal
    ) -> None:
        """Result must always be rounded to exactly 2 decimal places."""
        from shared.fx import convert
        result = convert(amount, rate)
        # Check that the result has at most 2 decimal places
        as_str = str(result)
        if "." in as_str:
            decimal_places = len(as_str.split(".")[1])
            assert decimal_places <= 2

    @given(
        amount=st.decimals(
            min_value=Decimal("0.01"),
            max_value=Decimal("10000000"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
        rate=st.decimals(
            min_value=Decimal("0.0001"),
            max_value=Decimal("10000"),
            places=4,
            allow_nan=False,
            allow_infinity=False,
        ),
    )
    @h_settings(max_examples=200)
    def test_result_nonnegative(self, amount: Decimal, rate: Decimal) -> None:
        """Result of a non-negative amount at positive rate is always non-negative."""
        from shared.fx import convert
        result = convert(amount, rate)
        assert result >= Decimal("0")


# ── Unit tests ────────────────────────────────────────────────────────────────

class TestConvertFunction:

    def test_known_ngn_to_ghs_conversion(self) -> None:
        """NGN → GHS at known rate."""
        from shared.fx import convert
        # 100 NGN at rate 0.0067 GHS/NGN ≈ 0.67 GHS
        result = convert(Decimal("100.00"), Decimal("0.0067"))
        assert result == Decimal("0.67")

    def test_known_ghs_to_kes_conversion(self) -> None:
        from shared.fx import convert
        # 50 GHS at rate 14.5 KES/GHS = 725.00 KES
        result = convert(Decimal("50.00"), Decimal("14.5"))
        assert result == Decimal("725.00")

    def test_rate_one_returns_same_amount(self) -> None:
        """Rate 1.0 = no conversion (same currency)."""
        from shared.fx import convert
        amount = Decimal("12345.67")
        result = convert(amount, Decimal("1.0"))
        assert result == amount

    def test_zero_rate_raises(self) -> None:
        from shared.fx import convert
        with pytest.raises(ValueError, match="positive"):
            convert(Decimal("100"), Decimal("0"))

    def test_negative_rate_raises(self) -> None:
        from shared.fx import convert
        with pytest.raises(ValueError):
            convert(Decimal("100"), Decimal("-1.5"))

    def test_negative_amount_raises(self) -> None:
        from shared.fx import convert
        with pytest.raises(ValueError):
            convert(Decimal("-50"), Decimal("1.5"))

    def test_rounding_half_up_at_0005(self) -> None:
        """Test ROUND_HALF_UP: 0.005 rounds up to 0.01."""
        from shared.fx import convert
        # 1 unit at rate 0.005 = 0.005 → rounds to 0.01
        result = convert(Decimal("1"), Decimal("0.005"))
        assert result == Decimal("0.01")

    def test_large_amount_precision(self) -> None:
        """Large amounts must still round to 2 decimal places."""
        from shared.fx import convert
        result = convert(Decimal("9999999.99"), Decimal("1500"))
        assert "." in str(result)
        assert len(str(result).split(".")[1]) <= 2

    def test_convert_with_currencies_same_currency_no_conversion(self) -> None:
        """Same base and target currency returns original amount."""
        from shared.fx import convert_with_currencies
        result = convert_with_currencies(
            Decimal("50000"), "NGN", "NGN", Decimal("1.5")
        )
        assert result == Decimal("50000.00")

    def test_convert_with_currencies_unsupported_base_raises(self) -> None:
        from shared.fx import convert_with_currencies
        with pytest.raises(ValueError, match="Unsupported base"):
            convert_with_currencies(Decimal("100"), "USD", "NGN", Decimal("1.5"))

    def test_convert_with_currencies_unsupported_target_raises(self) -> None:
        from shared.fx import convert_with_currencies
        with pytest.raises(ValueError, match="Unsupported target"):
            convert_with_currencies(Decimal("100"), "NGN", "EUR", Decimal("1.5"))

    def test_all_supported_currencies(self) -> None:
        """All 5 supported currencies must be in the set."""
        from shared.fx import SUPPORTED_CURRENCIES
        assert SUPPORTED_CURRENCIES == {"NGN", "GHS", "KES", "ZAR", "XOF"}


class TestGetRateFunction:

    @pytest.mark.asyncio
    async def test_returns_1_for_same_currency(self) -> None:
        from shared.fx import get_rate
        mock_redis = AsyncMock()
        rate = await get_rate("NGN", "NGN", mock_redis, "http://fx.test")
        assert rate == Decimal("1.0")
        mock_redis.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_uses_cached_rate(self) -> None:
        """Cache hit returns cached rate without calling provider."""
        from shared.fx import get_rate
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"1500.50")

        rate = await get_rate("NGN", "KES", mock_redis, "http://fx.test")
        assert rate == Decimal("1500.50")

    @pytest.mark.asyncio
    async def test_fetches_and_caches_on_miss(self) -> None:
        """Cache miss → provider call → cache set."""
        from shared.fx import get_rate
        import httpx

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.setex = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"rates": {"GHS": "0.0067"}}

        with MagicMock() as mock_http_cls:
            import unittest.mock as um
            with um.patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client.get = AsyncMock(return_value=mock_response)
                mock_client_cls.return_value = mock_client

                rate = await get_rate("NGN", "GHS", mock_redis, "http://fx.test")

        assert rate == Decimal("0.0067")
        mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_falls_back_to_1_on_provider_error(self) -> None:
        """Provider failure → fallback to 1.0, no exception raised."""
        from shared.fx import get_rate

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        with MagicMock():
            import unittest.mock as um
            with um.patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client.get = AsyncMock(side_effect=Exception("timeout"))
                mock_client_cls.return_value = mock_client

                rate = await get_rate("NGN", "ZAR", mock_redis, "http://fx.test")

        assert rate == Decimal("1.0")

    @pytest.mark.asyncio
    async def test_cache_key_format(self) -> None:
        """Cache key must follow the velontri:fx_rate:{BASE}_{TARGET} pattern."""
        from shared.fx import get_rate, _FX_CACHE_PREFIX

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"1.5")

        await get_rate("NGN", "GHS", mock_redis, "http://fx.test")
        call_key = mock_redis.get.call_args[0][0]
        assert call_key == f"{_FX_CACHE_PREFIX}NGN_GHS"

    @pytest.mark.asyncio
    async def test_stale_cache_refresh_on_expiry(self) -> None:
        """When cache returns None (expired), provider is called again."""
        from shared.fx import get_rate, FX_CACHE_TTL_SECONDS

        # TTL must be ≤ 4 hours per requirement 24.1
        assert FX_CACHE_TTL_SECONDS <= 4 * 3600

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)  # simulate expired cache
        mock_redis.setex = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"rates": {"KES": "18.5"}}

        import unittest.mock as um
        with um.patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            rate = await get_rate("NGN", "KES", mock_redis, "http://fx.test")

        assert rate == Decimal("18.5")
        # Verify setex was called with correct TTL
        call_args = mock_redis.setex.call_args[0]
        assert call_args[1] == FX_CACHE_TTL_SECONDS


class TestFXRounding:
    """Rounding behaviour for all 5 supported currencies."""

    def test_ngn_rounds_to_kobo(self) -> None:
        """NGN stores 2 decimal places (kobo)."""
        from shared.fx import convert
        result = convert(Decimal("1000.999"), Decimal("1"))
        # 1000.999 at rate 1 = 1001.00 (ROUND_HALF_UP)
        assert result == Decimal("1001.00")

    def test_ghs_rounds_correctly(self) -> None:
        from shared.fx import convert
        result = convert(Decimal("1"), Decimal("0.0675"))
        assert len(str(result).split(".")[1]) <= 2

    def test_kes_large_rate_rounds_correctly(self) -> None:
        from shared.fx import convert
        # 1 NGN at 18.345 KES
        result = convert(Decimal("1"), Decimal("18.345"))
        assert result == Decimal("18.35")  # ROUND_HALF_UP

    def test_zar_precision_preserved(self) -> None:
        from shared.fx import convert
        result = convert(Decimal("100"), Decimal("0.082"))
        assert result == Decimal("8.20")

    def test_xof_integer_like_result(self) -> None:
        """XOF is a zero-decimal currency but we store 2dp for consistency."""
        from shared.fx import convert
        result = convert(Decimal("1000"), Decimal("0.85"))
        assert result == Decimal("850.00")
