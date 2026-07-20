"""
Pure financial calculators for the Marketplace Service.

These are pure functions with no I/O — easy to test exhaustively.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal


def monthly_mortgage_repayment(
    principal: Decimal,
    annual_interest_rate_pct: Decimal,
    loan_term_years: int,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Calculate monthly mortgage repayment using the standard amortisation formula:
        M = P * r(1+r)^n / ((1+r)^n - 1)

    Where:
        P = principal (loan amount = price - deposit)
        r = monthly interest rate = annual_rate / 12 / 100
        n = total number of monthly payments = years * 12

    Returns (monthly_repayment, total_repayment, total_interest)
    All values rounded to 2 decimal places.

    Raises ValueError for invalid inputs.
    """
    if principal <= 0:
        raise ValueError("principal must be positive")
    if annual_interest_rate_pct <= 0 or annual_interest_rate_pct > 100:
        raise ValueError("annual_interest_rate_pct must be between 0 and 100")
    if loan_term_years <= 0:
        raise ValueError("loan_term_years must be positive")

    monthly_rate = annual_interest_rate_pct / Decimal("12") / Decimal("100")
    n = Decimal(str(loan_term_years * 12))

    if monthly_rate == 0:
        monthly = (principal / n).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        factor = (1 + monthly_rate) ** int(n)
        monthly = (principal * monthly_rate * factor / (factor - 1)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    total = (monthly * n).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    interest = (total - principal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return monthly, total, interest


def financing_monthly_repayment(
    listing_price: Decimal,
    deposit_pct: float,
    annual_interest_rate_pct: float,
    loan_term_years: int = 5,
) -> Decimal:
    """
    Estimate monthly vehicle financing repayment.
    Returns 0 if deposit_pct >= 100.
    """
    deposit = listing_price * Decimal(str(deposit_pct)) / Decimal("100")
    principal = listing_price - deposit
    if principal <= 0:
        return Decimal("0.00")

    monthly, _, _ = monthly_mortgage_repayment(
        principal=principal,
        annual_interest_rate_pct=Decimal(str(annual_interest_rate_pct)),
        loan_term_years=loan_term_years,
    )
    return monthly
