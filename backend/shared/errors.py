"""
Standard error schema and exception hierarchy for all Velontri microservices.

Every API response — success or failure — uses a consistent envelope so that
clients never need to parse different shapes.
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel


# ── Error code registry ────────────────────────────────────────────────────────

class ErrorCode(str, Enum):
    # Auth errors
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    TOKEN_INVALID = "TOKEN_INVALID"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE"
    PHONE_NOT_VERIFIED = "PHONE_NOT_VERIFIED"
    OTP_EXPIRED = "OTP_EXPIRED"
    OTP_INVALID = "OTP_INVALID"
    DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND"

    # Resource errors
    NOT_FOUND = "NOT_FOUND"
    ALREADY_EXISTS = "ALREADY_EXISTS"
    CONFLICT = "CONFLICT"

    # Permission errors
    FORBIDDEN = "FORBIDDEN"
    UNAUTHORIZED = "UNAUTHORIZED"
    INSUFFICIENT_SCOPE = "INSUFFICIENT_SCOPE"

    # Validation errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_INPUT = "INVALID_INPUT"

    # Payment / wallet errors
    INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    ESCROW_ALREADY_RELEASED = "ESCROW_ALREADY_RELEASED"
    DISPUTE_WINDOW_CLOSED = "DISPUTE_WINDOW_CLOSED"

    # Subscription errors
    FEATURE_NOT_AVAILABLE = "FEATURE_NOT_AVAILABLE"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"

    # External service errors
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT"

    # Server errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"


# ── Response envelope ─────────────────────────────────────────────────────────

class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str
    field: str | None = None  # for validation errors pointing to a specific field


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
    request_id: str | None = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = "Operation successful"
    data: Any = None
    meta: dict[str, Any] | None = None  # pagination, etc.


def paginated_meta(
    page: int,
    page_size: int,
    total: int,
) -> dict[str, Any]:
    """Build a standard pagination meta block."""
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }


# ── Exception base classes ────────────────────────────────────────────────────

class VelontriError(Exception):
    """Base class for all Velontri domain exceptions."""

    http_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code: ErrorCode = ErrorCode.INTERNAL_ERROR

    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.field = field

    def to_response(self, request_id: str | None = None) -> ErrorResponse:
        return ErrorResponse(
            error=ErrorDetail(
                code=self.error_code,
                message=self.message,
                field=self.field,
            ),
            request_id=request_id,
        )


class NotFoundError(VelontriError):
    http_status = status.HTTP_404_NOT_FOUND
    error_code = ErrorCode.NOT_FOUND


class AlreadyExistsError(VelontriError):
    http_status = status.HTTP_409_CONFLICT
    error_code = ErrorCode.ALREADY_EXISTS


class ConflictError(VelontriError):
    http_status = status.HTTP_409_CONFLICT
    error_code = ErrorCode.CONFLICT


class ForbiddenError(VelontriError):
    http_status = status.HTTP_403_FORBIDDEN
    error_code = ErrorCode.FORBIDDEN


class UnauthorizedError(VelontriError):
    http_status = status.HTTP_401_UNAUTHORIZED
    error_code = ErrorCode.UNAUTHORIZED


class ValidationError(VelontriError):
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = ErrorCode.VALIDATION_ERROR


class InvalidInputError(VelontriError):
    http_status = status.HTTP_400_BAD_REQUEST
    error_code = ErrorCode.INVALID_INPUT


class TokenExpiredError(VelontriError):
    http_status = status.HTTP_401_UNAUTHORIZED
    error_code = ErrorCode.TOKEN_EXPIRED


class TokenInvalidError(VelontriError):
    http_status = status.HTTP_401_UNAUTHORIZED
    error_code = ErrorCode.TOKEN_INVALID


class AccountLockedError(VelontriError):
    http_status = status.HTTP_403_FORBIDDEN
    error_code = ErrorCode.ACCOUNT_LOCKED


class AccountInactiveError(VelontriError):
    http_status = status.HTTP_403_FORBIDDEN
    error_code = ErrorCode.ACCOUNT_INACTIVE


class InvalidCredentialsError(VelontriError):
    http_status = status.HTTP_401_UNAUTHORIZED
    error_code = ErrorCode.INVALID_CREDENTIALS


class InsufficientFundsError(VelontriError):
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = ErrorCode.INSUFFICIENT_FUNDS


class FeatureNotAvailableError(VelontriError):
    http_status = status.HTTP_403_FORBIDDEN
    error_code = ErrorCode.FEATURE_NOT_AVAILABLE


class QuotaExceededError(VelontriError):
    http_status = status.HTTP_429_TOO_MANY_REQUESTS
    error_code = ErrorCode.QUOTA_EXCEEDED


class ExternalServiceError(VelontriError):
    http_status = status.HTTP_502_BAD_GATEWAY
    error_code = ErrorCode.EXTERNAL_SERVICE_ERROR


class OTPExpiredError(VelontriError):
    http_status = status.HTTP_400_BAD_REQUEST
    error_code = ErrorCode.OTP_EXPIRED


class OTPInvalidError(VelontriError):
    http_status = status.HTTP_400_BAD_REQUEST
    error_code = ErrorCode.OTP_INVALID


# ── FastAPI exception handlers ────────────────────────────────────────────────

async def velontri_error_handler(
    request: Request, exc: VelontriError
) -> JSONResponse:
    """Converts VelontriError subclasses into standard JSON error responses."""
    request_id: str | None = request.headers.get("X-Request-ID")
    return JSONResponse(
        status_code=exc.http_status,
        content=exc.to_response(request_id=request_id).model_dump(mode="json"),
    )


async def unhandled_error_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """
    Catch-all handler for unexpected exceptions.
    Logs the error internally but returns a generic message to avoid
    leaking implementation details.
    """
    from shared.logging import get_logger  # late import to avoid circular

    logger = get_logger(__name__)
    logger.error(
        "unhandled_exception",
        exc_type=type(exc).__name__,
        exc_str=str(exc),
        path=request.url.path,
        method=request.method,
        exc_info=True,
    )
    request_id: str | None = request.headers.get("X-Request-ID")
    response = ErrorResponse(
        error=ErrorDetail(
            code=ErrorCode.INTERNAL_ERROR,
            message="An unexpected error occurred. Please try again.",
        ),
        request_id=request_id,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response.model_dump(mode="json"),
    )


def register_error_handlers(app: Any) -> None:  # noqa: ANN401
    """Register all exception handlers on a FastAPI app instance."""
    app.add_exception_handler(VelontriError, velontri_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
