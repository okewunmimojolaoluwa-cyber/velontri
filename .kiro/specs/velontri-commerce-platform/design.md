# Design Document — Velontri Commerce Platform

## Overview

Velontri is a Pan-African commerce operating system built as 14 independently deployable Python/FastAPI microservices.

## Architecture

Velontri is a Pan-African commerce operating system built as 14 independently deployable Python/FastAPI microservices. Services communicate over RabbitMQ (asynchronous events) and HTTP/REST (synchronous calls). Each service owns its own PostgreSQL database (database-per-service pattern). Shared infrastructure includes Redis, Elasticsearch, AWS S3, and RabbitMQ.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                              │
│         Web App │ Mobile App │ Custom Subdomains            │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                ┌───────────▼───────────┐
                │      API Gateway      │
                │  (Kong / Nginx)       │
                │  JWT validation       │
                │  Rate limiting        │
                │  TLS termination      │
                └─┬──────────────────┬──┘
       Sync HTTP  │                  │  WebSocket
    ┌─────────────▼───┐          ┌───▼──────────┐
    │  REST Services  │          │ Chat Service │
    │  (14 FastAPI)   │          │  WebSocket   │
    └────────┬────────┘          └──────────────┘
             │
    ┌────────▼────────────────────────────────────┐
    │               RabbitMQ                       │
    │   (async event bus between all services)     │
    └────────┬────────────────────────────────────┘
             │
    ┌────────▼────────────────────────────────────┐
    │          Shared Infrastructure               │
    │  PostgreSQL (per-service) │ Redis │          │
    │  Elasticsearch │ AWS S3  │ RabbitMQ         │
    └─────────────────────────────────────────────┘
             │
    ┌────────▼────────────────────────────────────┐
    │         Observability                        │
    │   Prometheus │ Grafana │ Structured Logs     │
    └─────────────────────────────────────────────┘
```

### Service Communication Boundaries

**Synchronous (HTTP/REST)** — used when the caller needs an immediate response:
- API Gateway → any service
- Auth Service token introspection (all services validate JWTs)
- Search Service → AI Service (NL query parsing, voice transcription)
- Marketplace Service → Logistics Service (shipping quote request)
- Payment Service → Wallet Service (fund release/refund)

**Asynchronous (RabbitMQ)** — used for decoupled event-driven flows:
- `listing.created` / `listing.updated` → Search Service indexes
- `order.confirmed` → Inventory decrements, CRM updates, Analytics records
- `order.completed` → Wallet credits cashback, Analytics updates, CRM updates
- `shipment.updated` → Payment Service checks 72h auto-release timer
- `branch.created` → Inventory initialises empty stock ledger
- `subscription.tier_changed` → User Service updates profile tier
- `low_stock` → Notification Service alerts Branch Manager

---

## Components and Interfaces

The platform exposes all functionality through a unified API Gateway. Each of the 14 microservices is a self-contained FastAPI application with its own PostgreSQL database, exposing REST endpoints internally. WebSocket connections for real-time chat and push notifications are handled by the Chat Service and Notification Service respectively.

External-facing interfaces:
- **REST API** — consumed by web and mobile clients via the API Gateway
- **WebSocket** — persistent connections for chat (Chat Service) and live push (Notification Service)
- **Carrier webhooks** — inbound HTTP callbacks from GIG, DHL, FedEx for shipment status
- **Payment webhooks** — inbound HTTP callbacks from Paystack, Flutterwave, M-Pesa for payment confirmation

## Data Models

### 2.1 Auth Service

**Responsibilities:** Registration, login, JWT issuance, token refresh, 2FA (SMS OTP + TOTP), OAuth (Google/Apple), device tracking, account lockout, password reset, rate limiting.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | None | Register new user |
| POST | /auth/verify-phone | None | Submit OTP for phone verification |
| POST | /auth/login | None | Email/phone + password login |
| POST | /auth/login/oauth | None | OAuth Google/Apple login |
| POST | /auth/token/refresh | Refresh token | Issue new access token |
| POST | /auth/2fa/enable | JWT | Enable 2FA (SMS or TOTP) |
| POST | /auth/2fa/verify | JWT | Verify 2FA OTP |
| POST | /auth/password/reset-request | None | Send password reset email |
| POST | /auth/password/reset | None | Reset password with token |
| GET | /auth/introspect | JWT | Return user ID, roles, tier |
| GET | /auth/devices | JWT | List registered devices |
| DELETE | /auth/devices/{device_id} | JWT | Revoke device session |

**PostgreSQL Schema:**

```sql
-- auth_db

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    phone_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    country_code CHAR(2) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    locked_until TIMESTAMPTZ,
    failed_attempts SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    device_fingerprint VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    fingerprint VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_seen TIMESTAMPTZ,
    is_trusted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, fingerprint)
);

CREATE TABLE login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    device_fingerprint VARCHAR(255),
    ip_address INET,
    success BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    purpose VARCHAR(50) NOT NULL, -- phone_verify, 2fa, password_reset
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

