# Velontri Real-Time Events

## WebSocket Connection

### Chat WebSocket

**URL:** `wss://api.velontri.com/api/v1/ws/chat?token=<access_token>`

The JWT is passed as a query parameter because the WebSocket upgrade request cannot carry an `Authorization` header in browsers. The token is validated server-side before the connection is accepted. If invalid, the connection is closed with code `4001`.

```javascript
// JavaScript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(`wss://api.velontri.com/api/v1/ws/chat?token=${token}`);

ws.onopen    = () => console.log('Connected');
ws.onclose   = (e) => handleClose(e.code);
ws.onerror   = (e) => console.error('WS error', e);
ws.onmessage = (e) => handleEvent(JSON.parse(e.data));
```

**Close codes:**
| Code | Meaning |
|---|---|
| 4001 | Authentication failed (invalid/expired token) |
| 4002 | Rate limit exceeded |
| 1000 | Normal closure |
| 1006 | Abnormal closure (network loss) |

---

## Reconnection Strategy

Use exponential backoff with jitter. Never hammer the server on reconnect.

```typescript
class VelontriWebSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private readonly maxAttempts = 8;
  private readonly baseDelay = 1000; // ms
  private shouldReconnect = true;

  connect(token: string) {
    this.ws = new WebSocket(
      `wss://api.velontri.com/api/v1/ws/chat?token=${token}`
    );
    this.ws.onopen = () => { this.attempt = 0; };
    this.ws.onclose = (e) => {
      if (!this.shouldReconnect || e.code === 4001) return; // auth fail — don't retry
      const delay = Math.min(
        this.baseDelay * Math.pow(2, this.attempt) + Math.random() * 1000,
        30000 // cap at 30s
      );
      this.attempt++;
      if (this.attempt <= this.maxAttempts) {
        setTimeout(() => this.connect(token), delay);
      }
    };
    this.ws.onmessage = (e) => this.handleEvent(JSON.parse(e.data));
  }

  disconnect() {
    this.shouldReconnect = false;
    this.ws?.close(1000);
  }

  send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handleEvent(event: any) {
    switch (event.event) {
      case 'message':      this.onMessage(event);     break;
      case 'typing':       this.onTyping(event);      break;
      case 'read_receipt': this.onReadReceipt(event); break;
      case 'online':       this.onOnlineStatus(event);break;
      default:             console.warn('Unknown event', event.event);
    }
  }
}
```

---

## Client → Server Events

### Send a Text Message

```json
{
  "event": "message",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "recipient_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "content": "Is this item still available?"
}
```

### Send Typing Indicator

```json
{
  "event": "typing",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "recipient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Typing indicators expire automatically after 3 seconds server-side (configured via `TYPING_INDICATOR_TTL`). Send every 2 seconds while the user is typing.

### Mark Message as Read

```json
{
  "event": "read",
  "message_id": "msg-uuid",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Server → Client Events

### Incoming Message

```json
{
  "event": "message",
  "id": "msg-uuid",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "content": "Yes, still available!",
  "media_s3_key": null,
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Message types:** `text | image | video | audio | file | system`

For media messages, `media_s3_key` contains the S3 key. Fetch a presigned URL via `GET /api/v1/chat/media/{s3_key}/url` to render.

### Typing Indicator

```json
{
  "event": "typing",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Show the typing indicator for 3 seconds. If another `typing` event arrives before 3s, reset the timer.

### Read Receipt

```json
{
  "event": "read_receipt",
  "message_id": "msg-uuid",
  "thread_id": "3d8e4b5c-1234-4abc-89de-000000000001",
  "read_by": "550e8400-e29b-41d4-a716-446655440000",
  "read_at": "2025-01-15T10:30:05Z"
}
```

### Online Status

```json
{
  "event": "online",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "online": true,
  "last_seen": "2025-01-15T10:30:00Z"
}
```

Online status is tracked via Redis with a TTL. Users are marked offline when the WebSocket closes.

---

## HTTP Chat Endpoints

For message history (REST, not WebSocket):

```http
GET /api/v1/chat/threads
Authorization: Bearer <token>
```

```http
GET /api/v1/chat/threads/{thread_id}/messages
Authorization: Bearer <token>
```

```http
POST /api/v1/chat/threads/{thread_id}/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<binary>
```

---

## RabbitMQ Event Catalog (Backend-to-Backend)

All inter-service events use the topic exchange `velontri.events` with routing keys following `{domain}.{entity}.{action}`.

### Published Events

#### Auth Service
| Routing Key | Payload | Consumed By |
|---|---|---|
| `auth.user.registered` | `{ user_id, email, phone, full_name, country_code }` | user-service, notification-service |
| `auth.user.verified` | `{ user_id }` | user-service, notification-service |
| `auth.user.password_changed` | `{ user_id, ip_address }` | notification-service |
| `auth.device.revoked` | `{ user_id, device_id }` | notification-service |

#### Marketplace Service
| Routing Key | Payload | Consumed By |
|---|---|---|
| `marketplace.listing.created` | `{ listing_id, seller_id, category, title }` | search-service, analytics-service |
| `marketplace.listing.published` | `{ listing_id, seller_id }` | notification-service |
| `marketplace.listing.approved` | `{ listing_id }` | notification-service, search-service |
| `marketplace.listing.rejected` | `{ listing_id, reason }` | notification-service |
| `marketplace.review.created` | `{ listing_id, reviewer_id, rating }` | analytics-service, notification-service |
| `marketplace.booking.created` | `{ booking_id, buyer_id, seller_id }` | notification-service, logistics-service |

#### Payment Service
| Routing Key | Payload | Consumed By |
|---|---|---|
| `payment.escrow.created` | `{ payment_id, order_id, amount, currency, buyer_id, seller_id }` | notification-service, analytics-service |
| `payment.escrow.released` | `{ payment_id, seller_id, amount, currency }` | wallet-service, notification-service |
| `payment.dispute.raised` | `{ payment_id, buyer_id, reason }` | notification-service, crm-service |
| `payment.dispute.resolved` | `{ dispute_id, in_favour_of, resolver_id }` | notification-service, wallet-service |

#### Wallet Service
| Routing Key | Payload | Consumed By |
|---|---|---|
| `wallet.credited` | `{ user_id, amount, currency, balance_after }` | notification-service, analytics-service |
| `wallet.withdrawal.initiated` | `{ user_id, amount, bank_code }` | notification-service |
| `wallet.transfer.completed` | `{ from_user_id, to_user_id, amount }` | notification-service |

#### Notification Service
| Routing Key | Payload | Consumed By |
|---|---|---|
| `notification.send` | `{ user_id, channel, template, data }` | notification-service (self-consumer) |

### Notification Channels
`channel` can be: `push | email | sms | in_app`

### Consuming Events (Python example)
```python
# In any service's consumers.py
async def handle_my_event(payload: dict, session_factory, settings):
    event_data = json.loads(payload.body.decode())
    # process event...
    await payload.ack()
```

---

## Notification Service Push Events

The notification service delivers to devices via FCM (Android/Web) and APNs (iOS). These are push notifications triggered by the RabbitMQ events above.

```json
{
  "title": "New message from Ada Okafor",
  "body": "Is this item still available?",
  "data": {
    "type": "chat_message",
    "thread_id": "3d8e4b5c-...",
    "sender_id": "550e8400-..."
  }
}
```

Register a push token:
```http
POST /api/v1/notifications/device-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "fcm-or-apns-device-token",
  "platform": "android"
}
```
