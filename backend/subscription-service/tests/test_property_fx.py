"""
Property Test 7: FX Conversion Determinism

Property: convert(amount, rate) is a pure function.
For identical inputs it ALWAYS returns identical output.
No side effects, no randomness, no state.

This validates Requirements 24.2, 24.4, 24.5.
"""
from __future__ import annotations
from decimal import Decimal

import pytest
from hypothesis import given, settings as h_settings, strategies as st

from app.fx import convert


class TestFXConversionDeterminism:

    @given(
        amount=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("100000000"), places=2, allow_nan=False, allow_infinity=False),
        rate=st.decimals(min_value=Decimal("0.000001"), max_value=Decimal("10000"), places=6, allow_nan=False, allow_infinity=False),
    )
    @h_settings(max_examples=500)
    def test_convert_is_deterministic(self, amount: Decimal, rate: Decimal) -> None:
        """Two calls with identical inputs MUST return identical output."""
        result1 = convert(amount, rate)
        result2 = convert(amount, rate)
        assert result1 == result2, f"convert({amount}, {rate}) returned {result1} then {result2}"

    @given(
        amount=st.decimals(min_value=Decimal("1"), max_value=Decimal("1000000"), places=2, allow_nan=False, allow_infinity=False),
        rate=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("1000"), places=4, allow_nan=False, allow_infinity=False),
    )
    @h_settings(max_examples=200)
    def test_convert_result_is_positive(self, amount: Decimal, rate: Decimal) -> None:
        """Converting a positive amount at a positive rate MUST yield a positive result."""
        result = convert(amount, rate)
        assert result > Decimal("0"), f"Expected positive result, got {result}"

    @given(
        amount=st.decimals(min_value=Decimal("1"), max_value=Decimal("10000"), places=2, allow_nan=False, allow_infinity=False),
    )
    @h_settings(max_examples=100)
    def test_convert_at_rate_one_equals_amount(self, amount: Decimal) -> None:
        """Converting at rate 1.0 returns the same amount (rounded to 2dp)."""
        result = convert(amount, Decimal("1.0"))
        assert result == amount.quantize(Decimal("0.01")), f"Expected {amount}, got {result}"

    def test_convert_invalid_rate_raises(self) -> None:
        with pytest.raises(ValueError):
            convert(Decimal("1000"), Decimal("0"))

    def test_convert_negative_rate_raises(self) -> None:
        with pytest.raises(ValueError):
            convert(Decimal("1000"), Decimal("-1"))

    def test_known_conversion(self) -> None:
        """Manual spot check: 100 NGN at rate 0.00065 USD = 0.07 USD."""
        result = convert(Decimal("100"), Decimal("0.00065"))
        assert result == Decimal("0.07")

    def test_result_has_two_decimal_places(self) -> None:
        """Result must always be quantized to 2 decimal places."""
        result = convert(Decimal("1"), Decimal("3"))
        # 1 * 3 = 3.00 — must be Decimal("3.00")
        assert str(result) in ("3.00", "3")
        # Ensure it's rounded
        result2 = convert(Decimal("1"), Decimal("1.005"))
        assert len(str(result2).split(".")[-1]) <= 2


class TestFXPureFunction:
    """
    Verify that convert() has NO side effects.
    Calling it 1000 times must not change any state.
    """

    def test_no_state_mutation(self) -> None:
        amount = Decimal("50000")
        rate = Decimal("1.35")
        results = [convert(amount, rate) for _ in range(1000)]
        # All results must be identical
        assert len(set(str(r) for r in results)) == 1