CREATE TABLE totp_secrets (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    secret_encrypted TEXT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL, -- role_change, 2fa_toggle, device_revoke, password_reset
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Redis Usage:**
- `auth:otp:{user_id}:{purpose}` — OTP TTL 5 minutes
- `auth:lockout:{user_id}` — lockout TTL 15 minutes
- `auth:rate_limit:{ip}` — sliding window counter TTL 60 seconds
- `auth:reset_token:{token_hash}` — password reset TTL 30 minutes

**RabbitMQ Events Produced:**
- `user.registered` → User Service (create profile)
- `user.phone_verified` → User Service (award Bronze badge)

---

### 2.2 User Service

**Responsibilities:** User profiles, trust badges (KYC), RBAC roles, business/branch entities, multi-currency preferences, subscription tier sync.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/{user_id}/profile | JWT | Get user profile |
| PATCH | /users/me/profile | JWT | Update own profile |
| POST | /users/me/kyc/government-id | JWT | Submit govt ID for Silver badge |
| POST | /users/me/kyc/business-reg | JWT | Submit business cert for Gold badge |
| POST | /businesses | JWT (Seller) | Create business entity |
| POST | /businesses/{business_id}/branches | JWT (Business Owner) | Create branch |
| GET | /businesses/{business_id}/branches | JWT | List branches |
| PATCH | /users/{user_id}/roles | JWT (Admin) | Elevate user role |

**PostgreSQL Schema:**

```sql
-- user_db

CREATE TABLE profiles (
    user_id UUID PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    profile_photo_url TEXT,
    bio TEXT,
    country CHAR(2),
    state VARCHAR(100),
    city VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    default_currency VARCHAR(3) DEFAULT 'NGN',
    trust_badge VARCHAR(20) DEFAULT 'none', -- none, bronze, silver, gold, diamond
    subscription_tier VARCHAR(20) DEFAULT 'starter',
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL, -- buyer, seller, agent, branch_manager, business_owner, enterprise_admin
    scope_id UUID, -- branch_id or business_id for scoped roles
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'))
);

CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    registration_number VARCHAR(100),
    logo_url TEXT,
    country CHAR(2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    branch_name VARCHAR(200) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    country CHAR(2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branch_staff (
    branch_id UUID NOT NULL REFERENCES branches(id),
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (branch_id, user_id)
);

CREATE TABLE kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- government_id, business_registration
    s3_key TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RabbitMQ Events Consumed:**
- `user.registered` → create profile record
- `user.phone_verified` → set trust_badge = 'bronze'
- `subscription.tier_changed` → update subscription_tier on profile

**RabbitMQ Events Produced:**
- `branch.created` → Inventory Service (init stock ledger)

---

### 2.3 Marketplace Service

**Responsibilities:** Listings (all types), variants, media, reviews, stores, custom domains, moderation queue, booking lifecycle (services).

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /listings | JWT (Seller) | Create listing |
| GET | /listings/{listing_id} | None | Get listing detail |
| PATCH | /listings/{listing_id} | JWT (Seller) | Update listing |
| POST | /listings/{listing_id}/images | JWT (Seller) | Upload image to S3 |
| POST | /listings/{listing_id}/publish | JWT (Seller) | Submit for review |
| PATCH | /listings/{listing_id}/status | JWT (Moderator) | Approve/reject listing |
| POST | /listings/{listing_id}/reviews | JWT (Buyer) | Submit review |
| GET | /listings/{listing_id}/reviews | None | List reviews |
| POST | /stores | JWT (Seller) | Create/update store |
| POST | /bookings | JWT (Buyer) | Book a service listing |
| PATCH | /bookings/{booking_id}/status | JWT | Update booking status |

**PostgreSQL Schema:**

```sql
-- marketplace_db

CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL,
    listing_type VARCHAR(30) NOT NULL, -- physical, digital, job, property, vehicle, service
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(18,2),
    currency VARCHAR(3) NOT NULL,
    country CHAR(2),
    state VARCHAR(100),
    city VARCHAR(100),
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    condition VARCHAR(20),
    brand VARCHAR(100),
    status VARCHAR(30) DEFAULT 'draft',
    avg_rating NUMERIC(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE listing_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id),
    media_type VARCHAR(20) NOT NULL, -- image, video, tour_360
    s3_key TEXT NOT NULL,
    sort_order SMALLINT DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE listing_specs (
    listing_id UUID NOT NULL REFERENCES listings(id),
    spec_key VARCHAR(100) NOT NULL,
    spec_value TEXT NOT NULL,
    PRIMARY KEY (listing_id, spec_key)
);

CREATE TABLE listing_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id),
    sku VARCHAR(100) UNIQUE NOT NULL,
    attributes JSONB NOT NULL, -- {"colour": "red", "size": "M"}
    price NUMERIC(18,2),
    stock_quantity INTEGER DEFAULT 0
);

CREATE TABLE property_details (
    listing_id UUID PRIMARY KEY REFERENCES listings(id),
    property_type VARCHAR(20) NOT NULL, -- rent, sale, shortlet, commercial
    bedrooms SMALLINT,
    bathrooms SMALLINT,
    area_sqm NUMERIC(10,2),
    furnishing_status VARCHAR(20),
    amenities TEXT[],
    tour_asset_url TEXT,
    price_per_night NUMERIC(18,2)
);

CREATE TABLE shortlet_availability (
    listing_id UUID NOT NULL REFERENCES listings(id),
    blocked_date DATE NOT NULL,
    PRIMARY KEY (listing_id, blocked_date)
);

CREATE TABLE vehicle_details (
    listing_id UUID PRIMARY KEY REFERENCES listings(id),
    make VARCHAR(100),
    model VARCHAR(100),
    year SMALLINT,
    mileage_km INTEGER,
    fuel_type VARCHAR(20),
    transmission VARCHAR(20),
    colour VARCHAR(50),
    engine_size_cc INTEGER,
    vin VARCHAR(17),
    vin_history_status VARCHAR(20) DEFAULT 'pending',
    vin_history_data JSONB,
    vin_error_reason TEXT,
    inspection_report_s3_key TEXT
);

CREATE TABLE job_details (
    listing_id UUID PRIMARY KEY REFERENCES listings(id),
    employer_id UUID NOT NULL,
    job_type VARCHAR(20) NOT NULL, -- full_time, part_time, contract, remote
    salary_min NUMERIC(18,2),
    salary_max NUMERIC(18,2),
    salary_currency VARCHAR(3),
    required_skills TEXT[],
    application_deadline DATE
);

CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id),
    applicant_id UUID NOT NULL,
    cv_s3_key TEXT NOT NULL,
    ai_score SMALLINT,
    ai_missing_skills TEXT[],
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id),
    reviewer_id UUID NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(2000),
    status VARCHAR(20) DEFAULT 'published', -- published, quarantined
    seller_response VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (listing_id, reviewer_id)
);

CREATE TABLE review_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id),
    media_type VARCHAR(10) NOT NULL, -- image, video
    s3_key TEXT NOT NULL
);

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID UNIQUE NOT NULL,
    store_name VARCHAR(200) NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    theme VARCHAR(50),
    custom_domain VARCHAR(255),
    domain_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id),
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    payment_ref UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RabbitMQ Events Produced:**
- `listing.created` / `listing.updated` / `listing.deleted` → Search Service
- `review.submitted` → AI Service (spam check)
- `booking.status_changed` → Notification Service
- `job_application.status_changed` → Notification Service

**RabbitMQ Events Consumed:**
- `order.completed` → unlock review eligibility

**Redis Usage:**
- `marketplace:listing:{listing_id}` — listing detail cache TTL 5 minutes
- `marketplace:seller_listing_count:{seller_id}` — quota enforcement TTL 1 hour

---

### 2.4 Search Service

**Responsibilities:** Elasticsearch indexing of listings, keyword/filter/voice/AI-NL search, autocomplete.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /search | None | Keyword + filter search |
| GET | /search/autocomplete | None | Autocomplete suggestions |
| POST | /search/voice | None | Voice search (audio upload) |
| POST | /search/ai | JWT | AI natural-language search |

**Elasticsearch Index: `listings`**

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "title": { "type": "text", "analyzer": "standard" },
      "description": { "type": "text" },
      "category": { "type": "keyword" },
      "subcategory": { "type": "keyword" },
      "brand": { "type": "keyword" },
      "condition": { "type": "keyword" },
      "listing_type": { "type": "keyword" },
      "status": { "type": "keyword" },
      "price": { "type": "scaled_float", "scaling_factor": 100 },
      "currency": { "type": "keyword" },
      "country": { "type": "keyword" },
      "state": { "type": "keyword" },
      "city": { "type": "keyword" },
      "location": { "type": "geo_point" },
      "seller_trust_badge": { "type": "keyword" },
      "avg_rating": { "type": "half_float" },
      "created_at": { "type": "date" }
    }
  }
}
```

**RabbitMQ Events Consumed:**
- `listing.created` → index document
- `listing.updated` → update document
- `listing.deleted` → delete document

**Redis Usage:**
- `search:autocomplete:{prefix}` — autocomplete cache TTL 60 seconds

---

### 2.5 AI Service

**Responsibilities:** NL search query parsing, voice transcription, commerce assistant (product queries, comparison, alternatives), CV scoring, interview prep, review spam detection, chat translation and reply suggestions, AI BI insights and forecasting.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /ai/search/parse | Internal | Parse NL search query to structured filters |
| POST | /ai/search/transcribe | Internal | Transcribe voice audio to text |
| POST | /ai/assistant/query | JWT | Commerce assistant NL product query |
| POST | /ai/assistant/compare | JWT | Compare up to 10 listings |
| POST | /ai/cv/score | Internal | Score CV against job requirements |
| POST | /ai/interview/prep | JWT | Generate interview questions |
| POST | /ai/review/moderate | Internal | Spam/abuse classification |
| POST | /ai/chat/translate | Internal | Translate message text |
| POST | /ai/chat/suggest-reply | JWT | Generate 3 reply suggestions |
| POST | /ai/bi/insights | Internal | Generate BI insight summaries |
| POST | /ai/bi/forecast | Internal | 30-day revenue forecast |
| POST | /ai/bi/question | JWT | Free-text business question |

**Redis Usage:**
- `ai:session:{user_id}:{session_id}` — conversation history (20 turns) TTL 2 hours

---

### 2.6 Chat Service

**Responsibilities:** WebSocket connection management, message persistence, read receipts, typing indicators, media message handling via S3, message queue for offline users.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /ws/chat | JWT (WS upgrade) | Establish WebSocket connection |
| GET | /chat/threads | JWT | List conversation threads |
| GET | /chat/threads/{thread_id}/messages | JWT | Get message history (last 500) |
| POST | /chat/threads/{thread_id}/media | JWT | Upload media file to S3 |

**PostgreSQL Schema:**

```sql
-- chat_db

CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_a UUID NOT NULL,
    participant_b UUID NOT NULL,
    listing_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (participant_a, participant_b, listing_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id),
    sender_id UUID NOT NULL,
    message_type VARCHAR(20) NOT NULL, -- text, voice_note, image, file
    content TEXT,
    media_s3_key TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL,
    message_id UUID NOT NULL REFERENCES messages(id),
    queued_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Redis Usage:**
- `chat:online:{user_id}` — online status TTL 30 seconds (heartbeat)
- `chat:typing:{thread_id}:{user_id}` — typing indicator TTL 3 seconds

---

### 2.7 Payment Service

**Responsibilities:** Multi-gateway payment processing (Paystack, Flutterwave, M-Pesa), escrow lifecycle, dispute management, transaction fees, fraud scoring.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /payments/initiate | JWT (Buyer) | Initiate escrow payment |
| POST | /payments/webhook/{gateway} | Gateway HMAC | Receive payment webhook |
| POST | /payments/{payment_id}/confirm-delivery | JWT (Buyer) | Buyer confirms delivery |
| POST | /payments/{payment_id}/dispute | JWT (Buyer) | Raise dispute |
| PATCH | /disputes/{dispute_id}/resolve | JWT (Admin) | Resolve dispute |
| GET | /payments/{payment_id} | JWT | Get payment status |

**PostgreSQL Schema:**

