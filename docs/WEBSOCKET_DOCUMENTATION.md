# Velontri WebSocket Documentation

## Connection Protocol

**WebSocket URL:**
```
Development: ws://localhost:8006/api/v1/ws/chat?token=<access_token>
Production:  wss://api.velontri.com/api/v1/ws/chat?token=<access_token>
```

**Authentication:** JWT access token passed as `token` query parameter. This is required because WebSocket upgrade requests in browsers cannot carry custom headers. The server validates the token (RS256 signature, expiry, issuer) before accepting the connection.

**Protocol version:** 1.0 (text frames, JSON-encoded messages)

---

## Handshake

```
Client → Server:  GET /api/v1/ws/chat?token=eyJhbGciOiJSUzI1NiJ9...
                  Connection: Upgrade
                  Upgrade: websocket
                  Sec-WebSocket-Version: 13
                  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==

Server → Client:  HTTP/1.1 101 Switching Protocols
                  Connection: Upgrade
                  Upgrade: websocket
                  Sec-WebSocket-Accept: <computed>
```

If authentication fails:
```
Server → Client:  HTTP/1.1 403 Forbidden  (close code 4001)
```

---

## Message Format

All messages are UTF-8 encoded JSON text frames.

### Common fields

Every message has an `event` field identifying the message type:
```json
{ "event": "message_type", ...payload }
```

---

## Client → Server Events

### `message` — Send a chat message

```json
{
  "event": "message",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "recipient_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "content": "Is this item still available?"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `thread_id` | UUID string | Yes | Conversation thread ID |
| `recipient_id` | UUID string | Yes | Target user UUID |
| `type` | string | Yes | `text\|image\|audio\|file` |
| `content` | string | Conditional | Text content (for `type=text`) |

For media messages (`type=image|audio|file`), upload the file first via `POST /api/v1/chat/threads/{thread_id}/media?token=<token>`, then send the returned `s3_key` as:
```json
{
  "event": "message",
  "thread_id": "...",
  "recipient_id": "...",
  "type": "image",
  "content": null,
  "s3_key": "chat/threads/3d8e4b5c.../media/photo_001.jpg"
}
```

### `typing` — Typing indicator

```json
{
  "event": "typing",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "recipient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Send every 2 seconds while typing. Server auto-expires the indicator after 3 seconds.

### `read` — Mark message as read

```json
{
  "event": "read",
  "message_id": "msg-uuid-here",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Server → Client Events

### `message` — Incoming message

```json
{
  "event": "message",
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "content": "Yes, still available!",
  "media_s3_key": null,
  "created_at": "2025-01-15T10:30:00.123Z"
}
```

### `typing` — Peer is typing

```json
{
  "event": "typing",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Show indicator for 3 seconds; reset timer if another `typing` event arrives.

### `read_receipt` — Message was read

```json
{
  "event": "read_receipt",
  "message_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "read_by": "550e8400-e29b-41d4-a716-446655440000",
  "read_at": "2025-01-15T10:30:05.000Z"
}
```

---

## Offline Message Delivery

When the recipient is offline, messages are queued. On next WebSocket connection, the server delivers all queued messages before entering the live message loop.

---

## JavaScript / TypeScript Example

```typescript
class VelontriChat {
  private ws: WebSocket | null = null;
  private token: string;
  private attempt = 0;
  private shouldReconnect = true;

  onMessage?: (msg: ChatMessage) => void;
  onTyping?:  (event: TypingEvent) => void;
  onRead?:    (event: ReadEvent) => void;

  constructor(token: string) {
    this.token = token;
  }

  connect() {
    const url = `wss://api.velontri.com/api/v1/ws/chat?token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.attempt = 0;
      console.log('[VelontriChat] connected');
    };

    this.ws.onmessage = (e) => {
      const event = JSON.parse(e.data);
      switch (event.event) {
        case 'message':      this.onMessage?.(event); break;
        case 'typing':       this.onTyping?.(event);  break;
        case 'read_receipt': this.onRead?.(event);    break;
      }
    };

    this.ws.onclose = (e) => {
      if (!this.shouldReconnect || e.code === 4001) return;
      const delay = Math.min(1000 * Math.pow(2, this.attempt) + Math.random() * 500, 30000);
      setTimeout(() => { this.attempt++; this.connect(); }, delay);
    };
  }

  sendMessage(threadId: string, recipientId: string, content: string) {
    this.send({ event: 'message', thread_id: threadId, recipient_id: recipientId, type: 'text', content });
  }

  sendTyping(threadId: string, recipientId: string) {
    this.send({ event: 'typing', thread_id: threadId, recipient_id: recipientId });
  }

  markRead(messageId: string, threadId: string, senderId: string) {
    this.send({ event: 'read', message_id: messageId, thread_id: threadId, sender_id: senderId });
  }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.ws?.close(1000);
  }
}

