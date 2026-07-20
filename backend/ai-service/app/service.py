"""
AI Service business logic.

All AI calls are wrapped with proper timeout handling and graceful fallbacks.
Never exposes raw OpenAI errors — always returns structured responses.
"""
from __future__ import annotations
import json
import uuid
from typing import Any
import httpx
from redis.asyncio import Redis
from shared.logging import get_logger
from shared.redis_client import RedisKeys
from .config import AISettings

logger = get_logger(__name__)


class AIService:
    def __init__(self, redis: Redis, settings: AISettings) -> None:
        self.redis = redis
        self.settings = settings
        self._client: Any = None

    def _get_client(self):  # type: ignore[return]
        """Lazy initialise OpenAI client."""
        if self._client is None and self.settings.OPENAI_API_KEY:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=self.settings.OPENAI_API_KEY)
        return self._client

    async def _chat_completion(self, messages: list[dict], max_tokens: int = 500, temperature: float = 0.3) -> str | None:
        """Call OpenAI chat completion. Returns None on any failure."""
        client = self._get_client()
        if client is None:
            return None
        try:
            resp = await client.chat.completions.create(
                model=self.settings.OPENAI_MODEL,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return resp.choices[0].message.content
        except Exception:
            logger.warning("openai_call_failed", exc_info=True)
            return None

    # ── Search ────────────────────────────────────────────────────────────────

    async def parse_nl_query(self, query: str) -> dict:
        """Extract structured search filters from a natural-language query."""
        system = "You are a search query parser for an African commerce platform. Extract search filters from the user query as JSON with fields: keywords, category, min_price, max_price, currency, city, country, brand, condition."
        result = await self._chat_completion([{"role": "system", "content": system}, {"role": "user", "content": query}], max_tokens=200)
        if result:
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                pass
        # Fallback: treat entire query as keyword search
        return {"keywords": query}

    async def transcribe_audio(self, audio_bytes: bytes, content_type: str) -> str | None:
        """Transcribe audio using OpenAI Whisper."""
        client = self._get_client()
        if client is None:
            return None
        try:
            import io
            ext_map = {"audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/webm": "webm"}
            ext = ext_map.get(content_type, "mp3")
            resp = await client.audio.transcriptions.create(model="whisper-1", file=(f"audio.{ext}", io.BytesIO(audio_bytes), content_type))
            return resp.text
        except Exception:
            logger.warning("transcription_failed", exc_info=True)
            return None

    # ── Commerce assistant ────────────────────────────────────────────────────

    async def assistant_query(self, user_id: str, session_id: str, query: str, search_results: list[dict]) -> dict:
        """Answer a product query with conversation history."""
        session_key = RedisKeys.ai_session(user_id, session_id)
        history_raw = await self.redis.get(session_key)
        history: list[dict] = json.loads(history_raw) if history_raw else []
        # Truncate to max turns
        max_turns = self.settings.MAX_CONVERSATION_TURNS
        if len(history) >= max_turns * 2:
            history = history[-(max_turns * 2):]

        context = f"Available products: {json.dumps(search_results[:5], default=str)}"
        messages = [
            {"role": "system", "content": f"You are Velontri's AI commerce assistant. Help the user find products on the platform.\n{context}"},
            *history,
            {"role": "user", "content": query},
        ]
        answer = await self._chat_completion(messages, max_tokens=300)
        if answer is None:
            answer = f"I found {len(search_results)} results matching your search."

        history.extend([{"role": "user", "content": query}, {"role": "assistant", "content": answer}])
        await self.redis.setex(session_key, self.settings.SESSION_TTL_SECONDS, json.dumps(history))
        return {"answer": answer, "products": search_results[:10]}

    async def compare_listings(self, listing_ids: list[str], listing_data: list[dict]) -> dict:
        """Compare up to 10 listings side-by-side."""
        if len(listing_data) < 2:
            return {"comparison": [], "summary": "Need at least 2 listings to compare."}
        prompt = f"Compare these products side-by-side for an African consumer. Products: {json.dumps(listing_data, default=str)}"
        summary = await self._chat_completion([{"role": "system", "content": "You are a product comparison expert."}, {"role": "user", "content": prompt}], max_tokens=400)
        return {"comparison": listing_data, "summary": summary or "Comparison complete."}

    async def suggest_alternatives(self, query: str, search_results: list[dict]) -> list[dict]:
        """Suggest up to 5 alternatives when no exact match found."""
        if not search_results:
            return []
        prompt = f"The user searched for '{query}' but found no exact match. From these products, suggest up to 5 alternatives with a brief explanation: {json.dumps(search_results[:10], default=str)}. Return JSON array with fields: id, title, explanation."
        result = await self._chat_completion([{"role": "system", "content": "Return only valid JSON."}, {"role": "user", "content": prompt}], max_tokens=500)
        if result:
            try:
                alternatives = json.loads(result)
                return alternatives[:5]
            except Exception:
                pass
        return [{"id": r.get("id"), "title": r.get("title"), "explanation": "Similar product"} for r in search_results[:5]]

    # ── CV scoring ────────────────────────────────────────────────────────────

    async def score_cv(self, cv_text: str, required_skills: list[str]) -> dict:
        """Score a CV against required job skills. Returns 0-100 score and missing skills."""
        if not required_skills:
            return {"score": 50, "missing_skills": [], "summary": "No specific skills required."}
        prompt = f"Score this CV against the required skills {required_skills}. CV excerpt: {cv_text[:2000]}. Return JSON: {{score: 0-100, missing_skills: [], found_skills: []}}"
        result = await self._chat_completion([{"role": "system", "content": "Return only valid JSON."}, {"role": "user", "content": prompt}], max_tokens=300)
        if result:
            try:
                data = json.loads(result)
                return {"score": min(100, max(0, int(data.get("score", 50)))), "missing_skills": data.get("missing_skills", []), "found_skills": data.get("found_skills", [])}
            except Exception:
                pass
        return {"score": 50, "missing_skills": [], "summary": "Scoring unavailable."}

    async def generate_interview_questions(self, job_title: str, required_skills: list[str]) -> list[str]:
        """Generate 5-10 interview questions for a job."""
        prompt = f"Generate 7 interview questions for a {job_title} role requiring these skills: {required_skills}. Return JSON array of strings."
        result = await self._chat_completion([{"role": "system", "content": "Return only a JSON array of strings."}, {"role": "user", "content": prompt}], max_tokens=400)
        if result:
            try:
                questions = json.loads(result)
                if isinstance(questions, list):
                    return questions[:10]
            except Exception:
                pass
        return [f"Describe your experience with {skill}." for skill in (required_skills or ["relevant tools"])[:5]]

    # ── Review moderation ─────────────────────────────────────────────────────

    async def moderate_review(self, text: str) -> dict:
        """Classify review text for spam/abuse. Returns confidence score."""
        if not text.strip():
            return {"is_spam": False, "confidence": 0.0}
        prompt = f"Is this product review spam or abusive? Text: '{text[:500]}'. Return JSON: {{is_spam: bool, confidence: 0.0-1.0, reason: string}}"
        result = await self._chat_completion([{"role": "system", "content": "Return only valid JSON. Confidence 0=not spam, 1=definitely spam."}, {"role": "user", "content": prompt}], max_tokens=100)
        if result:
            try:
                data = json.loads(result)
                confidence = float(data.get("confidence", 0.0))
                return {"is_spam": data.get("is_spam", False), "confidence": confidence, "reason": data.get("reason", "")}
            except Exception:
                pass
        return {"is_spam": False, "confidence": 0.0}

    # ── Chat AI ───────────────────────────────────────────────────────────────

    async def translate_message(self, text: str, target_language: str) -> str:
        """Translate a chat message. Returns original on failure."""
        prompt = f"Translate this to {target_language}: {text}"
        result = await self._chat_completion([{"role": "system", "content": f"Translate to {target_language}. Return only the translation."}, {"role": "user", "content": text}], max_tokens=200)
        return result or text

    async def suggest_replies(self, last_messages: list[dict]) -> list[str]:
        """Generate up to 3 contextual reply suggestions."""
        context = "\n".join([f"{m.get('sender', 'User')}: {m.get('content', '')}" for m in last_messages[-5:]])
        result = await self._chat_completion([{"role": "system", "content": "Suggest 3 short, professional replies for a commerce chat. Return JSON array of 3 strings."}, {"role": "user", "content": f"Conversation:\n{context}"}], max_tokens=200)
        if result:
            try:
                replies = json.loads(result)
                if isinstance(replies, list):
                    return [str(r) for r in replies[:3]]
            except Exception:
                pass
        return ["Okay, sounds good.", "Let me check and get back to you.", "Thank you for your message."]

    # ── Business Intelligence ─────────────────────────────────────────────────

    async def generate_bi_insight(self, metrics: dict) -> str:
        """Generate natural-language business insight from metrics data."""
        prompt = f"Generate a concise business insight (max 2 sentences) from these metrics: {json.dumps(metrics, default=str)}"
        result = await self._chat_completion([{"role": "system", "content": "You are a business analytics AI for an African commerce platform. Be specific with numbers."}, {"role": "user", "content": prompt}], max_tokens=150)
        return result or "Metrics are within normal range."

    async def answer_business_question(self, question: str, analytics_data: dict) -> str:
        """Answer a free-text business question using the seller's analytics data."""
        context = json.dumps(analytics_data, default=str)
        result = await self._chat_completion([{"role": "system", "content": f"You are a business analytics AI. Use this data to answer: {context}"}, {"role": "user", "content": question}], max_tokens=300)
        return result or "I don't have enough data to answer that question."