```sql
-- payment_db

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    fee_amount NUMERIC(18,2) DEFAULT 0,
    currency VARCHAR(3) NOT NULL,
    gateway VARCHAR(20) NOT NULL, -- paystack, flutterwave, mpesa, wallet
    gateway_ref VARCHAR(255),
    status VARCHAR(30) DEFAULT 'pending',
    -- pending, processing, held_in_escrow, released, refunded, failed
    escrow_held_at TIMESTAMPTZ,
    auto_release_at TIMESTAMPTZ,
    delivery_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    raised_by UUID NOT NULL,
    reason TEXT,
    status VARCHAR(30) DEFAULT 'open',
    -- open, resolved_buyer, resolved_seller
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fraud_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    score NUMERIC(5,4),
    model_version VARCHAR(50),
    rejected BOOLEAN DEFAULT FALSE,
    scored_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RabbitMQ Events Produced:**
- `order.confirmed` → Inventory, CRM, Analytics, Notification
- `order.completed` (after escrow release) → Wallet (cashback), Analytics, CRM, Notification
- `payment.fraud_flagged` → Notification (ops alert), User Service (suspend payment)

**External Integrations:** Paystack API, Flutterwave API, M-Pesa Daraja API

---

### 2.8 Wallet Service

**Responsibilities:** Per-user wallet ledger, top-up, withdrawal, wallet-to-wallet transfers, cashback credits, rewards points.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /wallet/balance | JWT | Get balance, held, pending |
| POST | /wallet/topup | JWT | Initiate top-up |
| POST | /wallet/withdraw | JWT | Request withdrawal |
| POST | /wallet/transfer | JWT | Wallet-to-wallet transfer |
| GET | /wallet/transactions | JWT | Paginated transaction history |
| GET | /wallet/rewards | JWT | Rewards points balance |
| POST | /wallet/rewards/redeem | JWT | Redeem points to wallet credit |

**PostgreSQL Schema:**

```sql
-- wallet_db

CREATE TABLE wallets (
    user_id UUID PRIMARY KEY,
    currency VARCHAR(3) NOT NULL,
    balance NUMERIC(18,2) DEFAULT 0,
    held_balance NUMERIC(18,2) DEFAULT 0,
    rewards_points INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_user_id UUID NOT NULL REFERENCES wallets(user_id),
    type VARCHAR(30) NOT NULL,
    -- credit, debit, hold, release, cashback, rewards_credit, rewards_redemption
    amount NUMERIC(18,2) NOT NULL,
    balance_after NUMERIC(18,2) NOT NULL,
    reference_id UUID, -- payment_id, transfer_id, etc.
    description TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RabbitMQ Events Consumed:**
- `order.completed` → credit cashback to buyer wallet
- `payment.escrow_release` → credit seller wallet

---

### 2.9 Inventory Service

**Responsibilities:** SKU stock records per branch, barcode/QR generation, stock movements, branch transfers, low-stock alerts, damage records.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /inventory/{branch_id}/stock | JWT (Branch Manager) | List stock records |
| GET | /inventory/{branch_id}/sku/{sku} | JWT | Get SKU stock detail |
| POST | /inventory/transfers | JWT (Branch Manager) | Initiate branch transfer |
| POST | /inventory/damage | JWT (Branch Manager) | Record stock damage |
| GET | /inventory/sku/{sku}/history | JWT | Stock movement history |
| GET | /inventory/sku/{sku}/barcode | JWT | Download barcode/QR assets |

**PostgreSQL Schema:**

```sql
-- inventory_db

CREATE TABLE stock_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL,
    product_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    quantity_on_hand INTEGER DEFAULT 0,
    quantity_reserved INTEGER DEFAULT 0,
    quantity_damaged INTEGER DEFAULT 0,
    reorder_threshold INTEGER DEFAULT 0,
    barcode_s3_key TEXT,
    qr_code_s3_key TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (sku, branch_id)
);

CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL,
    from_branch_id UUID NOT NULL,
    to_branch_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled
    initiated_by UUID,
    confirmed_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_damage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL,
    branch_id UUID NOT NULL,
    quantity_damaged INTEGER NOT NULL,
    reason TEXT,
    recorded_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL,
    branch_id UUID NOT NULL,
    movement_type VARCHAR(30) NOT NULL,
    -- sale, transfer_out, transfer_in, damage, adjustment, initial
    quantity_delta INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RabbitMQ Events Consumed:**
- `order.confirmed` → decrement quantity_reserved
- `branch.created` → initialise empty stock ledger for branch

**RabbitMQ Events Produced:**
- `inventory.low_stock` → Notification Service

---

### 2.10 Logistics Service

**Responsibilities:** Multi-carrier shipping quotes, shipment creation, tracking status via webhooks, delivery proof collection.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /logistics/quote | JWT (Seller) | Get shipping quotes from all carriers |
| POST | /logistics/shipments | JWT (Seller) | Create shipment with selected carrier |
| GET | /logistics/shipments/{tracking_no} | JWT | Get shipment tracking status |
| POST | /logistics/webhook/{carrier} | Carrier HMAC | Receive carrier status webhook |

**PostgreSQL Schema:**

```sql
-- logistics_db

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    carrier VARCHAR(30) NOT NULL, -- gig, dhl, fedex, local_rider
    tracking_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'created',
    origin_address JSONB NOT NULL,
    destination_address JSONB NOT NULL,
    weight_kg NUMERIC(8,3),
    dimensions_cm JSONB,
    estimated_delivery DATE,
    carrier_tracking_url TEXT,
    proof_asset_url TEXT,
    proof_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    carrier_status VARCHAR(100),
    description TEXT,
    occurred_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RabbitMQ Events Produced:**
- `shipment.updated` → Payment Service (trigger 72h auto-release check), Notification

**External Integrations:** GIG Logistics API, DHL API, FedEx API, local rider dispatch API

---

### 2.11 Analytics Service

**Responsibilities:** Revenue and order dashboards, per-branch and consolidated reporting, retention metrics, CSV/PDF exports.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /analytics/seller/{seller_id}/summary | JWT | Revenue/orders summary |
| GET | /analytics/branch/{branch_id}/summary | JWT (Branch Manager) | Branch metrics |
| GET | /analytics/business/{business_id}/overview | JWT (Business Owner) | Consolidated dashboard |
| GET | /analytics/seller/{seller_id}/top-listings | JWT | Top 20 listings by revenue |
| GET | /analytics/seller/{seller_id}/retention | JWT | Customer retention report |
| GET | /analytics/export | JWT | Export report (CSV/PDF) |

**PostgreSQL Schema:**

```sql
-- analytics_db

CREATE TABLE order_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL,
    seller_id UUID NOT NULL,
    branch_id UUID,
    buyer_id UUID NOT NULL,
    listing_id UUID NOT NULL,
    revenue NUMERIC(18,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type VARCHAR(20) NOT NULL, -- seller, branch, business
    scope_id UUID NOT NULL,
    period VARCHAR(10) NOT NULL, -- daily, weekly, monthly
    period_start DATE NOT NULL,
    total_revenue NUMERIC(18,2),
    total_orders INTEGER,
    avg_order_value NUMERIC(18,2),
    unique_customers INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (scope_type, scope_id, period, period_start)
);
```

**RabbitMQ Events Consumed:**
- `order.completed` → append order_facts record, refresh snapshots

---

### 2.12 Notification Service

**Responsibilities:** Multi-channel delivery (FCM push, SMS, email, WhatsApp), preference management, notification history, retry logic.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /notifications/send | Internal | Dispatch notification |
| GET | /notifications/history | JWT | Last 90 days notification history |
| PATCH | /notifications/preferences | JWT | Update channel preferences |

**PostgreSQL Schema:**

```sql
-- notification_db

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY,
    push_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    channel VARCHAR(20) NOT NULL, -- push, sms, email, whatsapp
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
    attempts SMALLINT DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RabbitMQ Events Consumed:**
- All services publish notification request events consumed here

**External Integrations:** Firebase FCM, Africa's Talking SMS, AWS SES, SendGrid, WhatsApp Business API

---

### 2.13 CRM Service

**Responsibilities:** Customer records per Buyer-Seller pair, purchase history, timestamped notes, scoped search.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /crm/customers | JWT (Seller) | Search CRM records |
| GET | /crm/customers/{buyer_id} | JWT (Seller) | Get customer record |
| POST | /crm/customers/{buyer_id}/notes | JWT (Seller) | Add note |
| GET | /crm/customers/{buyer_id}/orders | JWT (Seller) | Purchase history |

**PostgreSQL Schema:**

```sql
-- crm_db

CREATE TABLE customer_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    branch_id UUID,
    first_contact_at TIMESTAMPTZ,
    total_orders INTEGER DEFAULT 0,
    total_spend NUMERIC(18,2) DEFAULT 0,
    buyer_phone VARCHAR(20),
    buyer_email VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (seller_id, buyer_id)
);

