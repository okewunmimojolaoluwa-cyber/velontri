# Velontri Commerce Platform — Product Requirements Document (As-Built)

**Document version:** 1.2.0  
**Status:** Backend stabilized — monorepo restructured — feature scope frozen  
**Last updated:** June 22, 2026  
**Audience:** Product, engineering, frontend, QA, DevOps

---

## 1. Executive Summary

Velontri is a **Pan-African, AI-powered commerce operating system** that unifies buying, selling, hiring, payments, logistics, inventory, CRM, and business intelligence on one platform. It targets individuals, SMEs, multi-branch enterprises, and agents across Nigeria, Ghana, Kenya, South Africa, and francophone West Africa (WAEMU/XOF).

**Current delivery state:**

| Layer | Status |
|-------|--------|
| Backend (14 microservices) | **Complete & stabilized** |
| API Gateway (port 8000) | **Complete** |
| Monorepo (`backend/` + `frontend/`) | **Complete** |
| Unit + property tests | **403/403 passing** |
| E2E integration tests | **16/16 passing** |
| Postman collection | **Updated for gateway** |
| Frontend scaffold (Next.js) | **Minimal — auth middleware + home page** |
| Production web/mobile UI | **Not built** |
| Phase 2 roadmap features | **Out of scope** |

---

## 2. Product Vision

### 2.1 Vision Statement

One platform where anyone in Africa can discover products, hire services, list property and vehicles, run a multi-branch business, accept escrow-protected payments, and grow with AI-powered insights — denominated in local currencies.

### 2.2 Target Users

| Persona | Primary needs |
|---------|---------------|
| **Buyer** | Search, purchase, escrow protection, wallet, chat |
| **Seller** | Listings, store, reviews, payments, analytics |
| **Agent** | Scoped transactions on behalf of businesses |
| **Branch Manager** | Branch inventory, staff, branch-scoped analytics |
| **Business Owner** | Multi-branch ops, CRM, subscriptions, AI BI |
| **Enterprise Admin** | Cross-brand administration, custom contracts |
| **Guest** | Browse listings (no transactions) |

### 2.3 Supported Markets & Currencies

| Country/region | Currency |
|----------------|----------|
| Nigeria | NGN |
| Ghana | GHS |
| Kenya | KES |
| South Africa | ZAR |
| WAEMU / francophone West Africa | XOF |

---

## 3. Scope

### 3.1 In Scope (Delivered)

All **24 functional requirements** from the original specification, implemented across **14 FastAPI microservices**:

1. User registration & authentication  
2. User profiles & trust verification  
3. Marketplace listings  
4. Property marketplace  
5. Vehicle marketplace  
6. Jobs marketplace  
7. Services marketplace  
8. Advanced search engine  
9. AI commerce assistant  
10. Chat system  
11. Reviews & ratings  
12. Escrow payments  
13. Wallet system  
14. Inventory management  
15. Multi-branch management  
16. Logistics module  
17. Sales analytics & reporting  
18. AI business intelligence  
19. CRM module  
20. Subscription & SaaS tiers  
21. Notification centre  
22. Security & fraud prevention  
23. Observability & platform operations  
24. Multi-currency support  

### 3.2 Out of Scope (Phase 2 Roadmap)

- AI Store Builder  
- Live Streaming  
- Affiliate Programme  
- Auction Engine  
- B2B / Wholesale Portal  
- Digital Products marketplace  
- API Marketplace  

### 3.3 Not Yet Delivered

- Full production frontend application (beyond scaffold)  
- Mobile native apps  
- Git repository / CI pipeline (project files only)  
- Pact contract tests (`tests/contract/` referenced but not present)  

### 3.4 Monorepo Structure (Delivered v1.2.0)

All code is organized into a two-workspace monorepo:

```
velontri/
├── backend/               # All APIs, services, Docker, tests, scripts
│   ├── auth-service/ … subscription-service/  (14 services)
│   ├── gateway/           # Unified API on port 8000
│   ├── shared/            # JWT, RabbitMQ, S3, database, FX utilities
│   ├── infra/             # Prometheus, Grafana, nginx, k8s
│   ├── scripts/           # dev_gateway.js, test-all.js, keygen
│   ├── tests/             # Integration + shared tests
│   ├── sdk/               # JS + Dart client SDKs
│   ├── secrets/           # JWT keys (gitignored)
│   ├── docker-compose.yml
│   └── package.json
├── frontend/              # Next.js UI workspace
│   ├── src/app/           # App Router (layout, home page)
│   ├── middleware.ts      # JWT auth protection middleware
│   ├── .env.local.example
│   └── package.json
├── docs/                  # PRD, guides, Postman collection
├── package.json           # Root workspace orchestrator
├── README.md
└── .gitignore
```

