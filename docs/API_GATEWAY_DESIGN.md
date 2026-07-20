# Velontri API Gateway Design

**Version:** 1.0  
**Frontend sees:** `https://api.velontri.com` (single host)  
**Backend:** 14 FastAPI microservices on ports 8001–8014

---

## Architecture Overview

```
Client (Browser / Mobile)
        │
        ▼
  api.velontri.com:443  (Kong / Nginx)
        │
        ├─► Rate Limiting + IP Allow/Block
        ├─► JWT Validation (RS256 public key)
        ├─► Request ID injection
        ├─► CORS headers
        │
        ▼
  Upstream routing by path prefix
        │
        ├─► :8001  auth-service
        ├─► :8002  user-service
        ├─► :8003  marketplace-service
        ├─► :8004  search-service
        ├─► :8005  ai-service
        ├─► :8006  chat-service
        ├─► :8007  payment-service
        ├─► :8008  wallet-service
        ├─► :8009  inventory-service
        ├─► :8010  logistics-service
        ├─► :8011  analytics-service
        ├─► :8012  notification-service
        ├─► :8013  crm-service
        └─► :8014  subscription-service
```

---

## Route Mapping

All services are mounted under `/api/v1`. The gateway strips nothing — it proxies the full path.

| Frontend Path Prefix | Upstream Service | Port |
|---|---|---|
| `/api/v1/auth/` | auth-service | 8001 |
| `/api/v1/users/` | user-service | 8002 |
| `/api/v1/businesses/` | user-service | 8002 |
| `/api/v1/listings/` | marketplace-service | 8003 |
| `/api/v1/bookings/` | marketplace-service | 8003 |
| `/api/v1/stores/` | marketplace-service | 8003 |
| `/api/v1/reviews/` | marketplace-service | 8003 |
| `/api/v1/applications/` | marketplace-service | 8003 |
| `/api/v1/search/` | search-service | 8004 |
| `/api/v1/ai/` | ai-service | 8005 |
| `/api/v1/chat/` | chat-service | 8006 |
| `/api/v1/ws/` | chat-service | 8006 |
| `/api/v1/payments/` | payment-service | 8007 |
| `/api/v1/disputes/` | payment-service | 8007 |
| `/api/v1/wallet/` | wallet-service | 8008 |
| `/api/v1/inventory/` | inventory-service | 8009 |
| `/api/v1/logistics/` | logistics-service | 8010 |
| `/api/v1/analytics/` | analytics-service | 8011 |
| `/api/v1/notifications/` | notification-service | 8012 |
| `/api/v1/crm/` | crm-service | 8013 |
| `/api/v1/subscriptions/` | subscription-service | 8014 |

---

## JWT Validation at Gateway

Auth service issues **RS256** JWTs. The gateway validates the signature using the **public key** only — it never holds the private key.

**Public key location:** `/run/secrets/jwt_public_key` (Docker secret) or env `JWT_PUBLIC_KEY_PATH`

**Token claims validated at gateway:**
- `exp` — token expiry (15-minute access tokens)
- `iss` — must equal `velontri-auth`
- `aud` — must equal `velontri-api`
- Algorithm must be `RS256` (algorithm pinning)

**Endpoints that bypass JWT validation (public):**
```
POST /api/v1/auth/register
POST /api/v1/auth/verify-phone
POST /api/v1/auth/login
POST /api/v1/auth/login/oauth
POST /api/v1/auth/token/refresh
POST /api/v1/auth/password/reset-request
POST /api/v1/auth/password/reset
POST /api/v1/auth/2fa/verify
GET  /api/v1/listings          (public browse)
GET  /api/v1/listings/{id}     (public detail)
GET  /api/v1/search            (public search)
GET  /api/v1/search/autocomplete
POST /api/v1/search/voice
GET  /api/v1/subscriptions/tiers
POST /api/v1/payments/webhook/ (HMAC-verified separately)
```

**Webhook endpoints** use HMAC verification in the payment service itself — do not add Bearer validation at the gateway for these.

---

## Rate Limiting Rules

| Category | Limit | Window | Applies To |
|---|---|---|---|
| Auth endpoints | 10 req | 60s per IP | `/api/v1/auth/*` |
| Search | 60 req | 60s per IP | `/api/v1/search*` |
| AI search | 20 req | 60s per user | `/api/v1/search/ai` |
| Public browse | 120 req | 60s per IP | `/api/v1/listings`, `/api/v1/search` |
| Authenticated API | 300 req | 60s per user | All Bearer endpoints |
| File upload | 20 req | 60s per user | Endpoints with `multipart/form-data` |
| Webhook | 1000 req | 60s per IP | `/api/v1/payments/webhook/*` |
| Global fallback | 500 req | 60s per IP | All other endpoints |

Rate limit response (HTTP 429):
```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Too many requests. Please retry after 60 seconds.",
    "field": null
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Kong Declarative Configuration (kong.yml)

```yaml
# Save as: infra/kong/kong.yml
# Apply with: deck sync --state infra/kong/kong.yml

_format_version: "3.0"
_transform: true