CREATE TABLE customer_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES customer_records(id),
    content VARCHAR(1000) NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES customer_records(id),
    order_id UUID NOT NULL,
    listing_id UUID NOT NULL,
    category VARCHAR(100),
    amount NUMERIC(18,2),
    completed_at TIMESTAMPTZ NOT NULL
);
```

**RabbitMQ Events Consumed:**
- `order.completed` → upsert customer_records, append customer_orders

---

### 2.14 Subscription Service

**Responsibilities:** SaaS tier management, feature entitlement gates, billing, FX-converted invoicing, Enterprise contract overrides.

**Key API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /subscriptions/tiers | None | List available tiers |
| GET | /subscriptions/me | JWT | Get current subscription |
| POST | /subscriptions/upgrade | JWT | Upgrade tier |
| POST | /subscriptions/downgrade | JWT | Schedule downgrade |
| GET | /subscriptions/invoices | JWT | List invoices |
| POST | /subscriptions/enterprise | JWT (Admin) | Create Enterprise contract |

**PostgreSQL Schema:**

```sql
-- subscription_db

CREATE TABLE subscriptions (
    user_id UUID PRIMARY KEY,
    tier VARCHAR(20) NOT NULL DEFAULT 'starter',
    billing_cycle_start DATE,
    billing_cycle_end DATE,
    scheduled_downgrade_tier VARCHAR(20),
    downgrade_effective_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tier VARCHAR(20) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    fx_rate NUMERIC(12,6),
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed
    payment_ref VARCHAR(255),
    invoice_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tier_entitlements (
    tier VARCHAR(20) PRIMARY KEY,
    max_active_listings INTEGER, -- NULL = unlimited
    analytics_retention_days INTEGER,
    ai_bi_access BOOLEAN DEFAULT FALSE,
    multi_branch_access BOOLEAN DEFAULT FALSE,
    custom_domain_access BOOLEAN DEFAULT FALSE,
    transaction_fee_pct NUMERIC(5,4) DEFAULT 0.03,
    cashback_rate NUMERIC(5,4) DEFAULT 0.005
);

CREATE TABLE enterprise_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    custom_features JSONB,
    monthly_price NUMERIC(18,2),
    currency VARCHAR(3),
    billing_schedule VARCHAR(20),
    effective_from DATE,
    effective_to DATE
);
```

**RabbitMQ Events Produced:**
- `subscription.tier_changed` → User Service (update profile tier)

---

## 3. RabbitMQ Event Catalog

| Event | Producer | Consumer(s) | Key Payload Fields |
|-------|----------|-------------|-------------------|
| `user.registered` | Auth | User | user_id, email, phone, country |
| `user.phone_verified` | Auth | User | user_id |
| `listing.created` | Marketplace | Search | listing_id, fields for index |
| `listing.updated` | Marketplace | Search | listing_id, changed fields |
| `listing.deleted` | Marketplace | Search | listing_id |
| `order.confirmed` | Payment | Inventory, CRM, Analytics, Notification | order_id, seller_id, buyer_id, listing_id, sku, branch_id, amount |
| `order.completed` | Payment | Wallet, Analytics, CRM, Notification | order_id, seller_id, buyer_id, amount, currency |
| `payment.fraud_flagged` | Payment | Notification, User | user_id, payment_id |
| `shipment.updated` | Logistics | Payment, Notification | shipment_id, order_id, status, tracking_no |
| `branch.created` | User | Inventory | branch_id, business_id |
| `subscription.tier_changed` | Subscription | User | user_id, new_tier, old_tier |
| `inventory.low_stock` | Inventory | Notification | sku, branch_id, quantity_on_hand |
| `review.submitted` | Marketplace | AI (spam check) | review_id, listing_id, comment_text |
| `booking.status_changed` | Marketplace | Notification, Payment | booking_id, status, buyer_id, seller_id |
| `job_application.status_changed` | Marketplace | Notification | application_id, status, applicant_id |

---

## 4. Key Data Flows

### 4.1 User Registration + Phone OTP Verification

```
Client → POST /auth/register
  Auth Service validates input, hashes password (bcrypt cost=12)
  Auth Service creates user record (is_active=false)
  Auth Service generates OTP, stores hash in Redis (TTL 5min)
  Auth Service sends OTP via SMS (Notification Service)
  Auth Service → returns 201 (user_id, "verify phone to activate")

