"""Initial chat service schema.

Revision ID: 0001
Revises:
Create Date: 2026-06-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # ── threads ────────────────────────────────────────────────────────────────
    op.create_table(
        "threads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("participant_a", UUID(as_uuid=True), nullable=False),
        sa.Column("participant_b", UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("participant_a", "participant_b", "listing_id", name="uq_thread_participants"),
    )
    op.create_index("ix_threads_participant_a", "threads", ["participant_a"])
    op.create_index("ix_threads_participant_b", "threads", ["participant_b"])

    # ── messages ───────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("thread_id", UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", UUID(as_uuid=True), nullable=False),
        sa.Column("message_type", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("media_s3_key", sa.Text(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["thread_id"], ["threads.id"], name="fk_messages_thread_id", ondelete="CASCADE"),
        sa.CheckConstraint(
            "message_type IN ('text','voice_note','image','file')",
            name="ck_message_type",
        ),
    )
    op.create_index("ix_messages_thread_id", "messages", ["thread_id"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])

    # ── message_queue ──────────────────────────────────────────────────────────
    op.create_table(
        "message_queue",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recipient_id", UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", UUID(as_uuid=True), nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], name="fk_message_queue_message_id", ondelete="CASCADE"),
    )
    op.create_index("ix_message_queue_recipient_id", "message_queue", ["recipient_id"])


def downgrade() -> None:
    op.drop_table("message_queue")
    op.drop_table("messages")
    op.drop_table("threads")
