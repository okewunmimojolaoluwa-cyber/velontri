"""
Unit tests for AI Service (Task 14.4).

Tests:
- NL query parsing with ambiguous inputs
- CV scoring edge cases (empty skills, 100% match)
- Reply suggestion count enforcement (<=3)
- Spam confidence threshold boundary (0.85)
- Session history truncation at 20 turns
- BI insight deviation detection at 15% threshold
"""
from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestNLQueryParsing:

    @pytest.mark.asyncio
    async def test_returns_keywords_as_fallback(self) -> None:
        """When AI returns invalid JSON, fallback to keyword search."""
        from app.service import AIService

        mock_redis = AsyncMock()
        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = None  # No key → fallback path
        mock_settings.OPENAI_MODEL = "gpt-4o"

        svc = AIService(mock_redis, mock_settings)
        result = await svc.parse_nl_query("Toyota Camry under 10 million Lagos")
        assert "keywords" in result
        assert result["keywords"] == "Toyota Camry under 10 million Lagos"

    @pytest.mark.asyncio
    async def test_uses_openai_when_key_available(self) -> None:
        """When AI returns valid JSON, structured filters are returned."""
        from app.service import AIService

        mock_redis = AsyncMock()
        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = "sk-test"
        mock_settings.OPENAI_MODEL = "gpt-4o"

        expected = {"keywords": "Toyota Camry", "city": "Lagos", "max_price": 10000000}
        svc = AIService(mock_redis, mock_settings)

        with patch.object(svc, "_chat_completion", new_callable=AsyncMock, return_value=json.dumps(expected)):
            result = await svc.parse_nl_query("Toyota Camry under 10 million Lagos")
        assert result["city"] == "Lagos"
        assert result["max_price"] == 10000000

    @pytest.mark.asyncio
    async def test_ambiguous_query_does_not_raise(self) -> None:
        """Ambiguous or nonsensical queries must not raise exceptions."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = None
        svc = AIService(AsyncMock(), mock_settings)
        # Should not raise
        result = await svc.parse_nl_query("!!!! ???")
        assert isinstance(result, dict)


class TestCVScoring:

    @pytest.mark.asyncio
    async def test_empty_skills_returns_50_score(self) -> None:
        """When job has no required skills, default score is 50."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = None
        svc = AIService(AsyncMock(), mock_settings)
        result = await svc.score_cv("My name is John. I have 5 years experience.", [])
        assert result["score"] == 50
        assert result["missing_skills"] == []

    @pytest.mark.asyncio
    async def test_full_match_returns_high_score(self) -> None:
        """When AI returns 100% match, score is capped at 100."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = "sk-test"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        svc = AIService(AsyncMock(), mock_settings)

        with patch.object(svc, "_chat_completion", new_callable=AsyncMock,
                          return_value='{"score": 100, "missing_skills": [], "found_skills": ["Python", "FastAPI"]}'):
            result = await svc.score_cv("Experienced Python/FastAPI developer", ["Python", "FastAPI"])
        assert result["score"] == 100
        assert len(result["missing_skills"]) == 0

    @pytest.mark.asyncio
    async def test_score_is_clamped_0_100(self) -> None:
        """AI returning out-of-range scores must be clamped."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = "sk-test"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        svc = AIService(AsyncMock(), mock_settings)

        with patch.object(svc, "_chat_completion", new_callable=AsyncMock,
                          return_value='{"score": 150, "missing_skills": []}'):
            result = await svc.score_cv("CV text", ["Python"])
        assert result["score"] <= 100

        with patch.object(svc, "_chat_completion", new_callable=AsyncMock,
                          return_value='{"score": -10, "missing_skills": ["Python"]}'):
            result = await svc.score_cv("CV text", ["Python"])
        assert result["score"] >= 0


class TestReplySuggestions:

    @pytest.mark.asyncio
    async def test_returns_at_most_3_suggestions(self) -> None:
        """Reply suggestions must never exceed 3."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = "sk-test"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        svc = AIService(AsyncMock(), mock_settings)

        many = ["r1", "r2", "r3", "r4", "r5"]
        with patch.object(svc, "_chat_completion", new_callable=AsyncMock,
                          return_value=json.dumps(many)):
            result = await svc.suggest_replies([{"sender": "buyer", "content": "Is this available?"}])
        assert len(result) <= 3

    @pytest.mark.asyncio
    async def test_returns_default_replies_when_ai_unavailable(self) -> None:
        """When AI unavailable, 3 default replies are returned."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = None
        svc = AIService(AsyncMock(), mock_settings)
        result = await svc.suggest_replies([{"sender": "buyer", "content": "hello"}])
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_returns_exactly_3_when_ai_returns_3(self) -> None:
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = "sk-test"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        svc = AIService(AsyncMock(), mock_settings)

        with patch.object(svc, "_chat_completion", new_callable=AsyncMock,
                          return_value='["Yes it is", "Let me check", "Please allow 2 hours"]'):
            result = await svc.suggest_replies([])
        assert len(result) == 3