**Convention:** All future backend code goes in `backend/`. All future frontend code goes in `frontend/`. Root holds only shared documentation and workspace config.

## 4. Architecture

### 4.1 High-Level Diagram

```
Client (Web / Mobile — not built yet)
              │
              ▼
┌─────────────────────────────────────┐
│  API Gateway — http://localhost:8000 │
│  All routes under /api/v1            │
│  Swagger: /docs                      │
│  OpenAPI: /openapi.json              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  14 FastAPI Microservices (in-process │
│  via gateway, or separate in Docker) │
│                                      │
│  Auth · User · Marketplace · Search  │
│  AI · Chat · Payment · Wallet        │
│  Inventory · Logistics · Analytics   │
│  Notification · CRM · Subscription │
└──────────────┬──────────────────────┘
               │ RabbitMQ (async events)
┌──────────────▼──────────────────────┐
│  Shared Infrastructure               │
│  PostgreSQL×12 · Redis · Elasticsearch│
│  MinIO (S3) · Prometheus · Grafana   │
└─────────────────────────────────────┘
```

### 4.2 API Entry Points

| Environment | Base URL | Docs |
|-------------|----------|------|
| **Development (default)** | `http://localhost:8000/api/v1` | `http://localhost:8000/docs` |
| Docker (nginx gateway) | `http://localhost:8000/api/v1` | `http://localhost:8000/docs` |
| Per-service debug (Docker only) | `http://localhost:8001–8014/api/v1` | `http://localhost:800{N}/docs` |

### 4.3 Communication Patterns

| Pattern | Examples |
|---------|----------|
| **HTTP/REST (sync)** | JWT introspection, Search→AI, Payment→Wallet |
| **RabbitMQ (async)** | `listing.created`, `order.confirmed`, `order.completed`, `branch.created`, `subscription.tier_changed`, `inventory.low_stock`, `shipment.updated` |
| **WebSocket** | `ws://localhost:8000/api/v1/ws/chat?token=<jwt>` |

### 4.4 Database Strategy

- **Database-per-service** in Docker/production (PostgreSQL)  
- **Unified SQLite** in native gateway dev mode (`dev_gateway.db`)  
- **Alembic migrations** for 12 DB-backed services  

---

## 5. Microservices — Functional Specification

### 5.1 Auth Service

| Capability | Endpoints (prefix `/api/v1`) |
|------------|------------------------------|
| Registration + phone OTP | `POST /auth/register`, `POST /auth/verify-phone` |
| Login + JWT (15 min access, 7-day refresh) | `POST /auth/login`, `POST /auth/token/refresh` |
| 2FA (SMS + TOTP RFC 6238) | `POST /auth/2fa/enable`, `POST /auth/2fa/verify` |
| OAuth (Google, Apple) | `POST /auth/login/oauth` |
| Device tracking + revocation | `GET /auth/devices`, `DELETE /auth/devices/{id}` |
| Password reset | `POST /auth/password/reset-request`, `POST /auth/password/reset` |
| Token introspection | `GET /auth/introspect` |
| Account lockout (5 failures / 15 min) | Enforced in login flow |
| Rate limiting (10 req/min/IP) | Auth endpoints |

**Tests:** 105 passing

---

### 5.2 User Service

| Capability | Endpoints |
|------------|-----------|
| Profile CRUD | `GET /users/{id}/profile`, `PATCH /users/me/profile` |
| Trust badges (Bronze→Diamond) | KYC upload endpoints |
| KYC upload | `POST /users/me/kyc/government-id`, `POST /users/me/kyc/business-reg` |
| Business + branches | `POST /businesses`, `POST /businesses/{id}/branches` |
| RBAC | `PATCH /users/{id}/roles` |
| Event consumers | `user.registered`, `user.phone_verified`, `subscription.tier_changed` |
| Default currency preference | Profile field |

