"""Wallet Service configuration."""
from __future__ import annotations

from functools import lru_cache

from shared.config import BaseServiceSettings


class WalletSettings(BaseServiceSettings):
    """Wallet-service-specific settings."""

    SERVICE_NAME: str = "wallet-service"

    # URL of the Payment Service for internal calls
    PAYMENT_SERVICE_URL: str = "http://payment-service:8000"

    # Cashback rates per subscription tier (fraction of order amount)
    CASHBACK_RATE_STARTER: float = 0.0
    CASHBACK_RATE_GROWTH: float = 0.01    # 1%
    CASHBACK_RATE_PRO: float = 0.02       # 2%
    CASHBACK_RATE_ENTERPRISE: float = 0.03  # 3%

    # Rewards redemption: 100 points = 1 currency unit
    REWARDS_REDEMPTION_RATE: float = 100.0

    @property
    def cashback_rates(self) -> dict[str, float]:
        """Return a mapping of tier name → cashback rate for convenience."""
        return {
            "starter": self.CASHBACK_RATE_STARTER,
            "growth": self.CASHBACK_RATE_GROWTH,
            "pro": self.CASHBACK_RATE_PRO,
            "enterprise": self.CASHBACK_RATE_ENTERPRISE,
        }


@lru_cache(maxsize=1)
def get_settings() -> WalletSettings:
    return WalletSettings()