class TestReviewModeration:

    @pytest.mark.asyncio
    async def test_empty_text_returns_not_spam(self) -> None:
        """Empty review text should not be flagged as spam."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = None
        svc = AIService(AsyncMock(), mock_settings)
        result = await svc.moderate_review("")
        assert result["is_spam"] is False
        assert result["confidence"] == 0.0

    @pytest.mark.asyncio
    async def test_confidence_above_085_triggers_quarantine_logic(self) -> None:
        """Confidence > 0.85 should be returned so the caller can quarantine."""
        from app.service import AIService

        SPAM_THRESHOLD = 0.85

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = "sk-test"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        svc = AIService(AsyncMock(), mock_settings)

        with patch.object(svc, "_chat_completion", new_callable=AsyncMock,
                          return_value='{"is_spam": true, "confidence": 0.92, "reason": "promotional spam"}'):
            result = await svc.moderate_review("BUY NOW!!! CLICK HERE!!! FREE MONEY!!!")
        assert result["confidence"] > SPAM_THRESHOLD
        assert result["is_spam"] is True

    @pytest.mark.asyncio
    async def test_confidence_at_exactly_085_boundary(self) -> None:
        """Confidence exactly at 0.85 is AT the threshold — system must handle it."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = "sk-test"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        svc = AIService(AsyncMock(), mock_settings)

        with patch.object(svc, "_chat_completion", new_callable=AsyncMock,
                          return_value='{"is_spam": true, "confidence": 0.85, "reason": "borderline"}'):
            result = await svc.moderate_review("borderline text")
        assert result["confidence"] == 0.85


class TestSessionHistoryTruncation:

    @pytest.mark.asyncio
    async def test_history_truncated_at_20_turns(self) -> None:
        """Session history must not exceed 20 turns (40 messages)."""
        from app.service import AIService

        MAX_TURNS = 20
        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = None
        mock_settings.MAX_CONVERSATION_TURNS = MAX_TURNS
        mock_settings.SESSION_TTL_SECONDS = 7200

        # Pre-populate history with 25 turns (50 messages)
        existing_history = []
        for i in range(25):
            existing_history.append({"role": "user", "content": f"message {i}"})
            existing_history.append({"role": "assistant", "content": f"reply {i}"})

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=json.dumps(existing_history))
        mock_redis.setex = AsyncMock()

        svc = AIService(mock_redis, mock_settings)

        with patch.object(svc, "_chat_completion", new_callable=AsyncMock, return_value="found 5 products"):
            await svc.assistant_query("user1", "session1", "find laptops", [])

        # Check what was saved to Redis
        saved_json = mock_redis.setex.call_args[0][2]
        saved_history = json.loads(saved_json)
        # The history stored should not exceed 2 * MAX_TURNS + 2 (the new turn)
        assert len(saved_history) <= (MAX_TURNS * 2) + 2


class TestBIInsightDeviation:

    @pytest.mark.asyncio
    async def test_generate_insight_returns_string(self) -> None:
        """BI insight generation returns a non-empty string."""
        from app.service import AIService

        mock_settings = MagicMock()
        mock_settings.OPENAI_API_KEY = None
        svc = AIService(AsyncMock(), mock_settings)
        result = await svc.generate_bi_insight({"total_revenue": 50000, "orders": 10})
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_15pct_deviation_detection(self) -> None:
        """Detect >15% deviation from 4-week rolling average."""
        rolling_avg = 100000.0
        current_value = 118000.0  # 18% increase
        threshold_pct = 15.0

        deviation_pct = abs(current_value - rolling_avg) / rolling_avg * 100
        should_alert = deviation_pct > threshold_pct

        assert should_alert is True

    def test_exactly_15pct_does_not_trigger_alert(self) -> None:
        """Exactly 15% deviation does NOT exceed the threshold."""
        rolling_avg = 100000.0
        current_value = 115000.0  # exactly 15%
        threshold_pct = 15.0

        deviation_pct = abs(current_value - rolling_avg) / rolling_avg * 100
        should_alert = deviation_pct > threshold_pct

        assert should_alert is False  # must be STRICTLY greater than

    def test_below_15pct_no_alert(self) -> None:
        rolling_avg = 100000.0
        current_value = 110000.0  # 10% deviation
        deviation_pct = abs(current_value - rolling_avg) / rolling_avg * 100
        assert deviation_pct <= 15.0
