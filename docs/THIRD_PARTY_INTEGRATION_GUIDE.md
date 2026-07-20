# Velontri Third-Party Integration Guide

## Overview

Velontri supports three integration models:
1. **Webhooks** — Velontri pushes events to your server when things happen
2. **API Key (B2B)** — Server-to-server calls using a long-lived API key (Enterprise tier only)
3. **OAuth** — User-authorized access for third-party apps (roadmap)

---

## Webhook Setup

### Register a Webhook Endpoint

```http
POST /api/v1/webhooks
Authorization: Bearer <enterprise_api_key>
Content-Type: application/json

{
  "url": "https://your-server.com/webhooks/velontri",
  "events": [
    "payment.escrow.released",
    "marketplace.listing.approved",
    "marketplace.booking.created"
  ],
  "secret": "your-webhook-signing-secret"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webhook_id": "wh_550e8400e29b41d4a716446655440000",
    "url": "https://your-server.com/webhooks/velontri",
    "events": ["payment.escrow.released", "marketplace.listing.approved"],
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

## Webhook Verification

All Velontri webhooks include an `X-Velontri-Signature` header. Verify this before processing the payload.

**Signature algorithm:** HMAC-SHA256 of the raw request body using your webhook secret.

### Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyVelontriWebhook(req, secret) {
  const signature = req.headers['x-velontri-signature'];
  if (!signature) return false;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody) // use raw body buffer, not parsed JSON
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSig}`),
    Buffer.from(signature)
  );
}

// Express middleware example
app.post('/webhooks/velontri', express.raw({ type: '*/*' }), (req, res) => {
  if (!verifyVelontriWebhook(req, process.env.VELONTRI_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  const event = JSON.parse(req.body);
  handleEvent(event);
  res.json({ received: true });
});
```

### Verification (Python / FastAPI)

```python
import hashlib
import hmac
from fastapi import Request, HTTPException

WEBHOOK_SECRET = os.environ["VELONTRI_WEBHOOK_SECRET"]

async def verify_velontri_webhook(request: Request) -> dict:
    signature = request.headers.get("X-Velontri-Signature", "")
    body = await request.body()
    
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    return json.loads(body)
```

### Verification (Flutter/Dart)

```dart
import 'dart:convert';
import 'package:crypto/crypto.dart';

bool verifyWebhookSignature(String body, String signature, String secret) {
  final key  = utf8.encode(secret);
  final data = utf8.encode(body);
  final hmac = Hmac(sha256, key);
  final expected = 'sha256=${hmac.convert(data)}';
  return expected == signature;
}
```

---

## Webhook Event Catalog

### Payment Events

#### `payment.escrow.released`
Fired when the buyer confirms delivery and escrow is released to the seller.
```json
{
  "event": "payment.escrow.released",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "payment_id": "pay_550e8400e29b41d4a716446655440000",
    "order_id": "ord_abc123",
    "amount": "50000.00",
    "currency": "NGN",
    "seller_id": "550e8400-e29b-41d4-a716-446655440000",
    "buyer_id": "7c4f1234-abcd-4567-ef89-000000000001"
  }
}
```

#### `payment.dispute.resolved`
```json
{
  "event": "payment.dispute.resolved",
  "timestamp": "2025-01-15T11:00:00Z",
  "data": {
    "dispute_id": "dis_123",
    "payment_id": "pay_550e8400",
    "in_favour_of": "buyer",
    "amount": "50000.00",
    "currency": "NGN"
  }
}
```

### Marketplace Events

#### `marketplace.listing.approved`
```json
{
  "event": "marketplace.listing.approved",
  "timestamp": "2025-01-15T09:00:00Z",
  "data": {
    "listing_id": "lst_abc123",
    "seller_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Toyota Camry 2019",
    "category": "vehicles"
  }
}
```

#### `marketplace.booking.created`
```json
{
  "event": "marketplace.booking.created",
  "timestamp": "2025-01-15T14:00:00Z",
  "data": {
    "booking_id": "bkng_xyz",
    "listing_id": "lst_abc123",
    "buyer_id": "7c4f1234-abcd-4567-ef89-000000000001",
    "seller_id": "550e8400-e29b-41d4-a716-446655440000",
    "scheduled_date": "2025-01-20T10:00:00Z"
  }
}
```

### User Events

#### `auth.user.registered`
```json
{
  "event": "auth.user.registered",
  "timestamp": "2025-01-15T08:00:00Z",
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "country_code": "NG"
  }
}
```

---

## Webhook Retry Policy

Velontri retries failed webhooks with exponential backoff:

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | 5 seconds |
| 3 | 30 seconds |
| 4 | 5 minutes |
| 5 | 30 minutes |

After 5 failed attempts, the webhook is marked `failed` and you will receive an email notification. Re-enable via:
```http
POST /api/v1/webhooks/{webhook_id}/redeliver
Authorization: Bearer <api_key>
```

**Your endpoint must respond with HTTP 200 within 30 seconds.** Any other response triggers a retry.

---

## API Key Authentication (B2B — Enterprise Only)

For server-to-server integrations, use a long-lived API key instead of JWT.

### Creating an API Key

```http
POST /api/v1/integrations/api-keys
Authorization: Bearer <enterprise_admin_token>
Content-Type: application/json

