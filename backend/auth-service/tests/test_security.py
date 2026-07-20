"""
Unit tests for auth-service security utilities.

Covers:
- Password hashing (bcrypt, cost=12)
- OTP generation and hash verification
- TOTP generation, encryption, and verification
- Reset token generation
- Refresh token hashing
- Rate limiter (sliding window)
- Lockout logic
"""
from __future__ import annotations

import hashlib
import time
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from cryptography.fernet import Fernet

from app.security import (
    BCRYPT_COST,
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_otp,
    generate_refresh_token,
    generate_reset_token,
    generate_totp_secret,
    get_totp_uri,
    hash_otp,
    hash_password,
    hash_refresh_token,
    hash_reset_token,
    is_account_locked,
    verify_otp_hash,
    verify_password,
    verify_totp,
)


# ── Password tests ────────────────────────────────────────────────────────────

class TestPasswordHashing:

    def test_hash_produces_bcrypt_hash(self) -> None:
        h = hash_password("StrongPass1!")
        assert h.startswith("$2b$")

    def test_hash_uses_cost_factor_12(self) -> None:
        h = hash_password("StrongPass1!")
        # bcrypt hash format: $2b$<cost>$...
        cost = int(h.split("$")[2])
        assert cost == BCRYPT_COST

    def test_verify_correct_password(self) -> None:
        pw = "Correct$Horse99"
        h = hash_password(pw)
        assert verify_password(pw, h) is True

    def test_verify_wrong_password(self) -> None:
        h = hash_password("RightPass1!")
        assert verify_password("WrongPass1!", h) is False

    def test_verify_empty_password_returns_false(self) -> None:
        h = hash_password("SomePass1!")
        assert verify_password("", h) is False

    def test_verify_empty_hash_returns_false(self) -> None:
        assert verify_password("SomePass1!", "") is False

    def test_hash_empty_password_raises(self) -> None:
        with pytest.raises(ValueError):
            hash_password("")

    def test_different_hashes_for_same_password(self) -> None:
        pw = "SamePass1!"
        h1 = hash_password(pw)
        h2 = hash_password(pw)
        assert h1 != h2  # bcrypt uses random salt

    def test_timing_attack_resistance(self) -> None:
        """
        verify_password must use bcrypt.checkpw for both valid and invalid passwords
        — it must not short-circuit on mismatch.
        Both calls go through bcrypt so they take roughly the same time.
        """
        import time
        h = hash_password("Correct1!")
        # Warm up to avoid JIT / import timing skew
        verify_password("Correct1!", h)
        verify_password("Wrong1!!", h)

        t0 = time.perf_counter()
        for _ in range(3):
            verify_password("Correct1!", h)
        t_right = (time.perf_counter() - t0) / 3

        t0 = time.perf_counter()
        for _ in range(3):
            verify_password("Wrong1!!", h)
        t_wrong = (time.perf_counter() - t0) / 3

        # Allow 200ms tolerance (generous for slow CI/dev machines)
        assert abs(t_right - t_wrong) < 0.2


# ── OTP tests ─────────────────────────────────────────────────────────────────

class TestOTP:

    def test_otp_is_6_digits(self) -> None:
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()

    def test_otp_zero_padded(self) -> None:
        # generate_otp must zero-pad: "000001" not "1"
        otp = generate_otp(length=6)
        assert len(otp) == 6

    def test_otp_uniqueness(self) -> None:
        otps = {generate_otp() for _ in range(100)}
        # With 10^6 possible values and 100 samples, collision probability is tiny
        assert len(otps) > 90

    def test_hash_and_verify_correct(self) -> None:
        otp = generate_otp()
        h = hash_otp(otp)
        assert verify_otp_hash(otp, h) is True

    def test_verify_wrong_otp_fails(self) -> None:
        h = hash_otp("123456")
        assert verify_otp_hash("654321", h) is False

    def test_verify_empty_otp_fails(self) -> None:
        h = hash_otp("123456")
        assert verify_otp_hash("", h) is False


# ── TOTP tests ────────────────────────────────────────────────────────────────

class TestTOTP:

    def test_generate_secret_is_base32(self) -> None:
        import base64
        secret = generate_totp_secret()
        # Should be valid base32
        decoded = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8))
        assert len(decoded) >= 10

    def test_totp_uri_contains_issuer(self) -> None:
        secret = generate_totp_secret()
        uri = get_totp_uri(secret, "user@example.com")
        assert "Velontri" in uri
        # @ is URL-encoded as %40 in otpauth:// URIs
        assert "user" in uri and ("example.com" in uri or "user%40example.com" in uri)
        assert uri.startswith("otpauth://totp/")

    def test_verify_valid_totp(self) -> None:
        import pyotp
        secret = generate_totp_secret()
        totp = pyotp.TOTP(secret)
        current_code = totp.now()
        assert verify_totp(secret, current_code) is True

    def test_verify_wrong_totp_code(self) -> None:
        secret = generate_totp_secret()
        assert verify_totp(secret, "000000") is False

    def test_verify_totp_empty_inputs(self) -> None:
        assert verify_totp("", "123456") is False
        assert verify_totp("JBSWY3DPEHPK3PXP", "") is False

    def test_totp_encryption_roundtrip(self) -> None:
        key = Fernet.generate_key().decode()
        secret = generate_totp_secret()
        encrypted = encrypt_totp_secret(secret, key)
        assert encrypted != secret
        decrypted = decrypt_totp_secret(encrypted, key)
        assert decrypted == secret

    def test_totp_decryption_wrong_key_raises(self) -> None:
        key1 = Fernet.generate_key().decode()
        key2 = Fernet.generate_key().decode()
        secret = generate_totp_secret()
        encrypted = encrypt_totp_secret(secret, key1)
        with pytest.raises(ValueError, match="Cannot decrypt TOTP secret"):
            decrypt_totp_secret(encrypted, key2)

    def test_totp_decryption_tampered_data_raises(self) -> None:
        key = Fernet.generate_key().decode()
        with pytest.raises(ValueError):
            decrypt_totp_secret("tampered_data_!!!", key)