services:
  - name: auth-service
    url: http://auth-service:8001
    connect_timeout: 10000
    write_timeout: 30000
    read_timeout: 30000
    routes:
      - name: auth-routes
        paths:
          - /api/v1/auth
        strip_path: false
        preserve_host: false

  - name: user-service
    url: http://user-service:8002
    routes:
      - name: user-routes
        paths:
          - /api/v1/users
          - /api/v1/businesses
        strip_path: false

  - name: marketplace-service
    url: http://marketplace-service:8003
    routes:
      - name: marketplace-routes
        paths:
          - /api/v1/listings
          - /api/v1/bookings
          - /api/v1/stores
          - /api/v1/reviews
          - /api/v1/applications
        strip_path: false

  - name: search-service
    url: http://search-service:8004
    routes:
      - name: search-routes
        paths:
          - /api/v1/search
        strip_path: false

  - name: ai-service
    url: http://ai-service:8005
    routes:
      - name: ai-routes
        paths:
          - /api/v1/ai
        strip_path: false

  - name: chat-service
    url: http://chat-service:8006
    routes:
      - name: chat-routes
        paths:
          - /api/v1/chat
          - /api/v1/ws
        strip_path: false
        protocols:
          - http
          - https
          - ws
          - wss

  - name: payment-service
    url: http://payment-service:8007
    routes:
      - name: payment-routes
        paths:
          - /api/v1/payments
          - /api/v1/disputes
        strip_path: false

  - name: wallet-service
    url: http://wallet-service:8008
    routes:
      - name: wallet-routes
        paths:
          - /api/v1/wallet
        strip_path: false

  - name: inventory-service
    url: http://inventory-service:8009
    routes:
      - name: inventory-routes
        paths:
          - /api/v1/inventory
        strip_path: false

  - name: logistics-service
    url: http://logistics-service:8010
    routes:
      - name: logistics-routes
        paths:
          - /api/v1/logistics
        strip_path: false

  - name: analytics-service
    url: http://analytics-service:8011
    routes:
      - name: analytics-routes
        paths:
          - /api/v1/analytics
        strip_path: false

  - name: notification-service
    url: http://notification-service:8012
    routes:
      - name: notification-routes
        paths:
          - /api/v1/notifications
        strip_path: false

  - name: crm-service
    url: http://crm-service:8013
    routes:
      - name: crm-routes
        paths:
          - /api/v1/crm
        strip_path: false

  - name: subscription-service
    url: http://subscription-service:8014
    routes:
      - name: subscription-routes
        paths:
          - /api/v1/subscriptions
        strip_path: false

plugins:
  # ── JWT validation (global, with per-route exceptions) ─────────────────────
  - name: jwt
    config:
      key_claim_name: kid
      claims_to_verify:
        - exp
      anonymous: null          # no anonymous consumer; unauthenticated = 401
      run_on_preflight: false

  # ── Rate limiting (per IP, sliding window) ──────────────────────────────────
  - name: rate-limiting
    config:
      minute: 300
      policy: redis
      redis_host: redis
      redis_port: 6379
      redis_password: ${REDIS_PASSWORD}
      hide_client_headers: false
      error_message: "Too many requests. Please retry after 60 seconds."

  # ── Auth-specific rate limit ────────────────────────────────────────────────
  - name: rate-limiting
    service: auth-service
    config:
      minute: 10
      policy: redis
      redis_host: redis
      redis_port: 6379
      redis_password: ${REDIS_PASSWORD}

  # ── Request ID injection ────────────────────────────────────────────────────
  - name: correlation-id
    config:
      header_name: X-Request-ID
      generator: uuid#counter
      echo_downstream: true

  # ── Request size limit (32 MB for file uploads) ─────────────────────────────
  - name: request-size-limiting
    config:
      allowed_payload_size: 32
      size_unit: megabytes

  # ── CORS ────────────────────────────────────────────────────────────────────
  - name: cors
    config:
      origins:
        - https://app.velontri.com
        - https://admin.velontri.com
        - https://partner.velontri.com
      methods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      headers:
        - Authorization
        - Content-Type
        - X-Request-ID
        - Accept
      exposed_headers:
        - X-Request-ID
      credentials: true
      max_age: 3600

  # ── Response transformer (remove server header) ─────────────────────────────
  - name: response-transformer
    config:
      remove:
        headers:
          - server
          - x-powered-by

  # ── IP restriction (block known bad actors) ─────────────────────────────────
  - name: ip-restriction
    config:
      deny:
        - "0.0.0.0/8"
        - "169.254.0.0/16"
        - "172.16.0.0/12"    # Internal — only allow from load balancer
```

---

## Kong: JWT Consumer Setup

```bash
# Create consumer for each client type
curl -X POST http://localhost:8001/consumers \
  -d username=velontri-web

# Upload RS256 public key
curl -X POST http://localhost:8001/consumers/velontri-web/jwt \
  -d algorithm=RS256 \
  -d rsa_public_key="$(cat /run/secrets/jwt_public_key)" \
  -d key=velontri-auth
```

---

## Nginx Alternative Configuration

If using Nginx instead of Kong, see `infra/nginx/nginx.conf` for the complete production config with:
- Upstream blocks for all 14 services
- SSL termination with Let's Encrypt / custom certificate
- Rate limiting via `limit_req_zone`
- JWT validation via `auth_request` to auth service

---

## Health Check Aggregation

The gateway should check `/health` on each service. All services expose:
```
GET /health
```
Response:
```json
{
  "service": "auth-service",
  "version": "1.0.0",
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "rabbitmq": "ok"
  }
}
```

Gateway health endpoint: `GET https://api.velontri.com/health` — aggregates all 14 service health checks.

---

## WebSocket Gateway Config

The chat service uses WebSockets at `/api/v1/ws/chat`. Kong handles WS upgrade automatically when `protocols: [ws, wss]` is set on the route (see kong.yml above).

For Nginx, add to the chat upstream location:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

JWT is passed as a query parameter for WebSocket: `wss://api.velontri.com/api/v1/ws/chat?token=<access_token>`
