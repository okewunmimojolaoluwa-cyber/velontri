"""
Unit tests for financial calculators (pure functions — no I/O).

Covers:
- Mortgage repayment formula correctness
- Edge cases: zero principal, high interest, 1-year term
- Financing calculator
- Property test: monthly_repayment * n_months >= principal (no negative interest)
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from hypothesis import given, settings as h_settings, strategies as st

from app.calculator import financing_monthly_repayment, monthly_mortgage_repayment


class TestMortgageCalculator:

    def test_standard_mortgage(self) -> None:
        """₦10,000,000 loan, 20% annual interest, 20 years."""
        principal = Decimal("10000000")
        monthly, total, interest = monthly_mortgage_repayment(
            principal=principal,
            annual_interest_rate_pct=Decimal("20"),
            loan_term_years=20,
        )
        # Monthly must be positive and > principal/months
        min_payment = principal / Decimal("240")
        assert monthly > min_payment
        assert total > principal
        assert interest > 0

    def test_total_equals_monthly_times_months(self) -> None:
        principal = Decimal("5000000")
        monthly, total, _ = monthly_mortgage_repayment(
            principal=principal,
            annual_interest_rate_pct=Decimal("15"),
            loan_term_years=10,
        )
        expected_total = monthly * Decimal("120")
        # Allow ₦1 rounding tolerance
        assert abs(total - expected_total) <= Decimal("1.00")

    def test_zero_interest_rate_divides_evenly(self) -> None:
        """At 0% interest, monthly payment = principal / n_months."""
        principal = Decimal("1200000")
        # We can't pass 0% because our validator rejects it,
        # but near-zero should give near-equal installments
        monthly, total, interest = monthly_mortgage_repayment(
            principal=principal,
            annual_interest_rate_pct=Decimal("0.01"),
            loan_term_years=10,
        )
        # Interest should be tiny — at 0.01% annual over 10 years it's under ₦700
        assert interest < Decimal("700")

    def test_short_term_higher_monthly_than_long_term(self) -> None:
        principal = Decimal("5000000")
        rate = Decimal("18")
        short_monthly, _, _ = monthly_mortgage_repayment(principal, rate, 5)
        long_monthly, _, _ = monthly_mortgage_repayment(principal, rate, 20)
        assert short_monthly > long_monthly

    def test_higher_rate_increases_total(self) -> None:
        principal = Decimal("5000000")
        years = 10
        _, total_low, _ = monthly_mortgage_repayment(principal, Decimal("10"), years)
        _, total_high, _ = monthly_mortgage_repayment(principal, Decimal("25"), years)
        assert total_high > total_low

    def test_invalid_principal_raises(self) -> None:
        with pytest.raises(ValueError):
            monthly_mortgage_repayment(Decimal("0"), Decimal("10"), 10)

    def test_invalid_rate_raises(self) -> None:
        with pytest.raises(ValueError):
            monthly_mortgage_repayment(Decimal("1000000"), Decimal("0"), 10)

    def test_invalid_term_raises(self) -> None:
        with pytest.raises(ValueError):
            monthly_mortgage_repayment(Decimal("1000000"), Decimal("10"), 0)

    def test_result_rounded_to_2_decimals(self) -> None:
        monthly, total, interest = monthly_mortgage_repayment(
            Decimal("3456789"), Decimal("17.5"), 15
        )
        assert str(monthly) == str(monthly.quantize(Decimal("0.01")))
        assert str(total) == str(total.quantize(Decimal("0.01")))


class TestFinancingCalculator:

    def test_financing_with_20pct_deposit(self) -> None:
        price = Decimal("5000000")
        monthly = financing_monthly_repayment(price, 20.0, 18.0, 5)
        assert monthly > 0
        # Principal = 4,000,000; over 60 months at 18% ~ 101,000/month
        assert Decimal("80000") < monthly < Decimal("150000")

    def test_full_deposit_returns_zero(self) -> None:
        price = Decimal("1000000")
        monthly = financing_monthly_repayment(price, 100.0, 18.0, 5)
        assert monthly == Decimal("0.00")

    def test_no_deposit_uses_full_price(self) -> None:
        price = Decimal("1000000")
        m_no_deposit = financing_monthly_repayment(price, 0.0, 18.0, 5)
        m_20_deposit = financing_monthly_repayment(price, 20.0, 18.0, 5)
        assert m_no_deposit > m_20_deposit


# ── Property test: total repayment >= principal (no negative interest) ─────────

class TestMortgageProperty:
    """
    Property: For any valid principal, rate, and term,
    total_repayment >= principal (you always pay back at least what you borrowed).
    """

    @given(
        principal=st.decimals(min_value=Decimal("10000"), max_value=Decimal("1000000000"), places=2),
        rate=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("99.99"), places=2),
        years=st.integers(min_value=1, max_value=30),
    )
    @h_settings(max_examples=100)
    def test_total_repayment_gte_principal(
        self, principal: Decimal, rate: Decimal, years: int
    ) -> None:
        monthly, total, interest = monthly_mortgage_repayment(principal, rate, years)
        assert total >= principal
        assert interest >= Decimal("0")
        assert monthly > Decimal("0")