# ── Reset token tests ─────────────────────────────────────────────────────────

class TestResetToken:

    def test_generates_raw_and_hash(self) -> None:
        raw, h = generate_reset_token()
        assert len(raw) > 20
        assert len(h) == 64  # SHA-256 hex digest

    def test_hash_is_deterministic(self) -> None:
        raw, h1 = generate_reset_token()
        h2 = hash_reset_token(raw)
        assert h1 == h2

    def test_different_tokens_different_hashes(self) -> None:
        raw1, h1 = generate_reset_token()
        raw2, h2 = generate_reset_token()
        assert h1 != h2

    def test_raw_token_not_in_hash(self) -> None:
        raw, h = generate_reset_token()
        assert raw not in h


# ── Refresh token tests ───────────────────────────────────────────────────────

class TestRefreshToken:

    def test_refresh_token_is_url_safe(self) -> None:
        import re
        token = generate_refresh_token()
        assert re.match(r"^[A-Za-z0-9_\-]+$", token)

    def test_hash_is_sha256(self) -> None:
        token = generate_refresh_token()
        h = hash_refresh_token(token)
        assert len(h) == 64

    def test_same_token_same_hash(self) -> None:
        token = generate_refresh_token()
        assert hash_refresh_token(token) == hash_refresh_token(token)

    def test_different_tokens_different_hashes(self) -> None:
        h1 = hash_refresh_token(generate_refresh_token())
        h2 = hash_refresh_token(generate_refresh_token())
        assert h1 != h2


# ── Rate limiter tests ────────────────────────────────────────────────────────

class TestRateLimiter:

    @pytest.mark.asyncio
    async def test_allows_requests_under_limit(self) -> None:
        from app.security import check_rate_limit
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_redis = MagicMock()
        pipeline_mock = MagicMock()
        # pipeline() is called as a context manager via async with
        pipeline_mock.__aenter__ = AsyncMock(return_value=pipeline_mock)
        pipeline_mock.__aexit__ = AsyncMock(return_value=False)
        # execute returns [None, 3, None, None] — count = 3 (under limit of 10)
        pipeline_mock.execute = AsyncMock(return_value=[None, 3, None, None])
        pipeline_mock.zremrangebyscore = MagicMock()
        pipeline_mock.zcard = MagicMock()
        pipeline_mock.zadd = MagicMock()
        pipeline_mock.expire = MagicMock()
        mock_redis.pipeline = MagicMock(return_value=pipeline_mock)

        # Should not raise
        await check_rate_limit(mock_redis, "192.168.1.1", max_requests=10)

    @pytest.mark.asyncio
    async def test_blocks_requests_at_limit(self) -> None:
        from app.security import check_rate_limit

        mock_redis = AsyncMock()
        pipeline_mock = MagicMock()
        pipeline_mock.__aenter__ = AsyncMock(return_value=pipeline_mock)
        pipeline_mock.__aexit__ = AsyncMock(return_value=False)
        pipeline_mock.execute = AsyncMock(
            return_value=[None, 10, None, None]  # count = 10 = limit
        )
        pipeline_mock.zremrangebyscore = MagicMock()
        pipeline_mock.zcard = MagicMock()
        pipeline_mock.zadd = MagicMock()
        pipeline_mock.expire = MagicMock()
        mock_redis.pipeline = MagicMock(return_value=pipeline_mock)

        from shared.errors import VelontriError
        with pytest.raises(VelontriError):
            await check_rate_limit(mock_redis, "192.168.1.1", max_requests=10)


# ── Lockout tests ─────────────────────────────────────────────────────────────

class TestLockout:

    @pytest.mark.asyncio
    async def test_account_not_locked_initially(self) -> None:
        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=0)
        result = await is_account_locked(mock_redis, str(uuid.uuid4()))
        assert result is False

    @pytest.mark.asyncio
    async def test_account_locked_when_key_exists(self) -> None:
        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=1)
        result = await is_account_locked(mock_redis, str(uuid.uuid4()))
        assert result is True

    @pytest.mark.asyncio
    async def test_assert_not_locked_raises_when_locked(self) -> None:
        from app.security import assert_not_locked
        from shared.errors import AccountLockedError

        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=1)

        with pytest.raises(AccountLockedError):
            await assert_not_locked(mock_redis, str(uuid.uuid4()))

    @pytest.mark.asyncio
    async def test_assert_not_locked_passes_when_unlocked(self) -> None:
        from app.security import assert_not_locked

        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=0)

        # Should not raise
        await assert_not_locked(mock_redis, str(uuid.uuid4()))
