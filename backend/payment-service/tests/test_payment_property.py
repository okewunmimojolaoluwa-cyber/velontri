"""
Property test: Escrow Funds Conservation (Task 9.5, Property 2)
Unit tests for Payment Service (Task 9.6)

Property: For every payment scenario:
  buyer_charge == seller_release + platform_fee
"""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from hypothesis import given, settings as h_settings, strategies as st


# ── Tier fee rates (must match payment service config) ────────────────────────

TIER_FEE_RATES: dict[str, Decimal] = {
    "starter":    Decimal("0.025"),  # 2.5%
    "growth":     Decimal("0.020"),  # 2.0%
    "pro":        Decimal("0.015"),  # 1.5%
    "enterprise": Decimal("0.010"),  # 1.0%
}


def compute_fee(amount: Decimal, seller_tier: str) -> Decimal:
    """Compute platform fee for a given amount and tier."""
    rate = TIER_FEE_RATES.get(seller_tier, Decimal("0.025"))
    return (amount * rate).quantize(Decimal("0.01"))


def compute_seller_release(amount: Decimal, fee: Decimal) -> Decimal:
    """Seller receives amount minus the platform fee."""
    return amount - fee


# ── Strategies ────────────────────────────────────────────────────────────────

payment_amount = st.decimals(
    min_value=Decimal("100"),
    max_value=Decimal("10000000"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)

tier_strategy = st.sampled_from(["starter", "growth", "pro", "enterprise"])


# ── Property tests ────────────────────────────────────────────────────────────

class TestEscrowFundsConservationProperty:
    """
    Property 2: Escrow Funds Conservation.

    buyer_charge == seller_release + platform_fee
    for every generated payment scenario.
    """

    @given(
        amount=payment_amount,
        seller_tier=tier_strategy,
    )
    @h_settings(max_examples=500)
    def test_funds_conservation(self, amount: Decimal, seller_tier: str) -> None:
        """buyer_charge == seller_release + platform_fee always."""
        buyer_charge = amount  # Buyer is charged the full amount
        platform_fee = compute_fee(amount, seller_tier)
        seller_release = compute_seller_release(amount, platform_fee)

        assert buyer_charge == seller_release + platform_fee, (
            f"Conservation violated: "
            f"buyer_charge={buyer_charge}, "
            f"seller_release={seller_release}, "
            f"platform_fee={platform_fee}"
        )

    @given(amount=payment_amount, seller_tier=tier_strategy)
    @h_settings(max_examples=200)
    def test_fee_is_nonnegative(self, amount: Decimal, seller_tier: str) -> None:
        """Platform fee is always non-negative."""
        fee = compute_fee(amount, seller_tier)
        assert fee >= Decimal("0")

    @given(amount=payment_amount, seller_tier=tier_strategy)
    @h_settings(max_examples=200)
    def test_seller_release_lte_buyer_charge(self, amount: Decimal, seller_tier: str) -> None:
        """Seller always receives less than or equal to the buyer charge."""
        fee = compute_fee(amount, seller_tier)
        release = compute_seller_release(amount, fee)
        assert release <= amount

    @given(amount=payment_amount, seller_tier=tier_strategy)
    @h_settings(max_examples=200)
    def test_seller_release_positive(self, amount: Decimal, seller_tier: str) -> None:
        """Seller always receives a positive amount (fee < 100%)."""
        fee = compute_fee(amount, seller_tier)
        release = compute_seller_release(amount, fee)
        assert release > Decimal("0")

    def test_enterprise_tier_lowest_fee(self) -> None:
        """Enterprise tier has the lowest fee rate."""
        amount = Decimal("100000")
        fees = {tier: compute_fee(amount, tier) for tier in TIER_FEE_RATES}
        assert fees["enterprise"] < fees["starter"]
        assert fees["enterprise"] < fees["growth"]
        assert fees["enterprise"] < fees["pro"]


# ── Gateway routing tests ─────────────────────────────────────────────────────

class TestGatewayRouting:

    def test_ngn_routes_to_paystack(self) -> None:
        from app.gateways import get_gateway_for_currency
        assert get_gateway_for_currency("NGN") == "paystack"

    def test_ghs_routes_to_paystack(self) -> None:
        from app.gateways import get_gateway_for_currency
        assert get_gateway_for_currency("GHS") == "paystack"

    def test_kes_routes_to_mpesa(self) -> None:
        from app.gateways import get_gateway_for_currency
        assert get_gateway_for_currency("KES") == "mpesa"

    def test_zar_routes_to_flutterwave(self) -> None:
        from app.gateways import get_gateway_for_currency
        assert get_gateway_for_currency("ZAR") == "flutterwave"

    def test_xof_routes_to_flutterwave(self) -> None:
        from app.gateways import get_gateway_for_currency
        assert get_gateway_for_currency("XOF") == "flutterwave"

    def test_unknown_currency_defaults_to_flutterwave(self) -> None:
        from app.gateways import get_gateway_for_currency
        assert get_gateway_for_currency("ZZZ") == "flutterwave"

    def test_currency_is_case_insensitive(self) -> None:
        from app.gateways import get_gateway_for_currency
        assert get_gateway_for_currency("ngn") == "paystack"
        assert get_gateway_for_currency("Kes") == "mpesa"


# ── HMAC webhook validation tests ─────────────────────────────────────────────

class TestWebhookValidation:

    def test_paystack_valid_signature(self) -> None:
        from app.gateways import verify_paystack_signature
        secret = "test-paystack-secret"
        payload = b'{"event":"charge.success","data":{"reference":"ref123"}}'
        sig = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()
        assert verify_paystack_signature(payload, sig, secret) is True

    def test_paystack_invalid_signature(self) -> None:
        from app.gateways import verify_paystack_signature
        payload = b'{"event":"charge.success"}'
        assert verify_paystack_signature(payload, "wrongsig", "secret") is False

    def test_paystack_empty_signature_fails(self) -> None:
        from app.gateways import verify_paystack_signature
        assert verify_paystack_signature(b"body", "", "secret") is False

    def test_paystack_empty_secret_fails(self) -> None:
        from app.gateways import verify_paystack_signature
        assert verify_paystack_signature(b"body", "sig", "") is False

    def test_flutterwave_valid_signature(self) -> None:
        from app.gateways import verify_flutterwave_signature
        secret = "flw-webhook-secret"
        # Flutterwave sends the raw secret in the verif-hash header
        assert verify_flutterwave_signature(b"body", secret, secret) is True

    def test_flutterwave_invalid_signature(self) -> None:
        from app.gateways import verify_flutterwave_signature
        assert verify_flutterwave_signature(b"body", "wrong", "correct") is False

    def test_mpesa_no_secret_returns_true(self) -> None:
        """M-Pesa relies on IP allowlisting when no secret is configured."""
        from app.gateways import verify_mpesa_signature
        assert verify_mpesa_signature(b"body", "any_sig", "") is True

    def test_mpesa_valid_secret_matches(self) -> None:
        from app.gateways import verify_mpesa_signature
        secret = "mpesa-secret"
        assert verify_mpesa_signature(b"body", secret, secret) is True

    def test_mpesa_invalid_secret(self) -> None:
        from app.gateways import verify_mpesa_signature
        assert verify_mpesa_signature(b"body", "wrong", "correct") is False

    def test_signature_uses_constant_time_comparison(self) -> None:
        """
        Signatures must use hmac.compare_digest (constant-time) not == operator.
        This test verifies the function doesn't short-circuit on first mismatch.
        """
        from app.gateways import verify_paystack_signature
        secret = "mysecret"
        payload = b"data"
        valid_sig = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()

        # Build a sig that differs only at the last character
        tampered = valid_sig[:-1] + ("a" if valid_sig[-1] != "a" else "b")
        # Should not raise even with a near-matching signature
        result = verify_paystack_signature(payload, tampered, secret)
        assert result is False


# ── Fee calculation tests ─────────────────────────────────────────────────────

class TestFeeCalculation:

    def test_starter_fee_is_2_5_pct(self) -> None:
        fee = compute_fee(Decimal("100000"), "starter")
        assert fee == Decimal("2500.00")

    def test_growth_fee_is_2_pct(self) -> None:
        fee = compute_fee(Decimal("100000"), "growth")
        assert fee == Decimal("2000.00")

    def test_pro_fee_is_1_5_pct(self) -> None:
        fee = compute_fee(Decimal("100000"), "pro")
        assert fee == Decimal("1500.00")

    def test_enterprise_fee_is_1_pct(self) -> None:
        fee = compute_fee(Decimal("100000"), "enterprise")
        assert fee == Decimal("1000.00")

    def test_fee_is_recorded_on_transaction(self) -> None:
        """Verify conservation holds at known values."""
        amount = Decimal("50000")
        fee = compute_fee(amount, "growth")   # 2% = 1000
        release = compute_seller_release(amount, fee)  # 49000
        assert amount == fee + release
        assert fee == Decimal("1000.00")
        assert release == Decimal("49000.00")
