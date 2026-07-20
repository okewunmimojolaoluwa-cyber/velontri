"""
Unit tests for Auth Service request/response schemas.

Validates all input validators — these are the first line of defence
against malformed or malicious input.
"""
from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.schemas import (
    LoginRequest,
    OAuthLoginRequest,
    PasswordResetBody,
    RegisterRequest,
    TokenRefreshRequest,
    Verify2FARequest,
    VerifyPhoneRequest,
)


class TestRegisterRequest:

    def _valid(self, **overrides) -> dict:
        base = {
            "email": "user@example.com",
            "phone": "+2348012345678",
            "password": "StrongPass1!",
            "full_name": "Ade Johnson",
            "country_code": "NG",
        }
        return {**base, **overrides}

    def test_valid_registration(self) -> None:
        r = RegisterRequest(**self._valid())
        assert r.email == "user@example.com"

    def test_email_normalised(self) -> None:
        r = RegisterRequest(**self._valid(email="USER@Example.COM"))
        assert r.email == "user@example.com"

    def test_invalid_email_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(email="not-an-email"))

    # Phone validation
    def test_valid_phone_e164(self) -> None:
        r = RegisterRequest(**self._valid(phone="+254712345678"))
        assert r.phone == "+254712345678"

    def test_phone_without_plus_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(phone="2348012345678"))

    def test_phone_too_short_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(phone="+123"))

    def test_phone_with_letters_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(phone="+23480ABCDEF"))

    # Password validation
    def test_weak_password_no_uppercase_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(password="weakpass1!"))

    def test_weak_password_no_digit_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(password="WeakPass!!"))

    def test_weak_password_no_special_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(password="WeakPass11"))

    def test_password_too_short_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(password="Sh0rt!"))

    def test_password_max_length(self) -> None:
        long_pw = "Aa1!" + "x" * 124  # exactly 128 chars
        r = RegisterRequest(**self._valid(password=long_pw))
        assert len(r.password) == 128

    def test_password_exceeds_max_length_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(password="Aa1!" + "x" * 125))

    # Country code
    def test_country_code_uppercased(self) -> None:
        r = RegisterRequest(**self._valid(country_code="ng"))
        assert r.country_code == "NG"

    def test_invalid_country_code_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(country_code="NGA"))

    # Full name
    def test_full_name_whitespace_stripped(self) -> None:
        r = RegisterRequest(**self._valid(full_name="  Ade  "))
        assert r.full_name == "Ade"

    def test_full_name_empty_after_strip_raises(self) -> None:
        with pytest.raises(ValidationError):
            RegisterRequest(**self._valid(full_name="   "))


class TestVerifyPhoneRequest:

    def test_valid_request(self) -> None:
        r = VerifyPhoneRequest(user_id=uuid.uuid4(), otp="123456")
        assert r.otp == "123456"

    def test_otp_must_be_6_digits(self) -> None:
        with pytest.raises(ValidationError):
            VerifyPhoneRequest(user_id=uuid.uuid4(), otp="12345")

    def test_otp_must_be_numeric(self) -> None:
        with pytest.raises(ValidationError):
            VerifyPhoneRequest(user_id=uuid.uuid4(), otp="12345a")

    def test_otp_too_long_raises(self) -> None:
        with pytest.raises(ValidationError):
            VerifyPhoneRequest(user_id=uuid.uuid4(), otp="1234567")


class TestLoginRequest:

    def test_valid_email_login(self) -> None:
        r = LoginRequest(
            identifier="user@example.com",
            password="Pass1!abc",
            device_fingerprint="a" * 16,
        )
        assert r.identifier == "user@example.com"

    def test_valid_phone_login(self) -> None:
        r = LoginRequest(
            identifier="+2348012345678",
            password="Pass1!abc",
            device_fingerprint="a" * 16,
        )
        assert r.identifier == "+2348012345678"

    def test_empty_identifier_raises(self) -> None:
        with pytest.raises(ValidationError):
            LoginRequest(
                identifier="",
                password="Pass1!abc",
                device_fingerprint="a" * 16,
            )

    def test_fingerprint_too_short_raises(self) -> None:
        with pytest.raises(ValidationError):
            LoginRequest(
                identifier="user@example.com",
                password="Pass1!abc",
                device_fingerprint="short",
            )


class TestPasswordResetBody:

    def test_weak_new_password_raises(self) -> None:
        with pytest.raises(ValidationError):
            PasswordResetBody(token="sometoken", new_password="weakpass")

    def test_strong_new_password_accepted(self) -> None:
        r = PasswordResetBody(token="sometoken", new_password="NewPass1!")
        assert r.new_password == "NewPass1!"


class TestOAuthLoginRequest:

    def test_valid_google_provider(self) -> None:
        r = OAuthLoginRequest(
            provider="google",
            id_token="some.jwt.token",
            device_fingerprint="a" * 16,
        )
        assert r.provider == "google"

    def test_valid_apple_provider(self) -> None:
        r = OAuthLoginRequest(
            provider="apple",
            id_token="some.jwt.token",
            device_fingerprint="a" * 16,
        )
        assert r.provider == "apple"

    def test_invalid_provider_raises(self) -> None:
        with pytest.raises(ValidationError):
            OAuthLoginRequest(
                provider="facebook",
                id_token="token",
                device_fingerprint="a" * 16,
            )


class TestVerify2FARequest:

    def test_valid_request(self) -> None:
        r = Verify2FARequest(two_fa_session_id="session123", otp="123456")
        assert r.otp == "123456"

    def test_otp_too_short_raises(self) -> None:
        with pytest.raises(ValidationError):
            Verify2FARequest(two_fa_session_id="session123", otp="12345")
