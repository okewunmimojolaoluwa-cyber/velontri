"""Chat Service ORM models."""
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from shared.database import Base

from datetime import timezone as _tz

def _utc_now():
    from datetime import datetime as _dt
    return _dt.now(tz=_tz.utc)


class Thread(Base):
    __tablename__ = "threads"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_a: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    participant_b: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    listing_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    __table_args__ = (
        UniqueConstraint("participant_a", "participant_b", "listing_id", name="uq_thread_participants"),
        Index("ix_threads_participant_a", "participant_a"),
        Index("ix_threads_participant_b", "participant_b"),
    )


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    message_type: Mapped[str] = mapped_column(String(20), nullable=False)  # text|voice_note|image|file
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    __table_args__ = (
        Index("ix_messages_thread_id", "thread_id"),
        Index("ix_messages_created_at", "created_at"),
    )


class MessageQueue(Base):
    __tablename__ = "message_queue"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    __table_args__ = (Index("ix_message_queue_recipient_id", "recipient_id"),)