{
  "name": "ERP Integration",
  "permissions": ["listings:read", "analytics:read", "inventory:write"],
  "expires_at": "2026-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "api_key_id": "key_550e8400",
    "key": "vlt_live_a1b2c3d4e5f6...",
    "name": "ERP Integration",
    "permissions": ["listings:read", "analytics:read", "inventory:write"],
    "expires_at": "2026-01-01T00:00:00Z"
  }
}
```

The full key is only shown once. Store it securely.

### Using the API Key

```http
GET /api/v1/analytics/seller/550e8400.../summary
X-API-Key: vlt_live_a1b2c3d4e5f6...
```

Or via Authorization header:
```http
Authorization: ApiKey vlt_live_a1b2c3d4e5f6...
```

### API Key Permissions

| Permission | Allows |
|---|---|
| `listings:read` | GET any listing and browse |
| `listings:write` | Create/update listings |
| `analytics:read` | Read analytics data |
| `inventory:read` | Read inventory stock |
| `inventory:write` | Update inventory |
| `wallet:read` | Read wallet balance |
| `crm:read` | Read CRM customers |

---

## Rate Limits for Third Parties

| Tier | Rate Limit | Burst |
|---|---|---|
| B2B API key | 1000 req/min | 100 |
| Webhook deliveries | Up to 500/day | — |
| Sandbox (testing) | 100 req/min | 20 |

Rate limit headers in all responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1720001000
```

---

## Integration Checklist

Before going live with a Velontri integration:

- [ ] **API key** — Generated for your production environment
- [ ] **Webhook endpoint** — Registered at your server's HTTPS URL
- [ ] **Signature verification** — Implemented and tested
- [ ] **Idempotency** — Your handler is idempotent (webhook may be delivered multiple times)
- [ ] **Retry handling** — Your server returns 200 quickly (< 30s); heavy processing runs async
- [ ] **HTTPS only** — Webhook URL must be HTTPS in production
- [ ] **IP allowlist** (optional) — Velontri webhook IPs: ask support for current IP range
- [ ] **Error logging** — Log `request_id` from all Velontri responses
- [ ] **Staging test** — Fully tested against staging environment before production
- [ ] **Support contact** — `integrations@velontri.com` added to your team contacts

---

## Sandbox Environment

Use the staging environment for integration testing:

| Service | Staging URL |
|---|---|
| API Gateway | https://api.staging.velontri.com |
| Swagger | https://api.staging.velontri.com/docs (per-service via path) |

Test payment credentials:
- **Paystack test card:** 4084 0840 8408 4081, CVV 408, expiry 01/28
- **Flutterwave test card:** 5531 8866 5214 2950, CVV 564, expiry 09/32
- **M-Pesa test:** Use sandbox Safaricom numbers

Test webhook delivery can be triggered via:
```http
POST /api/v1/webhooks/{webhook_id}/test
Authorization: Bearer <api_key>
```
