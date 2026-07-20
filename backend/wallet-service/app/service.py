"""
Wallet Service business logic.

All public methods are thin orchestration layers that coordinate repository
calls, external HTTP calls, and event publishing.  They never touch raw SQL.
"""
from __future__ import annotations

import math
import uuid
from decimal import Decimal

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from shared.errors import ExternalServiceError, InsufficientFundsError, NotFoundError
from shared.logging import get_logger

from .config import WalletSettings
from .repository import (
    credit_wallet,
    debit_wallet,
    get_or_create_wallet,
    get_wallet,
    get_transactions as list_transactions,
    redeem_rewards_points,
    credit_rewards_points as update_rewards_points,
    transfer_wallet as atomic_transfer,
)
from .schemas import (
    BalanceResponse,
    CreditWalletRequest,
    RedeemPointsRequest,
    TopUpRequest,
    TransactionResponse,
    TransferRequest,
    WithdrawRequest,
)

logger = get_logger(__name__)

_TIER_CASHBACK: dict[str, str] = {
    "starter": "CASHBACK_STARTER",
    "growth": "CASHBACK_GROWTH",
    "pro": "CASHBACK_PRO",
    "enterprise": "CASHBACK_ENTERPRISE",
}


def _txn_to_response(txn) -> TransactionResponse:  # type: ignore[no-untyped-def]
    return TransactionResponse(
        id=txn.id,
        type=txn.type,
        amount=Decimal(str(txn.amount)),
        balance_after=Decimal(str(txn.balance_after)),
        description=txn.description,
        status=txn.status,
        created_at=txn.created_at,
    )


