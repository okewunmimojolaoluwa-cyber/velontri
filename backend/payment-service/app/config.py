"""Payment Service configuration."""
from __future__ import annotations

from functools import lru_cache

from shared.config import BaseServiceSettings


class PaymentSettings(BaseServiceSettings):
    SERVICE_NAME: str = "payment-service"

    # ── Payment gateway credentials ───────────────────────────────────────────
    PAYSTACK_SECRET_KEY: str = ""
    FLUTTERWAVE_SECRET_KEY: str = ""
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""

    # ── Internal service URLs ─────────────────────────────────────────────────
    WALLET_SERVICE_URL: str = "http://wallet-service:8000"

    # ── Fraud scoring ─────────────────────────────────────────────────────────
    # Transactions scoring above this threshold are rejected
    FRAUD_SCORE_THRESHOLD: float = 0.75

    # ── Escrow auto-release ───────────────────────────────────────────────────
    # Hours after escrow hold before funds auto-release to seller
    ESCROW_AUTO_RELEASE_HOURS: int = 72

    # ── Platform transaction fee rates by seller subscription tier ────────────
    FEE_RATE_STARTER: float = 0.025      # 2.5%
    FEE_RATE_GROWTH: float = 0.020       # 2.0%
    FEE_RATE_PRO: float = 0.015          # 1.5%
    FEE_RATE_ENTERPRISE: float = 0.010   # 1.0%

    def get_fee_rate(self, tier: str) -> float:
        """Return the fee rate for the given seller subscription tier."""
        mapping: dict[str, float] = {
            "starter": self.FEE_RATE_STARTER,
            "growth": self.FEE_RATE_GROWTH,
            "pro": self.FEE_RATE_PRO,
            "enterprise": self.FEE_RATE_ENTERPRISE,
        }
        # Unknown tiers fall back to the highest (starter) rate
        return mapping.get(tier.lower(), self.FEE_RATE_STARTER)


@lru_cache(maxsize=1)
def get_settings() -> PaymentSettings:
    return PaymentSettings()
