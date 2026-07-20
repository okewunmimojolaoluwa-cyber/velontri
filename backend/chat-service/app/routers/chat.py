"""Chat Service HTTP and WebSocket router."""
from __future__ import annotations
import json
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, WebSocket, WebSocketDisconnect, status
from shared.errors import SuccessResponse, UnauthorizedError, ForbiddenError
from shared.jwt_utils import verify_token
from shared.logging import get_logger
from shared.redis_client import RedisKeys
from shared.s3 import S3Keys, UploadCategory, validate_upload, upload_file
from ..config import ChatSettings, get_settings
from ..models import Message, Thread
from ..repository import (create_message, delete_queued_message, get_or_create_thread, get_queued_messages, get_thread_messages, mark_message_read, queue_message)
from ..websocket_manager import manager
import httpx

logger = get_logger(__name__)
router = APIRouter(tags=["Chat"])


def _get_settings() -> ChatSettings:
    return get_settings()


async def _get_session(request: Request):  # type: ignore[return]
    session = request.app.state.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def _get_redis(request: Request):
    return request.app.state.redis


@router.websocket("/ws/chat")
async def websocket_chat(
    websocket: WebSocket,
    token: str = Query(...),
    request: Request = None,  # type: ignore[assignment]
    settings: ChatSettings = Depends(_get_settings),
) -> None:
    """WebSocket endpoint — JWT passed as query parameter for WS upgrade."""
    try:
        payload = verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(user_id, websocket)
    redis = websocket.app.state.redis
    session_factory = websocket.app.state.session_factory

    # Set online status in Redis
    await redis.setex(RedisKeys.chat_online(user_id), settings.ONLINE_STATUS_TTL, "1")

    # Deliver queued messages on reconnect
    async with session_factory() as session:
        queued = await get_queued_messages(session, uuid.UUID(user_id))
        for item in queued:
            result = await session.get(Message, item.message_id)
            if result:
                await manager.send_to_user(user_id, {
                    "event": "message",
                    "id": str(result.id),
                    "thread_id": str(result.thread_id),
                    "sender_id": str(result.sender_id),
                    "type": result.message_type,
                    "content": result.content,
                    "media_s3_key": result.media_s3_key,
                    "created_at": str(result.created_at),
                })
            await delete_queued_message(session, item.id)
        await session.commit()

    try:
        while True:
            raw = await websocket.receive_text()
            # Refresh online TTL on each message
            await redis.setex(RedisKeys.chat_online(user_id), settings.ONLINE_STATUS_TTL, "1")

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event = data.get("event")

            if event == "typing":
                thread_id = data.get("thread_id", "")
                recipient_id = data.get("recipient_id", "")
                if thread_id and recipient_id:
                    await redis.setex(RedisKeys.chat_typing(thread_id, user_id), settings.TYPING_INDICATOR_TTL, "1")
                    await manager.broadcast_typing(thread_id, user_id, recipient_id)

            elif event == "read":
                message_id = data.get("message_id")
                thread_id = data.get("thread_id", "")
                sender_id = data.get("sender_id", "")
                if message_id:
                    async with session_factory() as session:
                        await mark_message_read(session, uuid.UUID(message_id))
                        await session.commit()
                    if sender_id:
                        await manager.broadcast_read_receipt(message_id, thread_id, sender_id)

            elif event == "message":
                thread_id = data.get("thread_id")
                recipient_id = data.get("recipient_id")
                msg_type = data.get("type", "text")
                content = data.get("content")

                if not thread_id or not recipient_id:
                    continue

                async with session_factory() as session:
                    msg = await create_message(
                        session, uuid.UUID(thread_id), uuid.UUID(user_id),
                        msg_type, content, None
                    )
                    await session.commit()

                    msg_payload = {
                        "event": "message",
                        "id": str(msg.id),
                        "thread_id": thread_id,
                        "sender_id": user_id,
                        "type": msg_type,
                        "content": content,
                        "created_at": str(msg.created_at),
                    }

                    delivered = await manager.send_to_user(recipient_id, msg_payload)
                    if not delivered:
                        async with session_factory() as s2:
                            await queue_message(s2, uuid.UUID(recipient_id), msg.id)
                            await s2.commit()

    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        await redis.delete(RedisKeys.chat_online(user_id))


