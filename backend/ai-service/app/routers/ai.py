"""AI Service router — all AI capability endpoints."""
from __future__ import annotations
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from pydantic import BaseModel, Field
from shared.errors import SuccessResponse
from shared.jwt_utils import verify_token
from ..config import AISettings, get_settings
from ..service import AIService

router = APIRouter(prefix="/ai", tags=["AI"])


def _settings() -> AISettings:
    return get_settings()


def _user(token: str = Query(...), settings: AISettings = Depends(_settings)) -> dict:
    return verify_token(settings.JWT_PUBLIC_KEY_PATH, token)


def _optional_user(token: str = Query(default=""), settings: AISettings = Depends(_settings)) -> dict | None:
    if not token:
        return None
    try:
        return verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
    except Exception:
        return None


def _svc(request: Request, settings: AISettings = Depends(_settings)) -> AIService:
    return AIService(redis=request.app.state.redis, settings=settings)


# ── Search AI ─────────────────────────────────────────────────────────────────

class NLParseRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)


@router.post("/search/parse", response_model=SuccessResponse)
async def parse_nl_query(body: NLParseRequest, svc: AIService = Depends(_svc)) -> SuccessResponse:
    result = await svc.parse_nl_query(body.query)
    return SuccessResponse(data=result)


@router.post("/search/transcribe", response_model=SuccessResponse)
async def transcribe_audio(svc: AIService = Depends(_svc), file: UploadFile = File(...)) -> SuccessResponse:
    content = await file.read()
    text = await svc.transcribe_audio(content, file.content_type or "audio/mpeg")
    return SuccessResponse(data={"transcript": text or ""})


# ── Commerce assistant ────────────────────────────────────────────────────────

class AssistantQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    search_results: list[dict] = Field(default_factory=list)


class CompareRequest(BaseModel):
    listing_ids: list[str] = Field(..., min_items=2, max_items=10)
    listing_data: list[dict] = Field(..., min_items=2)


@router.post("/assistant/query", response_model=SuccessResponse)
async def assistant_query(body: AssistantQueryRequest, svc: AIService = Depends(_svc), payload: dict = Depends(_user)) -> SuccessResponse:
    user_id = payload["sub"]
    result = await svc.assistant_query(user_id, body.session_id, body.query, body.search_results)
    return SuccessResponse(data=result)


@router.post("/assistant/compare", response_model=SuccessResponse)
async def compare_listings(body: CompareRequest, svc: AIService = Depends(_svc), payload: dict = Depends(_user)) -> SuccessResponse:
    result = await svc.compare_listings(body.listing_ids, body.listing_data)
    return SuccessResponse(data=result)


# ── CV scoring ────────────────────────────────────────────────────────────────

class CVScoreRequest(BaseModel):
    cv_text: str = Field(..., max_length=20000)
    required_skills: list[str] = Field(default_factory=list)


class InterviewPrepRequest(BaseModel):
    job_title: str = Field(..., max_length=200)
    required_skills: list[str] = Field(default_factory=list)


@router.post("/cv/score", response_model=SuccessResponse)
async def score_cv(body: CVScoreRequest, svc: AIService = Depends(_svc)) -> SuccessResponse:
    result = await svc.score_cv(body.cv_text, body.required_skills)
    return SuccessResponse(data=result)


@router.post("/interview/prep", response_model=SuccessResponse)
async def interview_prep(body: InterviewPrepRequest, svc: AIService = Depends(_svc), payload: dict = Depends(_user)) -> SuccessResponse:
    questions = await svc.generate_interview_questions(body.job_title, body.required_skills)
    return SuccessResponse(data={"questions": questions})


# ── Review moderation ─────────────────────────────────────────────────────────

class ModerateReviewRequest(BaseModel):
    text: str = Field(..., max_length=2000)


@router.post("/review/moderate", response_model=SuccessResponse)
async def moderate_review(body: ModerateReviewRequest, svc: AIService = Depends(_svc)) -> SuccessResponse:
    result = await svc.moderate_review(body.text)
    return SuccessResponse(data=result)


# ── Chat AI ───────────────────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text: str = Field(..., max_length=5000)
    target_language: str = Field(..., max_length=50)


class SuggestReplyRequest(BaseModel):
    messages: list[dict] = Field(..., min_items=1, max_items=20)


@router.post("/chat/translate", response_model=SuccessResponse)
async def translate(body: TranslateRequest, svc: AIService = Depends(_svc)) -> SuccessResponse:
    result = await svc.translate_message(body.text, body.target_language)
    return SuccessResponse(data={"translated": result})


@router.post("/chat/suggest-reply", response_model=SuccessResponse)
async def suggest_reply(body: SuggestReplyRequest, svc: AIService = Depends(_svc), payload: dict = Depends(_user)) -> SuccessResponse:
    suggestions = await svc.suggest_replies(body.messages)
    return SuccessResponse(data={"suggestions": suggestions})


# ── Business Intelligence ─────────────────────────────────────────────────────

class BIInsightRequest(BaseModel):
    metrics: dict


class BIQuestionRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    analytics_data: dict


@router.post("/bi/insights", response_model=SuccessResponse)
async def generate_insight(body: BIInsightRequest, svc: AIService = Depends(_svc)) -> SuccessResponse:
    insight = await svc.generate_bi_insight(body.metrics)
    return SuccessResponse(data={"insight": insight})


@router.post("/bi/question", response_model=SuccessResponse)
async def answer_bi_question(body: BIQuestionRequest, svc: AIService = Depends(_svc), payload: dict = Depends(_user)) -> SuccessResponse:
    answer = await svc.answer_business_question(body.question, body.analytics_data)
    return SuccessResponse(data={"answer": answer})
