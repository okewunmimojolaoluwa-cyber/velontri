"""Chat Service data access layer."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import and_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Message, MessageQueue, Thread


async def get_or_create_thread(session: AsyncSession, participant_a: uuid.UUID, participant_b: uuid.UUID, listing_id: uuid.UUID | None) -> tuple[Thread, bool]:
    # Ensure consistent ordering of participants (so A→B and B→A produce the same thread)
    a, b = (participant_a, participant_b) if str(participant_a) < str(participant_b) else (participant_b, participant_a)
    a_str, b_str = str(a), str(b)
    lid_str = str(listing_id) if listing_id else None

    # Use raw SQL for UUID string comparison (SQLite stores UUIDs as strings)
    if listing_id is not None:
        result = await session.execute(
            text("SELECT id, participant_a, participant_b, listing_id, created_at FROM threads "
                 "WHERE CAST(participant_a AS TEXT) = :a AND CAST(participant_b AS TEXT) = :b "
                 "AND CAST(listing_id AS TEXT) = :lid LIMIT 1"),
            {"a": a_str, "b": b_str, "lid": lid_str},
        )
    else:
        result = await session.execute(
            text("SELECT id, participant_a, participant_b, listing_id, created_at FROM threads "
                 "WHERE CAST(participant_a AS TEXT) = :a AND CAST(participant_b AS TEXT) = :b "
                 "AND listing_id IS NULL LIMIT 1"),
            {"a": a_str, "b": b_str},
        )
    row = result.fetchone()
    if row:
        # Reconstruct a Thread-like object from the raw row
        thread = Thread.__new__(Thread)
        thread.id = uuid.UUID(str(row[0])) if row[0] else uuid.uuid4()
        thread.participant_a = uuid.UUID(str(row[1])) if row[1] else a
        thread.participant_b = uuid.UUID(str(row[2])) if row[2] else b
        thread.listing_id = uuid.UUID(str(row[3])) if row[3] else None
        thread.created_at = row[4]
        return thread, False

    # Create a new thread
    thread = Thread(participant_a=a, participant_b=b, listing_id=listing_id)
    session.add(thread)
    await session.flush()
    return thread, True


async def create_message(session: AsyncSession, thread_id: uuid.UUID, sender_id: uuid.UUID, message_type: str, content: str | None, media_s3_key: str | None) -> Message:
    msg = Message(thread_id=thread_id, sender_id=sender_id, message_type=message_type, content=content, media_s3_key=media_s3_key)
    session.add(msg)
    await session.flush()
    return msg


async def get_thread_messages(session: AsyncSession, thread_id: uuid.UUID, limit: int = 500) -> list[Message]:
    result = await session.execute(select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.desc()).limit(limit))
    return list(reversed(result.scalars().all()))


async def mark_message_read(session: AsyncSession, message_id: uuid.UUID) -> None:
    await session.execute(update(Message).where(and_(Message.id == message_id, Message.read_at.is_(None))).values(read_at=datetime.now(tz=timezone.utc)))


async def queue_message(session: AsyncSession, recipient_id: uuid.UUID, message_id: uuid.UUID) -> None:
    session.add(MessageQueue(recipient_id=recipient_id, message_id=message_id))
    await session.flush()


async def get_queued_messages(session: AsyncSession, recipient_id: uuid.UUID) -> list[MessageQueue]:
    result = await session.execute(select(MessageQueue).where(MessageQueue.recipient_id == recipient_id).order_by(MessageQueue.queued_at.asc()))
    return list(result.scalars().all())


async def delete_queued_message(session: AsyncSession, queue_id: uuid.UUID) -> None:
    from sqlalchemy import delete
    await session.execute(delete(MessageQueue).where(MessageQueue.id == queue_id))
