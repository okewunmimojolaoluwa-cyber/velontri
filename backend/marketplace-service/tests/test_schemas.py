"""
Marketplace Service schema validation tests.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas import (
    CreateBookingRequest,
    CreateListingRequest,
    CreateReviewRequest,
    JobDetailRequest,
    UpsertStoreRequest,
    VehicleDetailRequest,
    VariantRequest,
)


class TestCreateListingRequest:

    def _valid(self, **overrides) -> dict:
        return {
            "listing_type": "physical",
            "title": "Samsung Galaxy S24",
            "currency": "NGN",
            **overrides,
        }

    def test_valid_listing(self) -> None:
        r = CreateListingRequest(**self._valid())
        assert r.listing_type == "physical"

    def test_invalid_listing_type(self) -> None:
        with pytest.raises(ValidationError):
            CreateListingRequest(**self._valid(listing_type="auction"))

    def test_invalid_currency(self) -> None:
        with pytest.raises(ValidationError):
            CreateListingRequest(**self._valid(currency="USD"))

    def test_currency_uppercased(self) -> None:
        r = CreateListingRequest(**self._valid(currency="ngn"))
        assert r.currency == "NGN"

    def test_title_max_length(self) -> None:
        with pytest.raises(ValidationError):
            CreateListingRequest(**self._valid(title="x" * 201))

    def test_description_max_length(self) -> None:
        with pytest.raises(ValidationError):
            CreateListingRequest(**self._valid(description="x" * 10_001))

    def test_invalid_condition(self) -> None:
        with pytest.raises(ValidationError):
            CreateListingRequest(**self._valid(condition="broken"))

    def test_negative_price_raises(self) -> None:
        with pytest.raises(ValidationError):
            CreateListingRequest(**self._valid(price=Decimal("-100")))


class TestVehicleDetailRequest:

    def test_valid_vin(self) -> None:
        r = VehicleDetailRequest(vin="1HGBH41JXMN109186")
        assert r.vin == "1HGBH41JXMN109186"

    def test_vin_uppercased(self) -> None:
        r = VehicleDetailRequest(vin="1hgbh41jxmn109186")
        assert r.vin == "1HGBH41JXMN109186"

    def test_vin_wrong_length(self) -> None:
        with pytest.raises(ValidationError):
            VehicleDetailRequest(vin="SHORT")

    def test_vin_invalid_chars(self) -> None:
        # I, O, Q are not valid VIN characters
        with pytest.raises(ValidationError):
            VehicleDetailRequest(vin="1HGBH41JXMI109186")  # contains I


class TestJobDetailRequest:

    def test_valid_job(self) -> None:
        r = JobDetailRequest(job_type="full_time")
        assert r.job_type == "full_time"

    def test_salary_min_gt_max_raises(self) -> None:
        with pytest.raises(ValidationError):
            JobDetailRequest(
                job_type="contract",
                salary_min=Decimal("500000"),
                salary_max=Decimal("100000"),
            )

    def test_valid_salary_range(self) -> None:
        r = JobDetailRequest(
            job_type="remote",
            salary_min=Decimal("200000"),
            salary_max=Decimal("500000"),
        )
        assert r.salary_max > r.salary_min


class TestUpsertStoreRequest:

    def test_valid_custom_domain(self) -> None:
        r = UpsertStoreRequest(store_name="TechHub", custom_domain="techhub.velontri.com")
        assert r.custom_domain == "techhub.velontri.com"

    def test_invalid_custom_domain_not_velontri(self) -> None:
        with pytest.raises(ValidationError):
            UpsertStoreRequest(store_name="Shop", custom_domain="shop.example.com")

    def test_invalid_custom_domain_uppercase_normalized(self) -> None:
        r = UpsertStoreRequest(store_name="Shop", custom_domain="MYSHOP.velontri.com")
        assert r.custom_domain == "myshop.velontri.com"


class TestCreateBookingRequest:

    def test_past_scheduled_at_raises(self) -> None:
        past = datetime.now(tz=timezone.utc) - timedelta(hours=1)
        with pytest.raises(ValidationError):
            CreateBookingRequest(listing_id=uuid.uuid4(), scheduled_at=past)

    def test_future_scheduled_at_valid(self) -> None:
        future = datetime.now(tz=timezone.utc) + timedelta(days=3)
        r = CreateBookingRequest(listing_id=uuid.uuid4(), scheduled_at=future)
        assert r.scheduled_at == future

    def test_naive_datetime_raises(self) -> None:
        naive = datetime(2027, 1, 1, 10, 0, 0)  # no tzinfo
        with pytest.raises(ValidationError):
            CreateBookingRequest(listing_id=uuid.uuid4(), scheduled_at=naive)


class TestCreateReviewRequest:

    def test_rating_below_1_raises(self) -> None:
        with pytest.raises(ValidationError):
            CreateReviewRequest(rating=0)

    def test_rating_above_5_raises(self) -> None:
        with pytest.raises(ValidationError):
            CreateReviewRequest(rating=6)

    def test_comment_max_length(self) -> None:
        with pytest.raises(ValidationError):
            CreateReviewRequest(rating=4, comment="x" * 2001)

    def test_valid_review(self) -> None:
        r = CreateReviewRequest(rating=5, comment="Excellent product!")
        assert r.rating == 5
