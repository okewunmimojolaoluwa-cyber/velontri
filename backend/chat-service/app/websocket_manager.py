"""
WebSocket connection manager for the Chat Service.

Maintains in-process connection registry per user.
In production with multiple pods, Redis pub/sub is used to
fan-out messages across instances.
"""
from __future__ import annotations
import asyncio
import json
import uuid
from typing import Any
from fastapi import WebSocket
from shared.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # user_id -> list of active WebSocket connections
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, []).append(websocket)
        logger.debug("ws_connected", user_id=user_id, total_connections=len(self._connections[user_id]))

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(user_id, None)
        logger.debug("ws_disconnected", user_id=user_id)

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    async def send_to_user(self, user_id: str, data: dict[str, Any]) -> bool:
        """Send a message to all WebSocket connections for a user. Returns True if delivered."""
        conns = self._connections.get(user_id, [])
        if not conns:
            return False
        payload = json.dumps(data, default=str)
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)
        return len(conns) > len(dead)

    async def broadcast_typing(self, thread_id: str, sender_id: str, recipient_id: str) -> None:
        await self.send_to_user(recipient_id, {
            "event": "typing",
            "thread_id": thread_id,
            "sender_id": sender_id,
        })

    async def broadcast_read_receipt(self, message_id: str, thread_id: str, recipient_id: str) -> None:
        await self.send_to_user(recipient_id, {
            "event": "read_receipt",
            "message_id": message_id,
            "thread_id": thread_id,
        })


# Global connection manager instance (shared per process)
manager = ConnectionManager()