@router.post(
    "/chat/messages",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message via REST (creates thread if needed)",
)
async def send_message_rest(
    request: Request,
    settings: ChatSettings = Depends(_get_settings),
) -> SuccessResponse:
    """
    REST fallback for sending a message — used when WebSocket is not available.
    Body: { recipient_id, content, listing_id? }
    """
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    from fastapi import Header
    import re

    # Extract JWT from Authorization header
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise UnauthorizedError("Authentication required.")

    try:
        payload = verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
        sender_id = uuid.UUID(payload["sub"])
    except Exception as exc:
        raise UnauthorizedError("Invalid or expired token.") from exc

    body = await request.json()
    recipient_id_str = body.get("recipient_id", "")
    content = body.get("content", "").strip()
    listing_id_str = body.get("listing_id")

    if not recipient_id_str or not content:
        from shared.errors import InvalidInputError
        raise InvalidInputError("recipient_id and content are required.")

    try:
        recipient_id = uuid.UUID(str(recipient_id_str))
    except ValueError:
        from shared.errors import InvalidInputError
        raise InvalidInputError("Invalid recipient_id.")

    listing_id: uuid.UUID | None = None
    if listing_id_str:
        try:
            listing_id = uuid.UUID(str(listing_id_str))
        except ValueError:
            pass

    async with request.app.state.session_factory() as session:
        # Get or create thread between sender and recipient for this listing
        thread, _ = await get_or_create_thread(session, sender_id, recipient_id, listing_id)
        # Create the message
        msg = await create_message(session, thread.id, sender_id, "text", content, None)
        await session.commit()

        # Try to deliver via WebSocket if recipient is online
        msg_payload = {
            "event": "message",
            "id": str(msg.id),
            "thread_id": str(thread.id),
            "sender_id": str(sender_id),
            "type": "text",
            "content": content,
            "created_at": str(msg.created_at),
        }
        delivered = await manager.send_to_user(str(recipient_id), msg_payload)
        if not delivered:
            # Queue for delivery when recipient reconnects
            async with request.app.state.session_factory() as s2:
                await queue_message(s2, recipient_id, msg.id)
                await s2.commit()

    return SuccessResponse(
        message="Message sent.",
        data={
            "message_id": str(msg.id),
            "thread_id": str(thread.id),
            "delivered": delivered,
        },
    )


@router.get(
    "/chat/inbox",
    response_model=SuccessResponse,
    summary="Get the authenticated user's chat inbox threads (with user names)",
)
async def get_inbox(
    request: Request,
    settings: ChatSettings = Depends(_get_settings),
) -> SuccessResponse:
    """Returns all chat threads for the authenticated user using raw SQL."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise UnauthorizedError("Authentication required.")
    try:
        payload = verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
        user_id = str(payload["sub"])
    except Exception as exc:
        raise UnauthorizedError("Invalid token.") from exc

    from sqlalchemy import text as _text
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            _text("""
                SELECT
                    t.id,
                    t.participant_a,
                    t.participant_b,
                    t.listing_id,
                    t.created_at,
                    m.content      AS last_message,
                    m.created_at   AS last_message_at,
                    ua.full_name   AS name_a,
                    ub.full_name   AS name_b
                FROM threads t
                LEFT JOIN messages m ON m.id = (
                    SELECT id FROM messages WHERE thread_id = t.id
                    ORDER BY created_at DESC LIMIT 1
                )
                LEFT JOIN users ua ON CAST(ua.id AS TEXT) = CAST(t.participant_a AS TEXT)
                LEFT JOIN users ub ON CAST(ub.id AS TEXT) = CAST(t.participant_b AS TEXT)
                WHERE CAST(t.participant_a AS TEXT) = :uid
                   OR CAST(t.participant_b AS TEXT) = :uid
                ORDER BY COALESCE(m.created_at, t.created_at) DESC
            """),
            {"uid": user_id},
        )
        rows = result.fetchall()

    threads = []
    for r in rows:
        pa = str(r[1]) if r[1] else ""
        pb = str(r[2]) if r[2] else ""
        name_a = r[7] or pa[:8]
        name_b = r[8] or pb[:8]
        other = pb if pa == user_id else pa
        other_name = name_b if pa == user_id else name_a
        threads.append({
            "id": str(r[0]),
            "participant_a": pa,
            "participant_b": pb,
            "other_user_id": other,
            "other_user_name": other_name or other[:8] or "User",
            "listing_id": str(r[3]) if r[3] else None,
            "created_at": str(r[4]),
            "last_message": r[5],
            "last_message_at": str(r[6]) if r[6] else None,
        })
    return SuccessResponse(message=f"{len(threads)} thread(s) found.", data=threads)


@router.get(
    "/chat/inbox/{thread_id}/messages",
    response_model=SuccessResponse,
    summary="Get messages in a specific thread (auth via Bearer header)",
)
async def get_inbox_thread_messages(
    thread_id: str,
    request: Request,
    settings: ChatSettings = Depends(_get_settings),
) -> SuccessResponse:
    """Returns messages for a thread — auth via Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise UnauthorizedError("Authentication required.")
    try:
        payload = verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
    except Exception as exc:
        raise UnauthorizedError("Invalid token.") from exc

    from sqlalchemy import text as _text
    async with request.app.state.session_factory() as session:
        rows_result = await session.execute(
            _text("""
                SELECT id, thread_id, sender_id, message_type, content, read_at, created_at
                FROM messages
                WHERE CAST(thread_id AS TEXT) = :tid
                ORDER BY created_at ASC
            """),
            {"tid": thread_id},
        )
        rows = rows_result.fetchall()

    messages = [
        {
            "id": str(r[0]),
            "thread_id": str(r[1]),
            "sender_id": str(r[2]),
            "type": r[3],
            "content": r[4],
            "read_at": str(r[5]) if r[5] else None,
            "created_at": str(r[6]),
        }
        for r in rows
    ]
    return SuccessResponse(message=f"{len(messages)} message(s).", data=messages)