class WalletService:
    def __init__(
        self,
        session: AsyncSession,
        settings: WalletSettings,
    ) -> None:
        self._session = session
        self._settings = settings

    # â”€â”€ Balance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def get_balance(self, user_id: uuid.UUID) -> BalanceResponse:
        wallet = await get_or_create_wallet(self._session, user_id)
        balance = Decimal(str(wallet.balance))
        held = Decimal(str(wallet.held_balance))
        return BalanceResponse(
            user_id=wallet.user_id,
            currency=wallet.currency,
            balance=balance,
            held_balance=held,
            available_balance=balance - held,
            rewards_points=wallet.rewards_points,
        )

    # â”€â”€ Top-up â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def top_up(
        self, user_id: uuid.UUID, body: TopUpRequest
    ) -> TransactionResponse:
        """
        Credit the wallet with *amount*.  The caller (Payment Service) has
        already confirmed the payment â€” no event is emitted here.
        """
        await get_or_create_wallet(self._session, user_id, body.currency)
        txn = await credit_wallet(
            self._session,
            user_id=user_id,
            amount=body.amount,
            tx_type="credit",
            description=f"Top-up via payment reference {body.payment_reference}",
        )
        return _txn_to_response(txn)

    # â”€â”€ Withdraw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def withdraw(
        self, user_id: uuid.UUID, body: WithdrawRequest
    ) -> TransactionResponse:
        """
        1. Debit wallet (balance check inside debit_wallet).
        2. Call payout gateway stub.
        3. If gateway fails, reverse debit and surface ExternalServiceError.
        """
        txn = await debit_wallet(
            self._session,
            user_id=user_id,
            amount=body.amount,
            tx_type="debit",
            description=(
                f"Withdrawal to bank {body.bank_code}/{body.bank_account_number}"
            ),
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "http://payout-gateway/api/v1/payout",
                    json={
                        "amount": str(body.amount),
                        "bank_account_number": body.bank_account_number,
                        "bank_code": body.bank_code,
                        "reference": str(txn.id),
                    },
                )
                resp.raise_for_status()
        except Exception as exc:
            logger.warning(
                "payout_gateway_failed_reversing_debit",
                user_id=str(user_id),
                txn_id=str(txn.id),
                error=str(exc),
            )
            # Reverse the debit
            await credit_wallet(
                self._session,
                user_id=user_id,
                amount=body.amount,
                tx_type="credit",
                reference_id=txn.id,
                description="Reversal of failed withdrawal",
            )
            raise ExternalServiceError(
                "Payout gateway unavailable. Withdrawal reversed."
            ) from exc

        return _txn_to_response(txn)

    # â”€â”€ Transfer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def transfer(
        self, sender_id: uuid.UUID, body: TransferRequest
    ) -> TransactionResponse:
        debit_txn, _ = await atomic_transfer(
            self._session,
            sender_id=sender_id,
            recipient_id=body.recipient_user_id,
            amount=body.amount,
            description=body.description,
        )
        return _txn_to_response(debit_txn)

    # â”€â”€ Rewards redemption â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def redeem_points(
        self, user_id: uuid.UUID, body: RedeemPointsRequest
    ) -> TransactionResponse:
        """
        1. Check rewards_points >= requested points.
        2. Calculate credit = points Ã— REWARDS_REDEMPTION_RATE.
        3. Deduct points and credit wallet atomically.
        """
        wallet = await get_wallet(self._session, user_id)
        if wallet is None:
            raise NotFoundError(f"Wallet not found for user {user_id}")
        if wallet.rewards_points < body.points:
            raise InsufficientFundsError(
                f"Insufficient rewards points: have {wallet.rewards_points}, "
                f"need {body.points}"
            )

        credit_amount = Decimal(str(body.points)) * Decimal(
            str(self._settings.REWARDS_REDEMPTION_RATE)
        )

        await update_rewards_points(
            self._session, user_id, points_delta=-body.points
        )
        txn = await credit_wallet(
            self._session,
            user_id=user_id,
            amount=credit_amount,
            tx_type="rewards_redemption",
            description=f"Redemption of {body.points} rewards points",
        )
        return _txn_to_response(txn)

    # â”€â”€ Transactions list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def list_transactions(
        self, user_id: uuid.UUID, page: int = 1
    ) -> list[TransactionResponse]:
        txns = await list_transactions(self._session, user_id, page=page)
        return [_txn_to_response(t) for t in txns]

    # â”€â”€ Internal credit (called by Payment Service) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def internal_credit(
        self, body: CreditWalletRequest
    ) -> TransactionResponse:
        await get_or_create_wallet(self._session, body.user_id, body.currency)
        txn = await credit_wallet(
            self._session,
            user_id=body.user_id,
            amount=body.amount,
            tx_type=getattr(body, "transaction_type", "credit"),
            reference_id=body.reference_id,
            description=body.description,
        )
        return _txn_to_response(txn)

    # â”€â”€ Event handler: order.completed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def handle_order_completed(self, payload: dict) -> None:
        """
        Triggered when an order reaches the 'completed' state.

        1. Credit seller wallet (escrow release).
        2. Grant cashback to buyer based on seller's subscription tier.
        3. Accumulate rewards points for buyer.
        """
        buyer_id = uuid.UUID(payload["buyer_id"])
        seller_id = uuid.UUID(payload["seller_id"])
        amount = Decimal(str(payload["amount"]))
        currency: str = payload["currency"]
        order_id = uuid.UUID(payload["order_id"])
        seller_tier: str = payload.get("seller_subscription_tier", "starter").lower()

        # 1. Credit seller (escrow release)
        await get_or_create_wallet(self._session, seller_id, currency)
        await credit_wallet(
            self._session,
            user_id=seller_id,
            amount=amount,
            tx_type="credit",
            reference_id=order_id,
            description=f"Escrow release for order {order_id}",
        )

        # 2. Cashback for buyer
        cashback_attr = _TIER_CASHBACK.get(seller_tier, "CASHBACK_STARTER")
        cashback_rate = Decimal(
            str(getattr(self._settings, cashback_attr, 0.0))
        )
        if cashback_rate > 0:
            cashback_amount = (amount * cashback_rate / Decimal("100")).quantize(
                Decimal("0.01")
            )
            if cashback_amount > 0:
                await get_or_create_wallet(self._session, buyer_id, currency)
                await credit_wallet(
                    self._session,
                    user_id=buyer_id,
                    amount=cashback_amount,
                    tx_type="cashback",
                    reference_id=order_id,
                    description=f"Cashback {cashback_rate}% on order {order_id}",
                )

        # 3. Rewards points for buyer
        points_per_1000 = self._settings.REWARDS_POINTS_PER_1000
        points_earned = math.floor(float(amount) / 1000) * points_per_1000
        if points_earned > 0:
            # Ensure buyer wallet exists (may have been created above already)
            await get_or_create_wallet(self._session, buyer_id, currency)
            await update_rewards_points(
                self._session, buyer_id, points_delta=points_earned
            )

        logger.info(
            "order_completed_processed",
            order_id=str(order_id),
            seller_id=str(seller_id),
            buyer_id=str(buyer_id),
            amount=str(amount),
            cashback_rate=str(cashback_rate),
            points_earned=points_earned,
        )

    # â”€â”€ Event handler: payment.escrow_release â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async def handle_escrow_release(self, payload: dict) -> None:
        """
        Triggered when payment escrow is explicitly released (e.g. after dispute
        resolution or manual admin action).

        Credits the seller wallet with the escrowed amount.
        """
        seller_id = uuid.UUID(payload["seller_id"])
        amount = Decimal(str(payload["amount"]))
        currency: str = payload["currency"]
        reference_id = uuid.UUID(payload["reference_id"])

        await get_or_create_wallet(self._session, seller_id, currency)
        await credit_wallet(
            self._session,
            user_id=seller_id,
            amount=amount,
            tx_type="credit",
            reference_id=reference_id,
            description=f"Escrow release ref {reference_id}",
        )
        logger.info(
            "escrow_release_processed",
            seller_id=str(seller_id),
            amount=str(amount),
            reference_id=str(reference_id),
        )
