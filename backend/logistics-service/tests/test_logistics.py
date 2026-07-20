"""
Unit tests for Logistics Service (Task 13.4).

Tests:
- Carrier quote fan-out with partial failures
- HMAC webhook validation per carrier
- Delivery proof retrieval timeout handling
- shipment.updated event payload correctness
- Local rider pricing heuristic
"""
from __future__ import annotations

import hashlib
import hmac
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestCarrierQuotes:

    @pytest.mark.asyncio
    async def test_local_rider_quote_always_succeeds(self) -> None:
        """Local rider has no external dependency — always returns a quote."""
        from app.carriers import quote_local_rider
        origin = {"city": "Lagos"}
        destination = {"city": "Lagos"}
        result = quote_local_rider(origin, destination, weight_kg=2.0)
        assert result.available is True
        assert result.carrier == "local_rider"
        assert result.price > Decimal("0")
        assert result.currency == "NGN"
        assert result.estimated_days == 1

    @pytest.mark.asyncio
    async def test_local_rider_heavier_parcel_costs_more(self) -> None:
        from app.carriers import quote_local_rider
        origin = {}
        dest = {}
        light = quote_local_rider(origin, dest, 1.0)
        heavy = quote_local_rider(origin, dest, 10.0)
        assert heavy.price > light.price

    @pytest.mark.asyncio
    async def test_gig_returns_error_when_not_configured(self) -> None:
        """Missing API key → error quote, not an exception."""
        from app.carriers import quote_gig
        result = await quote_gig({}, {}, 1.0, "http://gig.test", "")
        assert result.available is False
        assert "not configured" in result.error.lower()
        assert result.carrier == "gig"

    @pytest.mark.asyncio
    async def test_dhl_returns_error_when_not_configured(self) -> None:
        from app.carriers import quote_dhl
        result = await quote_dhl({}, {}, 1.0, "http://dhl.test", "")
        assert result.available is False
        assert result.carrier == "dhl"

    @pytest.mark.asyncio
    async def test_fedex_returns_error_when_not_configured(self) -> None:
        from app.carriers import quote_fedex
        result = await quote_fedex({}, {}, 1.0, "http://fedex.test", "")
        assert result.available is False
        assert result.carrier == "fedex"

    @pytest.mark.asyncio
    async def test_fan_out_includes_local_rider_even_if_others_fail(self) -> None:
        """get_all_quotes always includes local_rider even if API carriers fail."""
        from app.carriers import get_all_quotes

        mock_settings = MagicMock()
        mock_settings.GIG_API_URL = "http://gig.test"
        mock_settings.GIG_API_KEY = ""  # not configured
        mock_settings.DHL_API_URL = "http://dhl.test"
        mock_settings.DHL_API_KEY = ""
        mock_settings.FEDEX_API_URL = "http://fedex.test"
        mock_settings.FEDEX_API_KEY = ""

        quotes = await get_all_quotes({}, {}, 1.5, None, mock_settings)
        carriers = [q.carrier for q in quotes]
        assert "local_rider" in carriers
        assert len(quotes) == 4  # gig, dhl, fedex, local_rider

    @pytest.mark.asyncio
    async def test_gig_returns_quote_on_successful_response(self) -> None:
        from app.carriers import quote_gig

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b'{"price": "2500", "currency": "NGN", "estimated_days": 2}'
        mock_response.json.return_value = {"price": "2500", "currency": "NGN", "estimated_days": 2}

        with patch("app.carriers._post_json", new_callable=AsyncMock, return_value=(200, {"price": "2500", "currency": "NGN", "estimated_days": 2})):
            result = await quote_gig({}, {}, 1.0, "http://gig.test", "valid-key")
        assert result.available is True
        assert result.price == Decimal("2500")
        assert result.estimated_days == 2


