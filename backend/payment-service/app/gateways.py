"""
Payment gateway client implementations.

Each gateway function makes a real HTTP call to the sandbox/live endpoint.
All functions:
- Timeout at 10 seconds
- Never raise — catch all exceptions and return GatewayResult(success=False)
- Return a GatewayResult dataclass

HMAC webhook validation functions use hmac.compare_digest for constant-time
comparison to prevent timing attacks.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

import httpx

from shared.logging import get_logger

logger = get_logger(__name__)

# ── Gateway sandbox URLs ──────────────────────────────────────────────────────

_PAYSTACK_BASE_URL = "https://api.paystack.co"
_FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3"
_MPESA_AUTH_URL = "https://sandbox.safaricom.co.ke/oauth/v1/generate"
_MPESA_STK_URL = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"

_GATEWAY_TIMEOUT = 10.0  # seconds

# ── Currency → gateway routing ────────────────────────────────────────────────

CURRENCY_GATEWAY_MAP: dict[str, str] = {
    "NGN": "paystack",
    "GHS": "paystack",
    "KES": "mpesa",
    "ZAR": "flutterwave",
    "XOF": "flutterwave",
    # Additional currencies default to flutterwave (widest coverage)
    "USD": "flutterwave",
    "EUR": "flutterwave",
    "GBP": "flutterwave",
    "ZMW": "flutterwave",
    "TZS": "flutterwave",
    "UGX": "flutterwave",
    "RWF": "flutterwave",
    "ETB": "flutterwave",
    "EGP": "flutterwave",
    "MAD": "flutterwave",
    "TND": "flutterwave",
    "XAF": "flutterwave",
}


def get_gateway_for_currency(currency: str) -> str:
    """
    Return the preferred gateway for the given ISO-4217 currency code.
    Defaults to flutterwave for unknown currencies.
    """
    return CURRENCY_GATEWAY_MAP.get(currency.upper(), "flutterwave")


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class GatewayResult:
    """Normalised result from any payment gateway call."""

    success: bool
    gateway_ref: str | None = None
    error: str | None = None
    raw_response: dict[str, Any] = field(default_factory=dict)


# ── Paystack ──────────────────────────────────────────────────────────────────

async def charge_paystack(
    amount: Decimal,
    currency: str,
    email: str,
    metadata: dict[str, Any],
    secret_key: str,
) -> GatewayResult:
    """
    Initiate a Paystack charge.

    Uses the Paystack Transaction Initialise endpoint.
    Amount is sent in the smallest currency unit (kobo for NGN, pesewas for GHS).
    """
    # Paystack expects amount in smallest denomination
    amount_minor = int(amount * 100)

    payload = {
        "email": email,
        "amount": amount_minor,
        "currency": currency.upper(),
        "metadata": metadata,
        "callback_url": "https://velontri.com/payment/callback",
    }

    try:
        async with httpx.AsyncClient(timeout=_GATEWAY_TIMEOUT) as client:
            response = await client.post(
                f"{_PAYSTACK_BASE_URL}/transaction/initialize",
                json=payload,
                headers={
                    "Authorization": f"Bearer {secret_key}",
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                },
            )
            data = response.json()

            if response.status_code == 200 and data.get("status") is True:
                ref = data.get("data", {}).get("reference")
                logger.info(
                    "paystack_charge_initiated",
                    reference=ref,
                    currency=currency,
                )
                return GatewayResult(
                    success=True,
                    gateway_ref=ref,
                    raw_response=data,
                )
            else:
                error_msg = data.get("message", "Paystack charge failed")
                logger.warning(
                    "paystack_charge_failed",
                    status_code=response.status_code,
                    message=error_msg,
                )
                return GatewayResult(success=False, error=error_msg, raw_response=data)

    except httpx.TimeoutException:
        logger.error("paystack_timeout", currency=currency)
        return GatewayResult(success=False, error="Paystack request timed out")
    except Exception as exc:
        logger.error("paystack_unexpected_error", error=str(exc), exc_info=True)
        return GatewayResult(success=False, error=f"Unexpected error: {exc}")


# ── Flutterwave ───────────────────────────────────────────────────────────────

async def charge_flutterwave(
    amount: Decimal,
    currency: str,
    email: str,
    metadata: dict[str, Any],
    secret_key: str,
) -> GatewayResult:
    """
    Initiate a Flutterwave charge via the Standard payment link endpoint.
    """
    tx_ref = metadata.get("order_id", str(amount))

    payload = {
        "tx_ref": str(tx_ref),
        "amount": float(amount),
        "currency": currency.upper(),
        "payment_options": "card,account,banktransfer,mpesa,mobilemoneyrwanda",
        "redirect_url": "https://velontri.com/payment/callback",
        "customer": {
            "email": email,
            "name": metadata.get("buyer_name", "Velontri Customer"),
        },
        "customizations": {
            "title": "Velontri Payment",
            "logo": "https://velontri.com/logo.png",
        },
        "meta": metadata,
    }

    try:
        async with httpx.AsyncClient(timeout=_GATEWAY_TIMEOUT) as client:
            response = await client.post(
                f"{_FLUTTERWAVE_BASE_URL}/payments",
                json=payload,
                headers={
                    "Authorization": f"Bearer {secret_key}",
                    "Content-Type": "application/json",
                },
            )
            data = response.json()

            if response.status_code == 200 and data.get("status") == "success":
                ref = data.get("data", {}).get("link") or str(tx_ref)
                logger.info(
                    "flutterwave_charge_initiated",
                    tx_ref=tx_ref,
                    currency=currency,
                )
                return GatewayResult(
                    success=True,
                    gateway_ref=str(tx_ref),
                    raw_response=data,
                )
            else:
                error_msg = data.get("message", "Flutterwave charge failed")
                logger.warning(
                    "flutterwave_charge_failed",
                    status_code=response.status_code,
                    message=error_msg,
                )
                return GatewayResult(success=False, error=error_msg, raw_response=data)

    except httpx.TimeoutException:
        logger.error("flutterwave_timeout", currency=currency)
        return GatewayResult(success=False, error="Flutterwave request timed out")
    except Exception as exc:
        logger.error("flutterwave_unexpected_error", error=str(exc), exc_info=True)
        return GatewayResult(success=False, error=f"Unexpected error: {exc}")


# ── M-Pesa ────────────────────────────────────────────────────────────────────

async def _mpesa_get_access_token(
    consumer_key: str,
    consumer_secret: str,
) -> str | None:
    """Obtain a short-lived M-Pesa OAuth2 access token."""
    try:
        async with httpx.AsyncClient(timeout=_GATEWAY_TIMEOUT) as client:
            response = await client.get(
                _MPESA_AUTH_URL,
                params={"grant_type": "client_credentials"},
                auth=(consumer_key, consumer_secret),
            )
            if response.status_code == 200:
                return response.json().get("access_token")
            return None
    except Exception:
        return None


async def charge_mpesa(
    amount: Decimal,
    phone: str,
    metadata: dict[str, Any],
    consumer_key: str,
    consumer_secret: str,
) -> GatewayResult:
    """
    Initiate an M-Pesa STK Push (Lipa Na M-Pesa Online).

    Phone number should be in international format: 254XXXXXXXXX.
    """
    import base64
    from datetime import datetime

    access_token = await _mpesa_get_access_token(consumer_key, consumer_secret)
    if not access_token:
        return GatewayResult(
            success=False,
            error="Failed to obtain M-Pesa access token",
        )

    # Business shortcode (sandbox)
    business_short_code = "174379"
    passkey = (
        "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
    )
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(
        f"{business_short_code}{passkey}{timestamp}".encode()
    ).decode()

    order_id = str(metadata.get("order_id", "VELONTRI"))
    # M-Pesa account reference: max 12 chars
    account_ref = order_id[:12].upper()

    payload = {
        "BusinessShortCode": business_short_code,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),  # M-Pesa requires integer amount in KES
        "PartyA": phone,
        "PartyB": business_short_code,
        "PhoneNumber": phone,
        "CallBackURL": "https://velontri.com/payment/mpesa/callback",
        "AccountReference": account_ref,
        "TransactionDesc": f"Velontri Order {account_ref}",
    }

    try:
        async with httpx.AsyncClient(timeout=_GATEWAY_TIMEOUT) as client:
            response = await client.post(
                _MPESA_STK_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
            )
            data = response.json()

            if response.status_code == 200 and data.get("ResponseCode") == "0":
                checkout_id = data.get("CheckoutRequestID", "")
                logger.info(
                    "mpesa_stk_push_initiated",
                    checkout_request_id=checkout_id,
                    phone=phone,
                )
                return GatewayResult(
                    success=True,
                    gateway_ref=checkout_id,
                    raw_response=data,
                )
            else:
                error_msg = data.get(
                    "errorMessage",
                    data.get("ResponseDescription", "M-Pesa STK Push failed"),
                )
                logger.warning(
                    "mpesa_stk_push_failed",
                    status_code=response.status_code,
                    message=error_msg,
                )
                return GatewayResult(success=False, error=error_msg, raw_response=data)

    except httpx.TimeoutException:
        logger.error("mpesa_timeout", phone=phone)
        return GatewayResult(success=False, error="M-Pesa request timed out")
    except Exception as exc:
        logger.error("mpesa_unexpected_error", error=str(exc), exc_info=True)
        return GatewayResult(success=False, error=f"Unexpected error: {exc}")


# ── HMAC Webhook Validation ───────────────────────────────────────────────────

def verify_paystack_signature(
    payload_bytes: bytes,
    signature: str,
    secret: str,
) -> bool:
    """
    Verify a Paystack webhook signature.

    Paystack signs the raw request body with HMAC-SHA512.
    Uses hmac.compare_digest for constant-time comparison.

    Reference: https://paystack.com/docs/payments/webhooks/#ip-whitelisting
    """
    if not signature or not secret:
        return False
    try:
        expected = hmac.new(
            secret.encode("utf-8"),
            payload_bytes,
            digestmod=hashlib.sha512,
        ).hexdigest()
        return hmac.compare_digest(expected, signature.lower())
    except Exception:
        return False


def verify_flutterwave_signature(
    payload_bytes: bytes,
    signature: str,
    secret: str,
) -> bool:
    """
    Verify a Flutterwave webhook signature.

    Flutterwave sends the secret hash in the ``verif-hash`` header.
    For Flutterwave, the verification is a direct constant-time string
    comparison of the configured secret hash against the header value.

    Reference: https://developer.flutterwave.com/docs/integration-guides/webhooks/
    """
    if not signature or not secret:
        return False
    try:
        # Constant-time comparison to prevent timing attacks
        return hmac.compare_digest(secret.encode("utf-8"), signature.encode("utf-8"))
    except Exception:
        return False


def verify_mpesa_signature(
    payload_bytes: bytes,  # noqa: ARG001 — kept for interface consistency
    signature: str,
    secret: str,
) -> bool:
    """
    M-Pesa does not sign webhooks with HMAC.
    Instead, validate the caller IP against the Safaricom IP range
    and optionally an API key in headers.

    This implementation does a constant-time comparison if a shared secret
    is configured; otherwise returns True (IP filtering handled at gateway).
    """
    if not secret:
        # No secret configured → rely solely on IP allowlisting at load balancer
        return True
    if not signature:
        return False
    try:
        return hmac.compare_digest(
            secret.encode("utf-8"), signature.encode("utf-8")
        )
    except Exception:
        return False
