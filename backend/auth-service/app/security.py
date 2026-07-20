"""
Auth Service security utilities.

Handles:
- Password hashing/verification (bcrypt, cost factor 12)
- OTP generation and hashing
- TOTP secret management (encrypted at rest with Fernet)
- Rate-limit sliding-window counter
- Lockout management via Redis
- Device fingerprint registration
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import pyotp
from cryptography.fernet import Fernet, InvalidToken
from redis.asyncio import Redis

from shared.errors import (
    AccountLockedError,
    OTPExpiredError,
    OTPInvalidError,
)
from shared.logging import get_logger
from shared.redis_client import RedisKeys

logger = get_logger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

BCRYPT_COST: int = 12
OTP_LENGTH: int = 6


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """
    Hash a plaintext password with bcrypt at cost factor 12.
    Returns the bcrypt hash string.
    """
    if not plain:
        raise ValueError("Password must not be empty.")
    salt = bcrypt.gensalt(rounds=BCRYPT_COST)
    hashed: bytes = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Constant-time bcrypt verification.
    Returns True only if the plain password matches the stored hash.
    Never raises — returns False on any mismatch or error.
    """
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── OTP ───────────────────────────────────────────────────────────────────────

def generate_otp(length: int = OTP_LENGTH) -> str:
    """
    Generate a cryptographically secure numeric OTP.
    Uses os.urandom-backed secrets module — not random.randint.
    """
    upper = 10 ** length
    return str(secrets.randbelow(upper)).zfill(length)


def hash_otp(otp: str) -> str:
    """
    Hash an OTP for safe storage.
    Uses SHA-256 — OTPs are short-lived so bcrypt's cost is unnecessary.
    """
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def verify_otp_hash(otp: str, stored_hash: str) -> bool:
    """
    Constant-time comparison of an OTP against its stored hash.
    """
    expected = hashlib.sha256(otp.encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected, stored_hash)


# ── TOTP ──────────────────────────────────────────────────────────────────────

def generate_totp_secret() -> str:
    """Generate a new base32 TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, user_email: str) -> str:
    """Return the otpauth:// URI for QR code generation."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=user_email, issuer_name="Velontri")


def verify_totp(secret: str, code: str) -> bool:
    """
    Verify a TOTP code against the secret.
    Allows ±1 time window (30 s) to account for clock drift.
    Returns False on any error.
    """
    if not secret or not code:
        return False
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    except Exception:
        return False


def encrypt_totp_secret(secret: str, encryption_key: str) -> str:
    """Encrypt a TOTP secret using Fernet symmetric encryption."""
    f = Fernet(encryption_key.encode())
    return f.encrypt(secret.encode()).decode()


def decrypt_totp_secret(encrypted: str, encryption_key: str) -> str:
    """
    Decrypt a stored TOTP secret.
    Raises ValueError if the key is wrong or the ciphertext is tampered.
    """
    try:
        f = Fernet(encryption_key.encode())
        return f.decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Cannot decrypt TOTP secret — invalid key or corrupted data.") from exc


# ── Reset tokens ──────────────────────────────────────────────────────────────

def generate_reset_token() -> tuple[str, str]:
    """
    Generate a password reset token.
    Returns (raw_token, token_hash).
    The raw token is sent to the user; only the hash is stored in Redis.
    """
    raw = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash


def hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


# ── Refresh token hashing ─────────────────────────────────────────────────────

def hash_refresh_token(raw_token: str) -> str:
    """SHA-256 hash of a refresh token for safe database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    """Generate a cryptographically secure refresh token."""
    return secrets.token_urlsafe(64)


# ── Rate limiting ─────────────────────────────────────────────────────────────

async def check_rate_limit(
    redis: Redis,
    ip: str,
    max_requests: int = 10,
    window_seconds: int = 60,
) -> None:
    """
    Sliding window rate limiter for auth endpoints.
    Raises HTTP 429 (via VelontriError subclass) if the limit is exceeded.

    Uses a Redis sorted set keyed by IP — members are request timestamps,
    score is the Unix timestamp.
    """
    from shared.errors import VelontriError, ErrorCode
    from fastapi import status

    key = RedisKeys.rate_limit_auth(ip)
    now = time.time()
    window_start = now - window_seconds

    pipe = redis.pipeline()
    # Remove entries outside the window
    pipe.zremrangebyscore(key, "-inf", window_start)
    # Count remaining entries in window
    pipe.zcard(key)
    # Add current request
    pipe.zadd(key, {str(uuid.uuid4()): now})
    # Set expiry so the key self-cleans
    pipe.expire(key, window_seconds)
    results = await pipe.execute()

    current_count: int = results[1]

    if current_count >= max_requests:
        logger.warning("rate_limit_exceeded", ip=ip, count=current_count)

        class RateLimitError(VelontriError):
            http_status = status.HTTP_429_TOO_MANY_REQUESTS
            error_code = ErrorCode.QUOTA_EXCEEDED

        raise RateLimitError(
            f"Too many requests. Maximum {max_requests} per {window_seconds}s."
        )


# ── Account lockout ───────────────────────────────────────────────────────────

async def record_failed_attempt(
    redis: Redis,
    user_id: str,
    max_attempts: int = 5,
    lockout_ttl: int = 900,
) -> int:
    """
    Increment the failed login counter for a user in Redis.
    Returns the new failure count.
    If count reaches max_attempts, also sets the lockout key.
    """
    counter_key = f"auth:failed:{user_id}"
    count = await redis.incr(counter_key)
    # Keep the counter alive for the lockout window
    await redis.expire(counter_key, lockout_ttl)

    if count >= max_attempts:
        lockout_key = RedisKeys.lockout(user_id)
        await redis.setex(lockout_key, lockout_ttl, "locked")
        logger.warning(
            "account_locked",
            user_id=user_id,
            failed_attempts=count,
        )

    return count


async def clear_failed_attempts(redis: Redis, user_id: str) -> None:
    """Clear the failed attempt counter on successful login."""
    await redis.delete(f"auth:failed:{user_id}")


async def is_account_locked(redis: Redis, user_id: str) -> bool:
    """Return True if the lockout key is set for this user."""
    key = RedisKeys.lockout(user_id)
    return await redis.exists(key) == 1


async def assert_not_locked(redis: Redis, user_id: str) -> None:
    """Raise AccountLockedError if the account is currently locked."""
    if await is_account_locked(redis, user_id):
        raise AccountLockedError(
            "Account is temporarily locked due to multiple failed login attempts. "
            "Please try again in 15 minutes or reset your password."
        )