Client → POST /auth/verify-phone {otp}
  Auth Service validates OTP hash from Redis
  Auth Service sets user.is_active = true
  Auth Service publishes user.phone_verified → RabbitMQ
  User Service consumes event → sets trust_badge = 'bronze'
  Auth Service → returns 200 (account activated)
```

### 4.2 Buyer Purchases Product with Escrow

```
Client → POST /payments/initiate {order_id, payment_method}
  Payment Service validates order details
  Payment Service calls fraud scoring model
  IF fraud_score > threshold → reject, publish payment.fraud_flagged
  Payment Service charges gateway (Paystack/Flutterwave/M-Pesa/Wallet)
  Payment Service sets payment.status = 'held_in_escrow'
  Payment Service sets auto_release_at = NOW() + 72h (after delivery)
  Payment Service publishes order.confirmed → RabbitMQ
    → Inventory Service decrements quantity_reserved (-30s)
    → Notification Service alerts Seller
    → Analytics Service records order_fact
    → CRM Service upserts customer_record

[Logistics delivers, carrier webhook received]
  Logistics Service updates shipment.status = 'delivered'
  Logistics Service publishes shipment.updated
  Payment Service receives event, starts 72h countdown

[Buyer confirms delivery]
  Client → POST /payments/{id}/confirm-delivery
  Payment Service releases escrowed funds to Seller Wallet
  Payment Service publishes order.completed
    → Wallet Service credits cashback to Buyer
    → Analytics Service updates revenue metrics
    → Notification Service alerts Seller (funds released)
```

### 4.3 AI Search Query Flow

```
Client → POST /search/ai {query: "Toyota under 10 million in Lagos"}
  Search Service receives NL query
  Search Service → POST /ai/search/parse (sync HTTP to AI Service)
  AI Service parses intent: {make:"Toyota", price_max:10000000, city:"Lagos"}
  AI Service returns structured filter object
  Search Service executes Elasticsearch query with parsed filters
  Search Service returns paginated results to client
  [If AI Service unavailable → fallback to BM25 keyword search on raw query]
```

### 4.4 Inventory Decrement on Order

```
RabbitMQ: order.confirmed event received by Inventory Service
  Inventory Service reads event {order_id, sku, branch_id, quantity}
  Inventory Service checks quantity_reserved >= ordered_quantity
  IF insufficient → log error, publish inventory.adjustment_needed
  ELSE:
    UPDATE stock_records SET
      quantity_reserved = quantity_reserved - ordered_quantity,
      quantity_on_hand = quantity_on_hand - ordered_quantity
    WHERE sku = ? AND branch_id = ?
  IF quantity_on_hand < reorder_threshold:
    → publish inventory.low_stock event
    → Notification Service alerts Branch Manager + Business Owner
  Inventory Service appends stock_movements record
```

---

## 5. Security Design

### 5.1 JWT Claims Structure

```json
{
  "sub": "user-uuid",
  "iss": "velontri-auth",
  "aud": "velontri-platform",
  "exp": 1234567890,
  "iat": 1234567890,
  "jti": "token-uuid",
  "roles": ["seller", "branch_manager"],
  "branch_ids": ["branch-uuid-1"],
  "business_ids": ["business-uuid-1"],
  "subscription_tier": "pro",
  "country": "NG"
}
```

### 5.2 RBAC Permission Matrix

| Permission | Guest | Buyer | Seller | Agent | Branch Mgr | Business Owner | Enterprise Admin |
|------------|-------|-------|--------|-------|------------|----------------|-----------------|
| Browse listings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Purchase / book | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create listings | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ |
| Manage own inventory | ✗ | ✗ | ✓ | ✗ | ✓* | ✓ | ✓ |
| Manage branch staff | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| View branch analytics | ✗ | ✗ | ✗ | ✗ | ✓* | ✓ | ✓ |
| View all-branch analytics | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| AI BI access | ✗ | ✗ | Pro+ | ✗ | Pro+ | Pro+ | ✓ |
| Manage enterprise | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

*Scoped to assigned branch only

### 5.3 API Gateway Auth Flow

```
Client Request → API Gateway
  1. Check for Authorization: Bearer {token}
  2. Validate JWT signature (RS256, public key from Auth Service)
  3. Check aud == "velontri-platform"
  4. Check exp not expired
  5. Apply rate limiting: 10 auth requests/min/IP
  6. Forward X-User-Id, X-User-Roles, X-Subscription-Tier headers to service
  7. Service uses forwarded headers for authorization (no re-validation needed)