**Tests:** 24 passing (includes consumer tests)

---

### 5.3 Marketplace Service

| Capability | Endpoints |
|------------|-----------|
| Listing CRUD (product, service, job, property, vehicle) | `POST/PATCH/GET /listings` |
| Media upload (images, video, 360° tour) | `POST /listings/{id}/images`, `/videos`, `/tour` |
| Publish + moderation | `POST /listings/{id}/publish` |
| Variants, specs, out-of-stock automation | Variant endpoints |
| Property (map, mortgage calc, shortlet) | Property detail + calculator |
| Vehicle (VIN lookup, inspection PDF) | Vehicle detail endpoints |
| Jobs (CV upload, applications) | `POST /listings/{id}/applications` |
| Services bookings | `POST /bookings`, `PATCH /bookings/{id}/status` |
| Reviews + seller responses | `POST /listings/{id}/reviews` |
| Stores + custom domain | `POST /stores` |
| Listing quota per tier | Enforced at create |

**Tests:** 42 passing

---

### 5.4 Search Service

| Capability | Endpoints |
|------------|-----------|
| Elasticsearch BM25 keyword search | `GET /search` |
| Filters (price, location, category, badge, etc.) | Query params on `/search` |
| Autocomplete | `GET /search/autocomplete` |
| Voice search | `POST /search/voice` |
| AI natural-language search | `POST /search/ai` |
| Index sync via RabbitMQ | `listing.created/updated/deleted` consumers |

**Tests:** 22 passing

---

### 5.5 AI Service

| Capability | Endpoints |
|------------|-----------|
| NL search parsing | `POST /ai/search/parse` |
| Voice transcription | `POST /ai/search/transcribe` |
| Commerce assistant | `POST /ai/assistant/query`, `/compare` |
| CV scoring | `POST /ai/cv/score` |
| Interview prep | `POST /ai/interview/prep` |
| Review moderation | `POST /ai/review/moderate` |
| Chat translation + reply suggestions | `POST /ai/chat/translate`, `/suggest-reply` |
| Business intelligence | `POST /ai/bi/insights`, `/forecast`, `/question` |

**Tests:** 17 passing

---

### 5.6 Chat Service

| Capability | Endpoints |
|------------|-----------|
| WebSocket messaging | `WS /ws/chat?token=<jwt>` |
| Message types (text, voice, image, file) | Via WebSocket + `POST /chat/threads/{id}/media` |
| Read receipts + typing indicators | WebSocket events |
| Message history (500 msgs) | `GET /chat/threads/{id}/messages` |
| Offline message queue | On disconnect/reconnect |

**Tests:** 21 passing

---

### 5.7 Payment Service

| Capability | Endpoints |
|------------|-----------|
| Payment initiation + escrow hold | `POST /payments/initiate` |
| Gateways (Paystack, Flutterwave, M-Pesa, Wallet) | Routed by currency/country |
| Webhooks | `POST /payments/webhook/{gateway}` |
| Delivery confirmation + auto-release (72h) | `POST /payments/{id}/confirm-delivery` |
| Disputes | `POST /payments/{id}/dispute`, `PATCH /disputes/{id}/resolve` |
| Fraud scoring | Rejects above threshold |
| Platform fee per tier | Calculated on transaction |

**Tests:** 27 passing

---

### 5.8 Wallet Service

| Capability | Endpoints |
|------------|-----------|
| Balance inquiry | `GET /wallet/balance` |
| Top-up, withdraw, transfer | `POST /wallet/topup`, `/withdraw`, `/transfer` |
| Cashback on order completion | RabbitMQ consumer |
| Rewards points + redemption | `GET /wallet/rewards`, `POST /wallet/rewards/redeem` |
| Transaction history | `GET /wallet/transactions` |
| Internal credit (Payment Service) | `POST /internal/wallet/credit` |

**Tests:** 12 passing

---

### 5.9 Inventory Service

| Capability | Endpoints |
|------------|-----------|
| Stock per SKU per branch | `GET /inventory/{branch_id}/stock` |
| Barcode + QR generation | `GET /inventory/sku/{sku}/barcode` |
| Order decrement | `order.confirmed` consumer |
| Inter-branch transfers | `POST /inventory/transfers` |
| Damage recording | `POST /inventory/damage` |
| Movement history | `GET /inventory/sku/{sku}/history` |
| Low-stock alerts | `inventory.low_stock` event |