// Usage
const chat = new VelontriChat(localStorage.getItem('access_token')!);
chat.onMessage = (msg) => addMessageToUI(msg);
chat.onTyping  = (e)   => showTypingIndicator(e.sender_id);
chat.connect();
chat.sendMessage('thread-uuid', 'recipient-uuid', 'Hello!');
```

---

## Flutter / Dart Example

```dart
import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';
import 'dart:async';

class VelontriChat {
  WebSocketChannel? _channel;
  String _token;
  int _attempt = 0;
  bool _shouldReconnect = true;
  Timer? _reconnectTimer;

  final StreamController<Map<String, dynamic>> _events =
      StreamController.broadcast();

  Stream<Map<String, dynamic>> get events => _events.stream;

  VelontriChat(this._token);

  void connect() {
    final uri = Uri.parse(
      'wss://api.velontri.com/api/v1/ws/chat?token=$_token',
    );
    _channel = WebSocketChannel.connect(uri);
    _attempt = 0;

    _channel!.stream.listen(
      (data) {
        final event = jsonDecode(data as String) as Map<String, dynamic>;
        _events.add(event);
      },
      onError: (e) => _scheduleReconnect(),
      onDone: () => _scheduleReconnect(),
    );
  }

  void send(Map<String, dynamic> payload) {
    _channel?.sink.add(jsonEncode(payload));
  }

  void sendMessage(String threadId, String recipientId, String content) {
    send({
      'event': 'message',
      'thread_id': threadId,
      'recipient_id': recipientId,
      'type': 'text',
      'content': content,
    });
  }

  void sendTyping(String threadId, String recipientId) {
    send({ 'event': 'typing', 'thread_id': threadId, 'recipient_id': recipientId });
  }

  void _scheduleReconnect() {
    if (!_shouldReconnect) return;
    final delay = Duration(
      milliseconds: (1000 * (1 << _attempt.clamp(0, 5))).clamp(1000, 30000),
    );
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(delay, () { _attempt++; connect(); });
  }

  void dispose() {
    _shouldReconnect = false;
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _events.close();
  }
}
```

---

## React Native Example

```javascript
// Using the native WebSocket API (same as browser)
import { AppState } from 'react-native';

class VelontriChat {
  constructor(token, handlers) {
    this.token = token;
    this.handlers = handlers;
    this.attempt = 0;
    this.shouldReconnect = true;

    // Reconnect when app comes to foreground
    AppState.addEventListener('change', (state) => {
      if (state === 'active' && !this.isConnected()) {
        this.connect();
      }
    });
  }

  connect() {
    this.ws = new WebSocket(
      `wss://api.velontri.com/api/v1/ws/chat?token=${this.token}`
    );

    this.ws.onopen  = () => { this.attempt = 0; };
    this.ws.onclose = (e) => {
      if (!this.shouldReconnect || e.code === 4001) return;
      const delay = Math.min(1000 * Math.pow(2, this.attempt++) + Math.random() * 500, 30000);
      setTimeout(() => this.connect(), delay);
    };
    this.ws.onmessage = (e) => {
      const event = JSON.parse(e.data);
      this.handlers[event.event]?.(event);
    };
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(payload) {
    if (this.isConnected()) this.ws.send(JSON.stringify(payload));
  }
}

// Usage in a component
const chat = new VelontriChat(authToken, {
  message:      (e) => dispatch(addMessage(e)),
  typing:       (e) => dispatch(setTyping(e.sender_id, true)),
  read_receipt: (e) => dispatch(markRead(e.message_id)),
});
chat.connect();
```