async def list_threads(
    request: Request,
    token: str = Query(...),
    settings: ChatSettings = Depends(_get_settings),
) -> SuccessResponse:
    payload = verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
    user_id = uuid.UUID(payload["sub"])
    from sqlalchemy import or_, select
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(Thread).where(or_(Thread.participant_a == user_id, Thread.participant_b == user_id)).order_by(Thread.created_at.desc())
        )
        threads = result.scalars().all()
    return SuccessResponse(data=[{"id": str(t.id), "participant_a": str(t.participant_a), "participant_b": str(t.participant_b), "listing_id": str(t.listing_id) if t.listing_id else None, "created_at": str(t.created_at)} for t in threads])


@router.get("/chat/threads/{thread_id}/messages", response_model=SuccessResponse, summary="Get message history (last 500)")
async def get_messages(
    thread_id: uuid.UUID,
    request: Request,
    token: str = Query(...),
    settings: ChatSettings = Depends(_get_settings),
) -> SuccessResponse:
    verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
    async with request.app.state.session_factory() as session:
        messages = await get_thread_messages(session, thread_id, limit=500)
    return SuccessResponse(data=[{
        "id": str(m.id), "thread_id": str(m.thread_id), "sender_id": str(m.sender_id),
        "type": m.message_type, "content": m.content, "media_s3_key": m.media_s3_key,
        "read_at": str(m.read_at) if m.read_at else None, "created_at": str(m.created_at),
    } for m in messages])


@router.post("/chat/threads/{thread_id}/media", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary="Upload media file for chat")
async def upload_chat_media(
    thread_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    token: str = Query(...),
    settings: ChatSettings = Depends(_get_settings),
) -> SuccessResponse:
    payload = verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
    user_id = payload["sub"]
    content = await file.read()
    # Detect media type
    import magic
    mime = magic.from_buffer(content, mime=True)
    from shared.s3 import ALLOWED_IMAGE_MIMES, ALLOWED_VIDEO_MIMES, ALLOWED_AUDIO_MIMES
    if mime in ALLOWED_AUDIO_MIMES and len(content) <= 5 * 1024 * 1024:
        category = UploadCategory.CHAT_VOICE
    elif mime in ALLOWED_IMAGE_MIMES and len(content) <= 10 * 1024 * 1024:
        category = UploadCategory.CHAT_IMAGE
    else:
        category = UploadCategory.CHAT_FILE
    validate_upload(content, category, file.filename or "")
    s3_key = S3Keys.chat_media(str(thread_id))
    return SuccessResponse(data={"s3_key": s3_key, "media_type": mime})