**Tests:** 20 passing

---

### 5.10 Logistics Service

| Capability | Endpoints |
|------------|-----------|
| Multi-carrier quotes | `POST /logistics/quote` |
| Shipment creation | `POST /logistics/shipments` |
| Carrier webhooks | `POST /logistics/webhook/{carrier}` |
| Tracking | `GET /logistics/shipments/{tracking_no}` |
| Delivery proof | On delivered webhook |

**Tests:** 18 passing

---

### 5.11 Analytics Service

| Capability | Endpoints |
|------------|-----------|
| Seller / branch / business dashboards | `GET /analytics/seller/{id}/summary`, etc. |
| Top listings + retention reports | `GET /analytics/seller/{id}/top-listings`, `/retention` |
| CSV/PDF export | `GET /analytics/export` |
| Order fact ingestion | `order.completed` consumer |

**Tests:** 13 passing

---

### 5.12 Notification Service

| Capability | Endpoints |
|------------|-----------|
| Multi-channel dispatch | `POST /notifications/send` |
| Channels: push, SMS, email, WhatsApp | Preference-based routing |
| Preference management | `PATCH /notifications/preferences` |
| 90-day history | `GET /notifications/history` |
| Retry (3 attempts → failed) | Built into delivery service |

**Tests:** 16 passing

---

### 5.13 CRM Service

| Capability | Endpoints |
|------------|-----------|
| Customer records per buyer–seller | `GET /crm/customers` |
| Purchase history | `GET /crm/customers/{id}/orders` |
| Staff notes | `POST /crm/customers/{id}/notes` |
| Scope enforcement | Seller / branch manager |
| Upsert on order completion | `order.completed` consumer |

**Tests:** 10 passing

---

### 5.14 Subscription Service

| Capability | Endpoints |
|------------|-----------|
| Tiers: Starter, Growth, Pro, Enterprise | `GET /subscriptions/tiers` |
| Upgrade / downgrade | `POST /subscriptions/upgrade`, `/downgrade` |
| Feature gates | Middleware on gated features |
| Recurring billing + retry | Scheduled job |
| FX invoices | `GET /subscriptions/invoices` |
| Enterprise contracts | `POST /subscriptions/enterprise` |

**Tests:** 8 passing

---

## 6. Subscription Tiers

| Tier | Price (NGN/mo) | Listing quota | AI BI | Multi-branch | Custom domain |
|------|----------------|---------------|-------|--------------|---------------|
| Starter | Free | 10 | No | No | No |
| Growth | ₦10,000 | 100 | No | Yes | No |
| Pro | ₦50,000 | Unlimited | Yes | Yes | Yes |
| Enterprise | Custom | Unlimited | Yes | Yes | Yes |

---

## 7. Trust Badge Progression

```
none → bronze (phone verified) → silver (gov ID) → gold (business reg) → diamond (agent verified)
```

---

## 8. Non-Functional Requirements

### 8.1 Security

- Password hashing: bcrypt cost ≥ 12  
- JWT: RS256, 15-min access, 7-day refresh  
- 2FA: TOTP (RFC 6238) + SMS OTP  
- Rate limiting on auth endpoints  
- Fraud scoring on payments  
- Audit log for privileged actions (90-day retention)  

### 8.2 Observability

- `/health` on every service (gateway aggregates)  
- `/metrics` Prometheus endpoints  
- Structured JSON logging (structlog)  
- Grafana dashboards + alert rules  
- K8s HPA manifests (min 2, max 20 replicas, 70% CPU)  

### 8.3 Performance Targets (from spec)

| Metric | Target |
|--------|--------|
| Search p95 | ≤ 500 ms |
| Autocomplete | ≤ 200 ms |
| AI assistant response | ≤ 3 s |
| WebSocket latency (same continent) | ≤ 300 ms |
| SMS delivery | ≤ 60 s |
| Email delivery | ≤ 2 min |

### 8.4 Testing (Current State)

| Suite | Count | Status |
|-------|-------|--------|
| Unit + property tests | 403 | **All passing** |
| Shared (FX + observability) | 48 | Passing |
| E2E integration flows | 16 | **All passing** |
| Property invariants (Hypothesis) | 7 | Implemented |