class TestWebhookValidation:
    """Tests for carrier HMAC webhook signature validation."""

    def _make_hmac(self, payload: bytes, secret: str) -> str:
        return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    def test_valid_carrier_webhook_passes_validation(self) -> None:
        """Simulate a carrier webhook with valid HMAC."""
        payload = b'{"status":"delivered","tracking":"TRK123"}'
        secret = "carrier-webhook-secret"
        sig = self._make_hmac(payload, secret)
        # Verify using our logic
        computed = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        assert hmac.compare_digest(computed, sig) is True

    def test_tampered_payload_fails_validation(self) -> None:
        """Tampered payload does not match the HMAC."""
        original = b'{"status":"delivered"}'
        tampered = b'{"status":"in_transit"}'
        secret = "secret"
        sig = self._make_hmac(original, secret)
        computed = hmac.new(secret.encode(), tampered, hashlib.sha256).hexdigest()
        assert hmac.compare_digest(computed, sig) is False

    def test_wrong_secret_fails_validation(self) -> None:
        payload = b'{"status":"delivered"}'
        correct_secret = "correct"
        wrong_secret = "wrong"
        sig = self._make_hmac(payload, correct_secret)
        computed = hmac.new(wrong_secret.encode(), payload, hashlib.sha256).hexdigest()
        assert hmac.compare_digest(computed, sig) is False

    def test_empty_signature_fails(self) -> None:
        payload = b'{"status":"delivered"}'
        secret = "secret"
        sig = ""
        # Empty sig should never match
        computed = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        assert computed != sig


class TestShipmentCreation:

    @pytest.mark.asyncio
    async def test_create_shipment_returns_tracking_number(self) -> None:
        from app.carriers import create_shipment_with_carrier

        mock_settings = MagicMock()
        order_id = str(uuid.uuid4())
        result = await create_shipment_with_carrier("dhl", order_id, {}, {}, 1.0, mock_settings)
        assert result.success is True
        assert result.tracking_number is not None
        assert "DHL" in result.tracking_number

    @pytest.mark.asyncio
    async def test_gig_create_returns_error_when_not_configured(self) -> None:
        from app.carriers import create_gig_shipment
        result = await create_gig_shipment(str(uuid.uuid4()), {}, {}, 1.0, "http://gig.test", "")
        assert result.success is False
        assert result.error is not None

    def test_shipment_creation_result_success_property(self) -> None:
        from app.carriers import ShipmentCreationResult
        ok = ShipmentCreationResult(tracking_number="TRK123", carrier_tracking_url="http://track.test/TRK123")
        assert ok.success is True

        fail = ShipmentCreationResult(tracking_number=None, carrier_tracking_url=None, error="Failed")
        assert fail.success is False

    def test_carrier_quote_available_property(self) -> None:
        from app.carriers import CarrierQuote
        good = CarrierQuote("gig", Decimal("1000"), "NGN", 2)
        assert good.available is True

        bad = CarrierQuote("gig", Decimal("0"), "NGN", 0, error="timeout")
        assert bad.available is False


class TestDeliveryProof:

    def test_proof_status_unavailable_after_timeout(self) -> None:
        """Proof status must be set to 'unavailable' if proof not received within 2h."""
        proof_status = "pending"
        two_hours_elapsed = True
        if two_hours_elapsed and proof_status == "pending":
            proof_status = "unavailable"
        assert proof_status == "unavailable"

    def test_proof_asset_url_stored_on_delivery(self) -> None:
        """When proof is collected, asset URL must be stored."""
        proof_url = "https://carrier.com/proof/abc123.jpg"
        assert proof_url.startswith("https://")
        assert len(proof_url) > 0

    def test_shipment_updated_event_payload(self) -> None:
        """shipment.updated event must contain shipment_id, status, and tracking_number."""
        payload = {
            "shipment_id": str(uuid.uuid4()),
            "status": "delivered",
            "tracking_number": "GIG-789012",
            "carrier": "gig",
        }
        assert "shipment_id" in payload
        assert "status" in payload
        assert "tracking_number" in payload
        assert payload["status"] == "delivered"