```

---

## 6. Subscription Feature Gate Matrix

| Feature | Starter | Growth | Pro | Enterprise |
|---------|---------|--------|-----|------------|
| Active listings | 10 | 100 | Unlimited | Unlimited |
| Analytics retention | 30 days | 90 days | 1 year | Custom |
| AI Business Intelligence | ✗ | ✗ | ✓ | ✓ |
| Multi-branch access | ✗ | ✗ | ✓ | ✓ |
| Custom domain | ✗ | ✗ | ✓ | ✓ |
| 360° media upload | ✗ | ✗ | ✓ | ✓ |
| Transaction fee | 3.5% | 2.5% | 1.5% | Custom |
| Cashback rate | 0.5% | 1% | 2% | Custom |
| Priority support | ✗ | ✗ | ✓ | ✓ |
| Monthly price | Free | ₦10,000 | ₦50,000 | Contract |

---

## 7. Infrastructure Layout

### 7.1 Docker Compose Services (Local Dev)

```yaml
services:
  api-gateway:       # Kong or Nginx reverse proxy
  auth-service:      # port 8001
  user-service:      # port 8002
  marketplace-service: # port 8003
  search-service:    # port 8004
  ai-service:        # port 8005
  chat-service:      # port 8006 (WebSocket)
  payment-service:   # port 8007
  wallet-service:    # port 8008
  inventory-service: # port 8009
  logistics-service: # port 8010
  analytics-service: # port 8011
  notification-service: # port 8012
  crm-service:       # port 8013
  subscription-service: # port 8014

  # Databases (one per service in prod, shared in local dev)
  postgres:          # port 5432
  redis:             # port 6379
  elasticsearch:     # port 9200
  rabbitmq:          # port 5672, management 15672

  # Observability
  prometheus:        # port 9090
  grafana:           # port 3000
```

### 7.2 Kubernetes Namespace Strategy

```
velontri-prod/
  namespaces:
    - velontri-auth
    - velontri-users
    - velontri-marketplace
    - velontri-search
    - velontri-ai
    - velontri-chat
    - velontri-payments
    - velontri-wallet
    - velontri-inventory
    - velontri-logistics
    - velontri-analytics
    - velontri-notifications
    - velontri-crm
    - velontri-subscriptions
    - velontri-infra        # RabbitMQ, Redis, Elasticsearch
    - velontri-observability # Prometheus, Grafana

HPA config per service:
  minReplicas: 2
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
```

### 7.3 AWS S3 Bucket Organisation

```
velontri-media/
  listings/{listing_id}/images/
  listings/{listing_id}/videos/
  listings/{listing_id}/tours/
  listings/{listing_id}/inspection_reports/
  reviews/{review_id}/media/
  chat/{thread_id}/media/
  kyc/{user_id}/documents/
  inventory/barcodes/{sku}/
  inventory/qrcodes/{sku}/
  cv/{application_id}/

velontri-exports/
  analytics/{seller_id}/reports/
  (auto-expire: 7 days via lifecycle policy)
```

---

## 8. Property-Based Testing Correctness Properties

The following invariants MUST hold at all times and should be validated with property-based tests (e.g., Hypothesis for Python):

### Property 1 — Wallet Balance Non-Negative

```python
# For any wallet after any sequence of operations:
@given(operations=wallet_operations_strategy())
def test_wallet_balance_never_negative(operations):
    wallet = Wallet(initial_balance=Decimal("0"))
    for op in operations:
        try:
            wallet.apply(op)
        except InsufficientFundsError:
            pass  # expected rejection
    assert wallet.balance >= Decimal("0")
    assert wallet.held_balance >= Decimal("0")
```

### Property 2 — Escrow Funds Conservation

```python
# Buyer payment amount == seller release amount + platform fee
@given(payment=payment_strategy())
def test_escrow_conservation(payment):
    escrow = EscrowTransaction(payment)
    assert escrow.buyer_charge == escrow.seller_release + escrow.platform_fee
```

### Property 3 — Inventory Quantities Consistency

```python
# quantity_on_hand >= 0 always; quantity_reserved <= quantity_on_hand
@given(movements=stock_movement_strategy())
def test_inventory_quantities_consistent(movements):
    stock = StockRecord(initial_qty=100)
    for movement in movements:
        try:
            stock.apply(movement)
        except InsufficientStockError:
            pass
    assert stock.quantity_on_hand >= 0
    assert stock.quantity_reserved >= 0
    assert stock.quantity_reserved <= stock.quantity_on_hand
```

### Property 4 — JWT Token Expiry Enforcement

```python
# Expired tokens must always be rejected
@given(token=expired_jwt_strategy())
def test_expired_tokens_rejected(token):
    with pytest.raises(TokenExpiredError):
        auth_service.introspect(token)
```

### Property 5 — Search Result Relevance Monotonicity

```python
# More specific queries should return fewer or equal results than less specific
@given(query=search_query_strategy(), extra_filter=filter_strategy())
def test_adding_filter_reduces_results(query, extra_filter):
    base_results = search_service.search(query)
    filtered_results = search_service.search(query, filters=[extra_filter])
    assert len(filtered_results) <= len(base_results)
```

### Property 6 — Subscription Quota Enforcement

```python
# Sellers cannot exceed their tier's active listing quota
@given(seller=seller_strategy(), listings=listing_list_strategy())
def test_listing_quota_enforced(seller, listings):
    quota = get_tier_quota(seller.subscription_tier)
    accepted = 0
    for listing in listings:
        try:
            marketplace.create_listing(seller, listing)
            accepted += 1
        except QuotaExceededError:
            pass
    if quota is not None:
        assert accepted <= quota