---

## 9. Stabilization & Restructure Record

### 9.1 Defects Fixed (v1.1.0)

| ID | Issue | Resolution |
|----|-------|------------|
| D-01 | `NOT NULL` failures on `created_at` columns | Added `utc_now()` ORM defaults in 5 services |
| D-02 | Auth repository tests failing | Same root cause as D-01 |
| D-03 | Gateway search returned HTTP 500 | Added `es_client` + `http_client` to gateway lifespan |
| D-04 | Search `http_client` never initialized | Fixed in `search-service/app/main.py` |
| D-05 | Alembic `shared` import error | Added workspace root to all `migrations/env.py` |
| D-06 | E2E tests used wrong URLs/paths | Updated for gateway + `/api/v1` |

### 9.2 Files Changed in Stabilization (v1.1.0)

- `backend/shared/database.py` — `utc_now()` helper  
- `auth-service`, `user-service`, `notification-service`, `analytics-service`, `crm-service` — model timestamp defaults  
- `backend/gateway/main.py` — search dependencies in lifespan  
- `search-service/app/main.py` — `http_client` init  
- `backend/tests/integration/test_e2e_flows.py` — gateway mode  
- All 12 `migrations/env.py` — PYTHONPATH fix  

### 9.3 Monorepo Restructure (v1.2.0)

| Change | Details |
|--------|---------|
| Backend isolation | Moved 14 services, gateway, shared, infra, scripts, tests, sdk, secrets, docker-compose into `backend/` |
| Frontend workspace | Created `frontend/` with Next.js 14, App Router scaffold, auth middleware |
| Root orchestration | Added root `package.json` with npm workspaces delegating to `backend` and `frontend` |
| Single-port gateway | `npm run dev` from root starts gateway on `http://localhost:8000/api/v1` |
| Documentation | Updated README, PRD, FRONTEND_INTEGRATION_GUIDE for new paths |
| Path fixes | All `migrations/env.py`, service `conftest.py`, and gateway `ROOT` resolve to `backend/` |

---

## 10. Developer Operations

### 10.1 Quick Start

```bash
# Generate JWT keys (first time only)
pwsh backend/scripts/generate_jwt_keys.ps1

# Start API (single port 8000)
npm run dev

# Verify
npm run health

# Run all tests
npm run test

# Run E2E (gateway must be running)
npm run test:e2e
```

### 10.2 Docker Full Stack

```bash
npm run dev:docker    # 14 services + nginx on port 8000
npm run stop          # stop containers
```

### 10.3 Key npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Gateway on port 8000 (default) |
| `npm run dev:docker` | Full Docker stack |
| `npm run test` | 403 unit tests |
| `npm run test:e2e` | 16 integration tests |
| `npm run health` | Gateway health probe |

---

## 11. Frontend Integration

### 11.1 Environment Variable

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 11.2 Authentication Flow

1. `POST /api/v1/auth/register`  
2. `POST /api/v1/auth/verify-phone` (OTP in dev terminal logs)  
3. `POST /api/v1/auth/login` → receive `access_token` + `refresh_token`  
4. Send `Authorization: Bearer <access_token>` on protected routes  
5. Refresh via `POST /api/v1/auth/token/refresh` before 15-min expiry  

### 11.3 SDK

- JavaScript: `backend/sdk/js/velontri-sdk.js` (default base: `http://localhost:8000/api/v1`)  
- Dart: `backend/sdk/dart/velontri_client.dart`  
- Next.js middleware: `frontend/middleware.ts`  

### 11.4 Related Documentation

| Document | Purpose |
|----------|---------|
| `docs/FRONTEND_INTEGRATION_GUIDE.md` | Full API integration guide |
| `docs/ERROR_CATALOG.md` | Error codes |
| `docs/ROLE_PERMISSION_MATRIX.md` | RBAC matrix |
| `docs/WEBSOCKET_DOCUMENTATION.md` | Chat WebSocket protocol |
| `docs/FILE_UPLOAD_GUIDE.md` | Media upload limits |

---

## 12. Postman Integration

### 12.1 What to Import

| Import type | File / URL | Use when |
|-------------|------------|----------|
| **Curated collection** | `docs/postman_collection.json` | Day-to-day testing with examples + auto-token scripts |
| **Live OpenAPI** | `http://localhost:8000/openapi.json` | Full 91-endpoint coverage, auto-generated |

