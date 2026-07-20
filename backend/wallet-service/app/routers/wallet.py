"""
Wallet Service HTTP routes — all wrapped in SuccessResponse envelope.
All routes use Authorization: Bearer JWT (not query params).
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import SuccessResponse, UnauthorizedError
from shared.jwt_utils import verify_token
from shared.logging import get_logger

from ..config import WalletSettings, get_settings
from ..schemas import (
    BalanceResponse,
    CreditWalletRequest,
    RedeemPointsRequest,
    TopUpRequest,
    TransactionResponse,
    TransferRequest,
    WithdrawRequest,
)
from ..service import WalletService

logger = get_logger(__name__)
router = APIRouter(tags=["Wallet"])
_bearer = HTTPBearer(auto_error=False)


# ── Dependencies ──────────────────────────────────────────────────────────────

def _settings() -> WalletSettings:
    return get_settings()


async def _get_session(request: Request) -> AsyncSession:  # type: ignore[return]
    session = request.app.state.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


def _get_user_id(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[WalletSettings, Depends(_settings)],
) -> uuid.UUID:
    if creds is None:
        raise UnauthorizedError("Bearer token required.")
    payload = verify_token(settings.JWT_PUBLIC_KEY_PATH, creds.credentials)
    return uuid.UUID(payload["sub"])


def _build_svc(
    session: Annotated[AsyncSession, Depends(_get_session)],
    settings: Annotated[WalletSettings, Depends(_settings)],
) -> WalletService:
    return WalletService(session, settings)


# ── Balance ───────────────────────────────────────────────────────────────────

@router.get(
    "/wallet/balance",
    response_model=SuccessResponse,
    summary="Get wallet balance, held funds, and rewards points",
)
async def get_balance(
    user_id: Annotated[uuid.UUID, Depends(_get_user_id)],
    svc: Annotated[WalletService, Depends(_build_svc)],
) -> SuccessResponse:
    result = await svc.get_balance(user_id)
    return SuccessResponse(
        message="Balance retrieved successfully.",
        data=result.model_dump(),
    )


# ── Top-up ────────────────────────────────────────────────────────────────────

@router.post(
    "/wallet/topup",
    response_model=SuccessResponse,
    status_code=201,
    summary="Credit wallet from a confirmed external payment",
)
async def top_up(
    body: TopUpRequest,
    user_id: Annotated[uuid.UUID, Depends(_get_user_id)],
    svc: Annotated[WalletService, Depends(_build_svc)],
) -> SuccessResponse:
    result = await svc.top_up(user_id, body)
    return SuccessResponse(
        message="Wallet credited successfully.",
        data=result.model_dump(),
    )


# ── Withdraw ──────────────────────────────────────────────────────────────────

@router.post(
    "/wallet/withdraw",
    response_model=SuccessResponse,
    summary="Initiate a withdrawal to a bank account",
)
async def withdraw(
    body: WithdrawRequest,
    user_id: Annotated[uuid.UUID, Depends(_get_user_id)],
    svc: Annotated[WalletService, Depends(_build_svc)],
) -> SuccessResponse:
    result = await svc.withdraw(user_id, body)
    return SuccessResponse(
        message="Withdrawal initiated. Status: processing.",
        data=result.model_dump(),
    )


# ── Transfer ──────────────────────────────────────────────────────────────────

@router.post(
    "/wallet/transfer",
    response_model=SuccessResponse,
    summary="Transfer funds to another user's wallet",
)
async def transfer(
    body: TransferRequest,
    user_id: Annotated[uuid.UUID, Depends(_get_user_id)],
    svc: Annotated[WalletService, Depends(_build_svc)],
) -> SuccessResponse:
    result = await svc.transfer(user_id, body)
    return SuccessResponse(
        message="Transfer completed successfully.",
        data=result.model_dump(),
    )


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get(
    "/wallet/transactions",
    response_model=SuccessResponse,
    summary="Paginated transaction history for authenticated user",
)
async def list_transactions(
    user_id: Annotated[uuid.UUID, Depends(_get_user_id)],
    svc: Annotated[WalletService, Depends(_build_svc)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    results = await svc.list_transactions(user_id, page=page)
    from shared.errors import paginated_meta
    return SuccessResponse(
        message="Transactions retrieved.",
        data=[r.model_dump() for r in results],
        meta=paginated_meta(page, page_size, total=len(results)),
    )


# ── Rewards ───────────────────────────────────────────────────────────────────

@router.get(
    "/wallet/rewards",
    response_model=SuccessResponse,
    summary="Get rewards points balance",
)
async def get_rewards(
    user_id: Annotated[uuid.UUID, Depends(_get_user_id)],
    svc: Annotated[WalletService, Depends(_build_svc)],
) -> SuccessResponse:
    result = await svc.get_balance(user_id)
    return SuccessResponse(
        message="Rewards balance retrieved.",
        data={"rewards_points": result.rewards_points, "currency": result.currency},
    )


@router.post(
    "/wallet/rewards/redeem",
    response_model=SuccessResponse,
    summary="Redeem rewards points for wallet credit",
)
async def redeem_rewards(
    body: RedeemPointsRequest,
    user_id: Annotated[uuid.UUID, Depends(_get_user_id)],
    svc: Annotated[WalletService, Depends(_build_svc)],
) -> SuccessResponse:
    result = await svc.redeem_points(user_id, body)
    return SuccessResponse(
        message=f"{body.points} rewards points redeemed successfully.",
        data=result.model_dump(),
    )


# ── Internal (no JWT — network-policy protected) ──────────────────────────────

@router.post(
    "/internal/wallet/credit",
    response_model=SuccessResponse,
    status_code=200,
    include_in_schema=False,
)
async def internal_credit(
    body: CreditWalletRequest,
    svc: Annotated[WalletService, Depends(_build_svc)],
) -> SuccessResponse:
    result = await svc.internal_credit(body)
    return SuccessResponse(
        message="Wallet credited.",
        data=result.model_dump(),
    )
