"""
Wallet Service repository — all database interactions.

Every function that modifies the wallet balance uses SELECT FOR UPDATE to
prevent concurrent race conditions.  Non-negativity is enforced here
(InsufficientFundsError) and again at the DB layer (CHECK constraints).

Locking order convention
------------------------
`transfer_wallet` always acquires wallet locks in ascending UUID order to
prevent deadlocks when two concurrent transfers involve the same pair of wallets.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import InsufficientFundsError, NotFoundError
from shared.logging import get_logger

from .models import Wallet, WalletTransaction

logger = get_logger(__name__)


# ── Wallet CRUD ───────────────────────────────────────────────────────────────

async def get_or_create_wallet(
    session: AsyncSession,
    user_id: uuid.UUID,
    currency: str = "NGN",
) -> Wallet:
    """
    Return the existing wallet for *user_id*, or create one if none exists.
    The new wallet is flushed (but not committed) so the caller controls
    transaction boundaries.
    """
    wallet = await get_wallet(session, user_id)
    if wallet is not None:
        return wallet

    wallet = Wallet(
        user_id=user_id,
        currency=currency,
        balance=Decimal("0.00"),
        held_balance=Decimal("0.00"),
        rewards_points=0,
        updated_at=datetime.now(tz=timezone.utc),
    )
    session.add(wallet)
    await session.flush()
    logger.info("wallet_created", user_id=str(user_id), currency=currency)
    return wallet


async def get_wallet(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> Wallet | None:
    """Return the wallet for *user_id*, or None if not found."""
    result = await session.execute(
        select(Wallet).where(Wallet.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _get_wallet_for_update(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> Wallet:
    """
    Lock the wallet row for the duration of the current transaction.
    Raises NotFoundError if the wallet does not exist.
    """
    result = await session.execute(
        select(Wallet).where(Wallet.user_id == user_id).with_for_update()
    )
    wallet = result.scalar_one_or_none()
    if wallet is None:
        raise NotFoundError(f"Wallet not found for user {user_id}")
    return wallet


# ── Balance-changing operations ───────────────────────────────────────────────

async def credit_wallet(
    session: AsyncSession,
    user_id: uuid.UUID,
    amount: Decimal,
    tx_type: str,
    reference_id: uuid.UUID | None = None,
    description: str | None = None,
    status: str = "completed",
) -> WalletTransaction:
    """
    Atomically increment the wallet balance and record a transaction.

    Uses SELECT FOR UPDATE to prevent concurrent updates from producing an
    inconsistent balance.  The transaction (session) is NOT committed here;
    the caller is responsible for commit/rollback.
    """
    if amount <= Decimal("0"):
        raise ValueError(f"Credit amount must be positive, got {amount}")

    wallet = await _get_wallet_for_update(session, user_id)
    new_balance = Decimal(str(wallet.balance)) + amount
    wallet.balance = new_balance
    wallet.updated_at = datetime.now(tz=timezone.utc)

    tx = WalletTransaction(
        id=uuid.uuid4(),
        wallet_user_id=user_id,
        type=tx_type,
        amount=amount,
        balance_after=new_balance,
        reference_id=reference_id,
        description=description,
        status=status,
        created_at=datetime.now(tz=timezone.utc),
    )
    session.add(tx)
    await session.flush()

    logger.info(
        "wallet_credited",
        user_id=str(user_id),
        amount=str(amount),
        tx_type=tx_type,
        balance_after=str(new_balance),
    )
    return tx


async def debit_wallet(
    session: AsyncSession,
    user_id: uuid.UUID,
    amount: Decimal,
    tx_type: str,
    reference_id: uuid.UUID | None = None,
    description: str | None = None,
    status: str = "completed",
) -> WalletTransaction:
    """
    Atomically decrement the wallet balance after verifying available funds.

    Available balance = balance - held_balance.
    Raises InsufficientFundsError if amount > available balance.
    Uses SELECT FOR UPDATE to prevent concurrent updates.
    """
    if amount <= Decimal("0"):
        raise ValueError(f"Debit amount must be positive, got {amount}")

    wallet = await _get_wallet_for_update(session, user_id)
    balance = Decimal(str(wallet.balance))
    held = Decimal(str(wallet.held_balance))
    available = balance - held

    if amount > available:
        raise InsufficientFundsError(
            f"Insufficient funds: requested {amount}, available {available} "
            f"(balance={balance}, held={held})"
        )

    new_balance = balance - amount
    wallet.balance = new_balance
    wallet.updated_at = datetime.now(tz=timezone.utc)

    tx = WalletTransaction(
        id=uuid.uuid4(),
        wallet_user_id=user_id,
        type=tx_type,
        amount=amount,
        balance_after=new_balance,
        reference_id=reference_id,
        description=description,
        status=status,
        created_at=datetime.now(tz=timezone.utc),
    )
    session.add(tx)
    await session.flush()

    logger.info(
        "wallet_debited",
        user_id=str(user_id),
        amount=str(amount),
        tx_type=tx_type,
        balance_after=str(new_balance),
    )
    return tx


async def transfer_wallet(
    session: AsyncSession,
    from_user_id: uuid.UUID,
    to_user_id: uuid.UUID,
    amount: Decimal,
    reference_id: uuid.UUID | None = None,
) -> tuple[WalletTransaction, WalletTransaction]:
    """
    Atomically debit *from_user_id* and credit *to_user_id*.

    Wallets are always locked in ascending UUID string order to prevent
    deadlocks when two concurrent transfers involve the same pair.
    Both wallets must exist before calling this function.
    """
    if from_user_id == to_user_id:
        raise ValueError("Cannot transfer to the same wallet")
    if amount <= Decimal("0"):
        raise ValueError(f"Transfer amount must be positive, got {amount}")

    # Determine lock order: always lock the lexicographically smaller UUID first
    first_id, second_id = (
        (from_user_id, to_user_id)
        if str(from_user_id) < str(to_user_id)
        else (to_user_id, from_user_id)
    )

    # Acquire locks in consistent order
    result_first = await session.execute(
        select(Wallet).where(Wallet.user_id == first_id).with_for_update()
    )
    wallet_first = result_first.scalar_one_or_none()
    if wallet_first is None:
        raise NotFoundError(f"Wallet not found for user {first_id}")

    result_second = await session.execute(
        select(Wallet).where(Wallet.user_id == second_id).with_for_update()
    )
    wallet_second = result_second.scalar_one_or_none()
    if wallet_second is None:
        raise NotFoundError(f"Wallet not found for user {second_id}")

    # Map back to sender/receiver
    sender_wallet = wallet_first if first_id == from_user_id else wallet_second
    receiver_wallet = wallet_first if first_id == to_user_id else wallet_second

    sender_balance = Decimal(str(sender_wallet.balance))
    sender_held = Decimal(str(sender_wallet.held_balance))
    available = sender_balance - sender_held

    if amount > available:
        raise InsufficientFundsError(
            f"Insufficient funds for transfer: requested {amount}, available {available}"
        )

    now = datetime.now(tz=timezone.utc)

    # Debit sender
    new_sender_balance = sender_balance - amount
    sender_wallet.balance = new_sender_balance
    sender_wallet.updated_at = now

    debit_tx = WalletTransaction(
        id=uuid.uuid4(),
        wallet_user_id=from_user_id,
        type="debit",
        amount=amount,
        balance_after=new_sender_balance,
        reference_id=reference_id,
        description=f"Transfer to {to_user_id}",
        status="completed",
        created_at=now,
    )
    session.add(debit_tx)

    # Credit receiver
    receiver_balance = Decimal(str(receiver_wallet.balance))
    new_receiver_balance = receiver_balance + amount
    receiver_wallet.balance = new_receiver_balance
    receiver_wallet.updated_at = now

    credit_tx = WalletTransaction(
        id=uuid.uuid4(),
        wallet_user_id=to_user_id,
        type="credit",
        amount=amount,
        balance_after=new_receiver_balance,
        reference_id=reference_id,
        description=f"Transfer from {from_user_id}",
        status="completed",
        created_at=now,
    )
    session.add(credit_tx)
    await session.flush()

    logger.info(
        "wallet_transfer",
        from_user_id=str(from_user_id),
        to_user_id=str(to_user_id),
        amount=str(amount),
    )
    return debit_tx, credit_tx


# ── Rewards points ─────────────────────────────────────────────────────────────

async def credit_rewards_points(
    session: AsyncSession,
    user_id: uuid.UUID,
    points: int,
    reference_id: uuid.UUID | None = None,
    description: str | None = None,
) -> WalletTransaction:
    """
    Add rewards points to the wallet and record a transaction entry.
    The 'amount' stored for a rewards_credit transaction equals the points value
    (treated as a Decimal so the ledger remains consistent).
    """
    if points <= 0:
        raise ValueError(f"Rewards points must be positive, got {points}")

    wallet = await _get_wallet_for_update(session, user_id)
    wallet.rewards_points = (wallet.rewards_points or 0) + points
    wallet.updated_at = datetime.now(tz=timezone.utc)

    tx = WalletTransaction(
        id=uuid.uuid4(),
        wallet_user_id=user_id,
        type="rewards_credit",
        amount=Decimal(str(points)),
        balance_after=Decimal(str(wallet.balance)),
        reference_id=reference_id,
        description=description or f"Rewards credit: +{points} points",
        status="completed",
        created_at=datetime.now(tz=timezone.utc),
    )
    session.add(tx)
    await session.flush()
    return tx


async def redeem_rewards_points(
    session: AsyncSession,
    user_id: uuid.UUID,
    points: int,
    credit_amount: Decimal,
    reference_id: uuid.UUID | None = None,
) -> tuple[WalletTransaction, WalletTransaction]:
    """
    Deduct *points* from rewards balance and credit *credit_amount* to wallet.
    Returns (rewards_tx, credit_tx).
    Raises InsufficientFundsError if points exceed current rewards balance.
    """
    if points <= 0:
        raise ValueError(f"Points to redeem must be positive, got {points}")

    wallet = await _get_wallet_for_update(session, user_id)
    current_points = wallet.rewards_points or 0

    if points > current_points:
        raise InsufficientFundsError(
            f"Insufficient rewards points: requested {points}, available {current_points}"
        )

    now = datetime.now(tz=timezone.utc)

    wallet.rewards_points = current_points - points
    new_balance = Decimal(str(wallet.balance)) + credit_amount
    wallet.balance = new_balance
    wallet.updated_at = now

    # Transaction recording rewards redemption (deduction from points)
    rewards_tx = WalletTransaction(
        id=uuid.uuid4(),
        wallet_user_id=user_id,
        type="rewards_redemption",
        amount=Decimal(str(points)),
        balance_after=new_balance,
        reference_id=reference_id,
        description=f"Rewards redemption: {points} points → {credit_amount} currency",
        status="completed",
        created_at=now,
    )
    session.add(rewards_tx)

    # Transaction recording the corresponding wallet credit
    credit_tx = WalletTransaction(
        id=uuid.uuid4(),
        wallet_user_id=user_id,
        type="credit",
        amount=credit_amount,
        balance_after=new_balance,
        reference_id=reference_id,
        description=f"Rewards redemption credit ({points} points)",
        status="completed",
        created_at=now,
    )
    session.add(credit_tx)
    await session.flush()

    logger.info(
        "rewards_redeemed",
        user_id=str(user_id),
        points=points,
        credit_amount=str(credit_amount),
    )
    return rewards_tx, credit_tx


# ── Query helpers ─────────────────────────────────────────────────────────────

async def get_transactions(
    session: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> list[WalletTransaction]:
    """Return a paginated list of transactions for *user_id*, newest first."""
    offset = (page - 1) * page_size
    result = await session.execute(
        select(WalletTransaction)
        .where(WalletTransaction.wallet_user_id == user_id)
        .order_by(WalletTransaction.created_at.desc())
        .limit(page_size)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_wallet_balance(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Return a balance summary dict including pending transaction count.
    Raises NotFoundError if the wallet does not exist.
    """
    wallet = await get_wallet(session, user_id)
    if wallet is None:
        raise NotFoundError(f"Wallet not found for user {user_id}")

    pending_result = await session.execute(
        select(func.count(WalletTransaction.id)).where(
            WalletTransaction.wallet_user_id == user_id,
            WalletTransaction.status == "processing",
        )
    )
    pending_count: int = pending_result.scalar_one()

    return {
        "balance": Decimal(str(wallet.balance)),
        "held_balance": Decimal(str(wallet.held_balance)),
        "rewards_points": wallet.rewards_points,
        "currency": wallet.currency,
        "pending_count": pending_count,
    }