### 12.2 Postman Setup Steps

1. Run `npm run dev`  
2. Postman → **Import** → **File** → select `docs/postman_collection.json`  
3. Run **Gateway → Health Check**  
4. Run **Authentication → Register** → copy `user_id` to collection variable  
5. Run **Authentication → Login** → tokens auto-saved to `{{access_token}}`  
6. All other folders work against `http://localhost:8000/api/v1`  

### 12.3 Collection Variables

| Variable | Default value |
|----------|---------------|
| `base_url` | `http://localhost:8000/api/v1` |
| `gateway_url` | `http://localhost:8000` |
| `access_token` | Set by Login test script |
| `refresh_token` | Set by Login test script |
| `user_id` | Set manually after Register |
| `listing_id` | Set after Create Listing |
| `payment_id` | Set after Initiate Payment |

All per-service URL variables (`auth_url`, `marketplace_url`, etc.) default to the same `base_url` for gateway mode.

---

## 13. Requirements Traceability

| Req | Title | Service(s) | Status |
|-----|-------|------------|--------|
| 1 | Authentication | Auth | ✅ |
| 2 | Profiles & trust | User | ✅ |
| 3 | Marketplace listings | Marketplace | ✅ |
| 4 | Property | Marketplace | ✅ |
| 5 | Vehicles | Marketplace | ✅ |
| 6 | Jobs | Marketplace + AI | ✅ |
| 7 | Services | Marketplace | ✅ |
| 8 | Search | Search | ✅ |
| 9 | AI assistant | AI | ✅ |
| 10 | Chat | Chat | ✅ |
| 11 | Reviews | Marketplace | ✅ |
| 12 | Escrow payments | Payment | ✅ |
| 13 | Wallet | Wallet | ✅ |
| 14 | Inventory | Inventory | ✅ |
| 15 | Multi-branch | User + Inventory + Analytics | ✅ |
| 16 | Logistics | Logistics | ✅ |
| 17 | Analytics | Analytics | ✅ |
| 18 | AI BI | AI | ✅ |
| 19 | CRM | CRM | ✅ |
| 20 | Subscriptions | Subscription | ✅ |
| 21 | Notifications | Notification | ✅ |
| 22 | Security | Auth + Payment | ✅ |
| 23 | Observability | All + infra | ✅ |
| 24 | Multi-currency | shared/fx + integrations | ✅ |

**Coverage: 24/24 requirements implemented in backend.**

---

## 14. Success Criteria & Next Phase

### 14.1 Backend Success Criteria (Met)

- [x] All 14 microservices implemented  
- [x] Single-port API gateway  
- [x] Monorepo structure (`backend/` + `frontend/`)  
- [x] 403/403 unit tests passing  
- [x] 16/16 E2E tests passing  
- [x] OpenAPI/Swagger loads at `/docs`  
- [x] Postman collection updated  
- [x] No known critical defects  

### 14.2 Frontend Status & Next Phase

**Delivered (scaffold):**
- [x] Next.js 14 workspace in `frontend/`  
- [x] `middleware.ts` — JWT route protection, token refresh  
- [x] `src/app/` — minimal home page  
- [x] `.env.local.example` with `NEXT_PUBLIC_API_URL`  

**Recommended next steps:**
1. Implement auth flow (register → verify → login → refresh)  
2. Build listing browse + search UI  
3. Add seller dashboard (listings, wallet, analytics)  
4. Wire WebSocket chat  
5. Connect all pages to `http://localhost:8000/api/v1`  

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Escrow** | Funds held by Payment Service until buyer confirms delivery |
| **Trust Badge** | Seller verification level (Bronze–Diamond) |
| **SKU** | Stock Keeping Unit for product variants |
| **JWT** | JSON Web Token for API authentication |
| **KYC** | Know Your Customer identity verification |
| **Branch** | Physical/logical unit under a Business Owner |
| **Tier** | SaaS subscription plan governing features and quotas |

---

*This PRD reflects the as-built state after backend stabilization (v1.1.0) and monorepo restructure (v1.2.0). Feature scope is frozen; subsequent work should focus on frontend UI, deployment, and operational hardening.*