```

### Property 7 — Multi-Currency FX Display Consistency

```python
# If two listings have the same price in the same currency,
# they should display the same converted price for any given viewer currency
@given(price=decimal_strategy(), base_currency=currency_strategy(),
       view_currency=currency_strategy())
def test_fx_conversion_deterministic(price, base_currency, view_currency):
    rate = fx_service.get_rate(base_currency, view_currency)
    converted_1 = fx_service.convert(price, base_currency, view_currency)
    converted_2 = fx_service.convert(price, base_currency, view_currency)
    assert converted_1 == converted_2
```

---

## Correctness Properties

Seven executable property-based testing invariants are defined covering the platform's core financial and data integrity guarantees:

### Property 1: Wallet Balance Non-Negative
After any sequence of wallet operations (top-up, withdrawal, transfer, cashback), wallet.balance ≥ 0 and wallet.held_balance ≥ 0. Requests that would produce a negative balance must be rejected with InsufficientFundsError before any mutation occurs.

**Validates: Requirements 13.3, 13.4, 13.8**

### Property 2: Escrow Funds Conservation
For every completed payment transaction: buyer_charge_amount == seller_release_amount + platform_fee_amount. Funds cannot be created or destroyed by the escrow lifecycle — only transferred between parties.

**Validates: Requirements 12.1, 12.4, 12.7, 12.8, 12.9**

### Property 3: Inventory Quantity Consistency
At all times for every SKU-branch stock record: quantity_on_hand ≥ 0, quantity_reserved ≥ 0, and quantity_reserved ≤ quantity_on_hand. No order confirmation or transfer operation may result in negative stock quantities.

**Validates: Requirements 14.1, 14.3, 14.4**

### Property 4: JWT Expiry Enforcement
Any JWT with exp < current_time must be rejected by the introspect endpoint with a 401 response, regardless of signature validity or claim content. There are no grace periods.

**Validates: Requirements 1.3, 1.4, 22.7**

### Property 5: Search Result Monotonicity
For any base query Q and any additional filter F: |results(Q + F)| ≤ |results(Q)|. Adding constraints to a search can only reduce or preserve the result count, never increase it.

**Validates: Requirements 8.2, 8.3**

### Property 6: Subscription Quota Enforcement
For any Seller with subscription tier T having quota limit L: count of active listings ≤ L at all times. Any listing creation attempt that would exceed the quota is rejected with a 409 QuotaExceededError before the listing record is created. (Unlimited tiers have no upper bound.)

**Validates: Requirements 3.12, 20.2**

### Property 7: FX Conversion Determinism
For any price P denominated in currency C1, converting to C2 using the same FX rate snapshot always yields the same result: convert(P, C1, C2, rate) is a pure function with no side effects. Two calls with identical inputs within the same rate window return identical output.

**Validates: Requirements 24.2, 24.4, 24.5**

---

## Error Handling

### Service-Level Error Handling

All FastAPI services return structured JSON error responses:

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Available balance is less than the requested amount",
    "request_id": "uuid"
  }
}
```

Standard HTTP status codes:
- `400` — Validation error (invalid input)
- `401` — Missing or invalid JWT
- `403` — Insufficient permissions (RBAC)
- `404` — Resource not found
- `409` — Conflict (duplicate, quota exceeded)
- `422` — Unprocessable entity (business rule violation)
- `429` — Rate limit exceeded
- `500` — Internal server error
- `503` — Downstream dependency unavailable

### RabbitMQ Dead-Letter Queue (DLQ)

Every consumer queue has a paired DLQ. After 3 failed processing attempts, messages are routed to `{queue_name}.dlq`. A Grafana alert fires within 5 minutes of any DLQ receiving a message. The operations team is notified via the configured ops notification channel.

### External API Failures

- **Payment gateway failure** — return HTTP 503 to client; do not create escrow record; log failure
- **Carrier API failure** (shipment creation) — return HTTP 503; seller is notified to retry
- **VIN lookup failure** — set vin_history_status = 'unavailable'; listing proceeds without history
- **AI Service unavailable** (search) — Search Service falls back to raw BM25 keyword search
- **AI Service unavailable** (chat translation) — return original message without translation offer

---

## Testing Strategy

### Unit Tests
Each service has unit tests covering:
- Request validation (FastAPI dependency injection)
- Business logic functions (pure Python, no database)
- JWT claims parsing and validation
- Currency conversion calculations
- Escrow fee calculations

### Integration Tests
Per-service integration tests use a real PostgreSQL instance (Docker) and mock RabbitMQ:
- Database read/write operations
- Redis cache hit/miss behaviour
- S3 upload (mocked with moto)
- Webhook signature validation

### Property-Based Tests
Using the **Hypothesis** library (Python), the 7 correctness properties in Section 8 are implemented as executable tests that run against the real service logic with generated inputs.

### End-to-End Tests
Critical flows tested with a full local stack (Docker Compose):
1. User registration → OTP → login → listing creation → search → purchase → escrow release
2. Branch creation → inventory init → stock transfer → low-stock alert
3. Subscription upgrade → quota increase → feature gate unlock

### Performance Tests
- Search Service: p95 ≤ 500 ms under 1,000 concurrent search requests (k6)
- Chat Service: WebSocket message delivery ≤ 300 ms for 10,000 concurrent connections
- Autocomplete: ≤ 200 ms for 500 concurrent prefix queries

### Contract Tests
Inter-service HTTP contracts are validated using **Pact** consumer-driven contract testing to ensure the AI Service NL parse endpoint and Wallet Service transfer endpoint maintain backward-compatible response schemas.
