# Implementation Plan: Velontri Commerce Platform

## Overview

This plan breaks the Velontri Commerce Platform into four implementation phases:

- **Phase 1 â€” Foundation**: Shared infrastructure, project scaffolding, and the Auth + User services.
- **Phase 2 â€” Core Commerce**: Marketplace, Search, Payment, Wallet, and Inventory services.
- **Phase 3 â€” Fulfilment & Intelligence**: Logistics, AI, Chat, and Analytics services.
- **Phase 4 â€” CRM, Subscriptions & Operations**: CRM, Subscription, Notification services, and cross-cutting concerns (observability, multi-currency, fraud).

Each service is a self-contained Python/FastAPI application with its own PostgreSQL database. Property-based tests use the **Hypothesis** library.

---

## Tasks

---

### Phase 1 â€” Foundation

---

- [x] 1. Scaffold shared project infrastructure
  - Create monorepo directory structure: one sub-directory per service (`auth-service/`, `user-service/`, â€¦, `subscription-service/`), plus `infra/`, `shared/`, and `tests/contract/`
  - Add `docker-compose.yml` with all 14 FastAPI services plus postgres, redis, elasticsearch, rabbitmq, prometheus, and grafana as defined in Design Â§7.1
  - Add per-service `Dockerfile` (python:3.12-slim base, non-root user, multi-stage build)
  - Create `shared/` Python package with: `jwt_utils.py` (RS256 sign/verify), `rabbitmq.py` (aio-pika publish/consume helpers), `s3.py` (boto3 upload/presign helpers), `errors.py` (standard JSON error schema), `metrics.py` (Prometheus Starlette middleware)
  - Create `shared/models/base.py`: SQLAlchemy 2.x `AsyncSession` factory and `Base` declarative base
  - Add per-service `alembic.ini` and initial empty migration
  - _Requirements: 23.5_

- [x] 2. Implement Auth Service â€” core authentication
  - [x] 2.1 Create Auth Service database models and Alembic migration
    - Implement SQLAlchemy models for `users`, `refresh_tokens`, `devices`, `login_history`, `otps`, `totp_secrets`, `audit_logs` (Design Â§2.1 schema)
    - _Requirements: 1.1, 1.3, 1.7, 1.8_

  - [x] 2.2 Implement registration, phone OTP, and account activation endpoints
    - `POST /auth/register` â€” validate input, hash password (bcrypt cost=12), create inactive user, generate OTP, store in Redis (`auth:otp:{user_id}:phone_verify`, TTL 5 min), emit `user.registered` to RabbitMQ
    - `POST /auth/verify-phone` â€” validate OTP hash from Redis, activate user, emit `user.phone_verified` to RabbitMQ
    - _Requirements: 1.1, 1.2, 22.1_

  - [x] 2.3 Implement login, JWT issuance, and token refresh
    - `POST /auth/login` â€” validate credentials, enforce lockout check, issue access token (15-min JWT RS256) + refresh token (7-day), record login history and device fingerprint
    - `POST /auth/token/refresh` â€” validate refresh token hash, issue new access token
    - Account lockout: after 5 consecutive failures within 15 min, set `is_locked=true`, store in Redis `auth:lockout:{user_id}` (TTL 15 min), send lockout email via Notification event
    - _Requirements: 1.3, 1.4, 1.7, 1.8_

  - [x] 2.4 Implement 2FA (SMS OTP + TOTP) endpoints
    - `POST /auth/2fa/enable` â€” generate TOTP secret (pyotp), encrypt and store in `totp_secrets`
    - `POST /auth/2fa/verify` â€” verify TOTP code (RFC 6238) or SMS OTP before completing login
    - _Requirements: 1.5, 22.5_

  - [x] 2.5 Implement OAuth 2.0 login (Google and Apple)
    - `POST /auth/login/oauth` â€” exchange provider token, look up or create user, issue Velontri JWT pair
    - _Requirements: 1.6_

  - [x] 2.6 Implement device tracking, new-device alert, and password reset endpoints
    - `GET /auth/devices`, `DELETE /auth/devices/{device_id}` â€” list and revoke registered devices
    - `POST /auth/password/reset-request` â€” generate reset token, store in Redis (`auth:reset_token:{hash}`, TTL 30 min), send email
    - `POST /auth/password/reset` â€” validate token, update password hash, revoke all refresh tokens for user
    - New-device alert: on login from unknown fingerprint, publish notification event before completing session
    - Audit log entries for: role change, 2FA toggle, device revocation, password reset
    - _Requirements: 1.7, 1.9, 1.11, 22.6, 22.8_

  - [x] 2.7 Implement token introspection and rate limiting
    - `GET /auth/introspect` â€” decode JWT, return `user_id`, `roles`, `subscription_tier`
    - Add sliding-window rate limiter middleware: max 10 auth requests/min/IP, respond HTTP 429 (`auth:rate_limit:{ip}` Redis key)
    - _Requirements: 1.12, 22.2, 22.3, 22.7_

  - [x] 2.8 Write property test for JWT expiry enforcement
    - **Property 4: JWT Expiry Enforcement**
    - Generate expired tokens with `expired_jwt_strategy()` using Hypothesis; assert `auth_service.introspect(token)` raises `TokenExpiredError` for every generated token
    - **Validates: Requirements 1.3, 1.4, 22.7**

  - [x] 2.9 Write unit tests for Auth Service
    - Test bcrypt hashing and verification, OTP generation and TTL expiry, lockout counter logic, refresh token rotation, TOTP RFC-6238 window acceptance, OAuth token mapping
    - _Requirements: 1.1â€“1.12, 22.1â€“22.8_

- [x] 3. Checkpoint â€” Auth Service
  - Ensure all Auth Service tests pass and `docker compose up auth-service` is healthy. Ask the user if questions arise.

- [x] 4. Implement User Service â€” profiles, trust badges, RBAC
  - [x] 4.1 Create User Service database models and Alembic migration
    - Implement SQLAlchemy models for `profiles`, `user_roles`, `businesses`, `branches`, `branch_staff`, `kyc_documents` (Design Â§2.2 schema)
    - _Requirements: 2.1, 15.1_

  - [x] 4.2 Implement profile management and subscription tier sync
    - `GET /users/{user_id}/profile`, `PATCH /users/me/profile` â€” create, read, update profile record
    - Consume `user.registered` event â†’ create profile record; consume `user.phone_verified` â†’ set `trust_badge = 'bronze'`
    - Consume `subscription.tier_changed` â†’ update `subscription_tier` on profile within 60 s
    - _Requirements: 2.1, 2.2, 2.8, 2.9_

  - [x] 4.3 Implement KYC document upload and trust badge promotion
    - `POST /users/me/kyc/government-id` â€” upload govt ID to S3 (`kyc/{user_id}/documents/`), create `kyc_documents` record, trigger automated validation stub, promote to Silver within 24 h
    - `POST /users/me/kyc/business-reg` â€” same flow for Gold badge (48 h SLA)
    - Diamond badge promotion via admin confirmation endpoint
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 4.4 Implement business, branch entities, and RBAC enforcement
    - `POST /businesses`, `POST /businesses/{id}/branches`, `GET /businesses/{id}/branches`
    - `PATCH /users/{user_id}/roles` â€” elevate roles, persist `user_roles` with optional `scope_id`
    - Enforce Branch Manager scope: middleware checks `scope_id` in JWT `branch_ids` claim against requested branch
    - Emit `branch.created` to RabbitMQ on branch creation
    - _Requirements: 2.7, 15.1, 15.2_

  - [x] 4.5 Write unit tests for User Service
    - Test trust badge state machine (none â†’ bronze â†’ silver â†’ gold â†’ diamond), RBAC scope enforcement, subscription tier sync on event receipt, KYC status transitions
    - _Requirements: 2.1â€“2.9, 15.1â€“15.2_

- [x] 5. Checkpoint â€” User Service
  - Ensure all User Service tests pass and the `user.registered` / `user.phone_verified` / `subscription.tier_changed` event flows work end-to-end. Ask the user if questions arise.

---

### Phase 2 â€” Core Commerce

---

- [x] 6. Implement Marketplace Service â€” listings and media
  - [x] 6.1 Create Marketplace Service database models and Alembic migration
    - Implement SQLAlchemy models for `listings`, `listing_media`, `listing_specs`, `listing_variants`, `property_details`, `shortlet_availability`, `vehicle_details`, `job_details`, `job_applications`, `reviews`, `review_media`, `stores`, `bookings` (Design Â§2.3 schema)
    - _Requirements: 3.1, 3.2, 4.1, 5.1, 6.1, 7.1_

  - [x] 6.2 Implement core listing CRUD and media upload
    - `POST /listings` â€” accept all required fields, create listing with `status='draft'`, enforce listing quota via Redis key `marketplace:seller_listing_count:{seller_id}`
    - `PATCH /listings/{id}` â€” update listing fields, invalidate cache
    - `POST /listings/{id}/images` â€” validate format (JPEG/PNG/WebP/AVIF) and size (â‰¤20 MB), upload to S3 (`listings/{id}/images/`), insert `listing_media` record
    - `POST /listings/{id}/publish` â€” set status to `pending_review`, publish notification to moderation queue
    - `PATCH /listings/{id}/status` â€” approve/reject; on approval set `status='active'`, emit `listing.created` to RabbitMQ; reject with reason
    - Cache listing detail in Redis `marketplace:listing:{id}` TTL 5 min
    - _Requirements: 3.1, 3.3, 3.4, 3.9, 3.10_

  - [x] 6.3 Implement listing variants, specifications, and out-of-stock automation
    - Support product variants with SKU, attributes JSONB, independent price and stock
    - Accept structured specifications per category via `listing_specs`
    - When variant `stock_quantity` reaches zero, auto-update listing `status='out_of_stock'` and emit `listing.updated`
    - _Requirements: 3.7, 3.8, 3.11_

  - [x] 6.4 Implement video, 360Â° media, and subscription tier gates
    - `POST /listings/{id}/videos` â€” accept MP4/MOV â‰¤500 MB, upload to S3 (`listings/{id}/videos/`)
    - `POST /listings/{id}/tour` â€” gate on Pro/Enterprise tier (check JWT `subscription_tier`), accept equirectangular image or HTML bundle, store in S3
    - _Requirements: 3.5, 3.6, 6.2_

  - [x] 6.5 Implement property-specific listing features
    - Accept property fields (type, bedrooms, bathrooms, area, furnishing, amenities, GPS) into `property_details`
    - Embed interactive map view using stored GPS coordinates on listing detail
    - Display virtual tour asset when present
    - `GET /listings/{id}/mortgage-calculator?price=&deposit=&rate=&term=` â€” return estimated monthly repayment: `P * r(1+r)^n / ((1+r)^n - 1)`
    - Shortlet listings: accept per-night price and availability calendar (`shortlet_availability`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.6 Implement vehicle-specific listing features and VIN lookup
    - Accept vehicle fields into `vehicle_details`
    - On listing creation with VIN: async call to VIN lookup provider, attach history report within 2 min; on error set `vin_history_status='unavailable'` and store error reason
    - Display inspection report section; accept PDF upload to S3 (`listings/{id}/inspection_reports/`)
    - Display financing repayment estimate using configurable deposit % and interest rate
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.7 Implement jobs marketplace, CV upload, and application lifecycle
    - Accept job listing fields into `job_details`
    - `POST /listings/{id}/applications` â€” accept CV (PDF/DOCX â‰¤10 MB) to S3 (`cv/{application_id}/`), create `job_applications` record
    - After CV upload: publish `cv.uploaded` event to AI Service for async scoring (score stored on application record within 3 min)
    - `PATCH /applications/{id}/status` â€” record reviewer, timestamp, status change (Shortlisted/Rejected/Hired), emit `job_application.status_changed`
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6_

  - [x] 6.8 Implement services marketplace and booking lifecycle
    - Accept service listing fields including pricing structure, availability schedule, service area
    - `POST /bookings` â€” create booking with `status='pending'`, emit `booking.status_changed` to Notification Service (within 30 s)
    - `PATCH /bookings/{id}/status` â€” Seller accept: set `status='confirmed'`, block calendar slot, notify Buyer; mark done: emit `booking.status_changed` for escrow release trigger
    - Consume `order.completed` â†’ unlock review eligibility for buyer on that listing
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.9 Implement reviews, ratings, and store entities
    - `POST /listings/{id}/reviews` â€” verify buyer has completed order, accept rating (1â€“5), comment (â‰¤2000 chars), up to 5 images (â‰¤10 MB each) and 1 video (â‰¤100 MB), publish `review.submitted` to AI Service for spam check
    - Update rolling `avg_rating` and `review_count` on `listings` and seller-level rating within 60 s
    - Quarantine review when AI spam confidence > 0.85
    - Allow seller one public response (â‰¤1000 chars) per review
    - `POST /stores` â€” create/update store with name, logo, banner, theme, optional custom_domain
    - On `custom_domain` submission: verify DNS CNAME resolution before activating
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 3.13, 3.14_

  - [x] 6.10 Write property test for subscription quota enforcement
    - **Property 6: Subscription Quota Enforcement**
    - Use Hypothesis `seller_strategy()` + `listing_list_strategy()`; assert accepted listing count â‰¤ tier quota after any sequence of create attempts
    - **Validates: Requirements 3.12, 20.2**

  - [x] 6.11 Write unit tests for Marketplace Service
    - Test listing quota enforcement per tier, out-of-stock trigger, VIN lookup error handling, mortgage calculator formula, review eligibility gate, DNS CNAME check logic, media format/size validators
    - _Requirements: 3.1â€“3.14, 4.1â€“4.5, 5.1â€“5.5, 6.1â€“6.6, 7.1â€“7.5, 11.1â€“11.6_

- [x] 7. Checkpoint â€” Marketplace Service
  - Ensure all Marketplace tests pass and listing creation â†’ RabbitMQ `listing.created` event fires correctly. Ask the user if questions arise.

- [x] 8. Implement Search Service â€” Elasticsearch indexing and query
  - [x] 8.1 Create Elasticsearch index and RabbitMQ consumer
    - Create `listings` index with mapping from Design Â§2.4
    - Consume `listing.created` â†’ index document; `listing.updated` â†’ update; `listing.deleted` â†’ delete; all within 5 min of event receipt
    - _Requirements: 8.1_

  - [x] 8.2 Implement keyword search, filtering, and pagination
    - `GET /search` â€” accept query string + filter params (price range, location, category, subcategory, brand, condition, availability, trust badge), execute BM25 Elasticsearch query, return paginated results (default 20, max 100) with total count and next-page cursor, p95 â‰¤ 500 ms
    - _Requirements: 8.2, 8.3, 8.6_

  - [x] 8.3 Implement autocomplete, voice search, and AI natural-language search
    - `GET /search/autocomplete` â€” prefix query on title and category fields, cache result in Redis `search:autocomplete:{prefix}` TTL 60 s, return â‰¤10 suggestions within 200 ms
    - `POST /search/voice` â€” accept audio file, call `POST /ai/search/transcribe` (sync HTTP), execute text query with result
    - `POST /search/ai` â€” forward NL query to `POST /ai/search/parse`, execute structured Elasticsearch query; fallback to raw BM25 if AI Service unavailable
    - _Requirements: 8.4, 8.5, 8.7_

  - [x] 8.4 Write property test for search result monotonicity
    - **Property 5: Search Result Monotonicity**
    - Use Hypothesis `search_query_strategy()` + `filter_strategy()`; assert `len(search(q, filters=[f])) <= len(search(q))`
    - **Validates: Requirements 8.2, 8.3**

  - [x] 8.5 Write unit tests for Search Service
    - Test BM25 ranking, filter combinations, autocomplete prefix matching, pagination cursor correctness, voice search transcription integration, AI fallback on service unavailability
    - _Requirements: 8.1â€“8.7_

- [x] 9. Implement Payment Service â€” escrow lifecycle and gateways
  - [x] 9.1 Create Payment Service database models and Alembic migration
    - Implement SQLAlchemy models for `payments`, `disputes`, `fraud_scores` (Design Â§2.7 schema)
    - _Requirements: 12.1, 12.6, 22.4_

  - [x] 9.2 Implement payment initiation, gateway routing, and escrow hold
    - `POST /payments/initiate` â€” validate order, call fraud-scoring model; reject if score > threshold (record `fraud_scores`, publish `payment.fraud_flagged`); charge via Paystack/Flutterwave/M-Pesa/Wallet based on currency and country routing; set `status='held_in_escrow'`, set `auto_release_at = NOW() + 72h`; publish `order.confirmed`
    - `POST /payments/webhook/{gateway}` â€” validate HMAC signature, update payment status on confirmation
    - _Requirements: 12.1, 12.2, 12.3, 22.4, 22.9_

  - [x] 9.3 Implement delivery confirmation, auto-release, and dispute flow
    - `POST /payments/{id}/confirm-delivery` â€” release escrowed funds to Seller Wallet via `POST /wallet/...` (sync), publish `order.completed`, complete within 1 h
    - Consume `shipment.updated` (delivered status): start 72 h auto-release countdown; on timeout auto-release funds, notify both parties
    - `POST /payments/{id}/dispute` â€” freeze escrow, create `disputes` record with `status='open'` if raised within 72 h of delivery
    - `PATCH /disputes/{id}/resolve` â€” release to Buyer or Seller wallet within 1 h per decision
    - _Requirements: 12.4, 12.5, 12.6, 12.7, 12.8_

  - [x] 9.4 Implement platform transaction fee calculation and multi-currency display
    - Calculate fee at Seller's tier rate, record `fee_amount` on transaction
    - Display converted amount in user's default currency alongside transaction currency before confirmation
    - _Requirements: 12.9, 24.3, 24.4_

  - [x] 9.5 Write property test for escrow funds conservation
    - **Property 2: Escrow Funds Conservation**
    - Use Hypothesis `payment_strategy()`; assert `escrow.buyer_charge == escrow.seller_release + escrow.platform_fee` for every generated payment scenario
    - **Validates: Requirements 12.1, 12.4, 12.7, 12.8, 12.9**

  - [x] 9.6 Write unit tests for Payment Service
    - Test gateway routing by currency/country, HMAC webhook validation, fraud score threshold rejection, 72 h auto-release timer, dispute freeze logic, fee calculation per tier
    - _Requirements: 12.1â€“12.9, 22.4, 22.9_

- [x] 10. Implement Wallet Service â€” ledger, transfers, cashback, rewards
  - [x] 10.1 Create Wallet Service database models and Alembic migration
    - Implement SQLAlchemy models for `wallets`, `wallet_transactions` (Design Â§2.8 schema)
    - _Requirements: 13.1_

  - [x] 10.2 Implement balance inquiry, top-up, withdrawal, and transfer endpoints
    - `GET /wallet/balance` â€” return balance, held_balance, pending transactions
    - `POST /wallet/topup` â€” credit wallet within 60 s of Payment Service confirmation
    - `POST /wallet/withdraw` â€” validate amount â‰¤ (balance - held_balance); if insufficient â†’ reject with `INSUFFICIENT_FUNDS` 422; initiate payout via gateway; record `status='processing'`
    - `POST /wallet/transfer` â€” debit sender and credit recipient atomically in a single DB transaction within 10 s; reject if insufficient funds before any mutation
    - _Requirements: 13.2, 13.3, 13.4, 13.7, 13.8_

  - [x] 10.3 Implement cashback credits and rewards points redemption
    - Consume `order.completed` â†’ credit cashback at Buyer's tier cashback rate, record `wallet_transactions` entry of type `cashback`
    - `GET /wallet/rewards`, `POST /wallet/rewards/redeem` â€” maintain rewards points ledger, convert points to wallet credit at configured redemption rate
    - `GET /wallet/transactions` â€” paginated transaction history
    - _Requirements: 13.5, 13.6_

  - [x] 10.4 Write property test for wallet balance non-negativity
    - **Property 1: Wallet Balance Non-Negative**
    - Use Hypothesis `wallet_operations_strategy()`; apply arbitrary sequences of operations; assert `wallet.balance >= 0` and `wallet.held_balance >= 0` after each step; `InsufficientFundsError` is the only acceptable rejection path
    - **Validates: Requirements 13.3, 13.4, 13.8**

  - [x] 10.5 Write unit tests for Wallet Service
    - Test atomic transfer rollback on partial failure, cashback rate calculation per tier, rewards redemption conversion, insufficient-funds pre-check, concurrent transfer isolation
    - _Requirements: 13.1â€“13.8_

- [x] 11. Implement Inventory Service â€” stock tracking, transfers, and alerts
  - [x] 11.1 Create Inventory Service database models and Alembic migration
    - Implement SQLAlchemy models for `stock_records`, `stock_transfers`, `stock_damage`, `stock_movements` (Design Â§2.9 schema)
    - _Requirements: 14.1_

  - [x] 11.2 Implement stock record management, barcode/QR generation, and order decrement
    - `GET /inventory/{branch_id}/stock`, `GET /inventory/{branch_id}/sku/{sku}` â€” read stock per branch
    - On SKU creation: generate Code 128 barcode and QR code images (python-barcode / qrcode), upload to S3 (`inventory/barcodes/{sku}/`, `inventory/qrcodes/{sku}/`), store S3 keys
    - `GET /inventory/sku/{sku}/barcode` â€” return presigned S3 URL for barcode and QR assets
    - Consume `order.confirmed` â†’ decrement `quantity_reserved` and `quantity_on_hand` for SKU + branch within 30 s; append `stock_movements` record
    - Consume `branch.created` â†’ initialise empty `stock_records` ledger for branch within 60 s
    - _Requirements: 14.1, 14.2, 14.3, 15.3_

  - [x] 11.3 Implement stock transfers, damage recording, and low-stock alerts
    - `POST /inventory/transfers` â€” create `stock_transfers` record; on confirmation atomically deduct from source and add to destination `quantity_on_hand`
    - `POST /inventory/damage` â€” record damage entry, decrement `quantity_on_hand`, append movement record
    - `GET /inventory/sku/{sku}/history` â€” chronological `stock_movements` for SKU + branch
    - After any quantity change: if `quantity_on_hand < reorder_threshold` â†’ publish `inventory.low_stock` to RabbitMQ
    - _Requirements: 14.4, 14.5, 14.6, 14.7_

  - [x] 11.4 Write property test for inventory quantity consistency
    - **Property 3: Inventory Quantity Consistency**
    - Use Hypothesis `stock_movement_strategy()`; assert `quantity_on_hand >= 0`, `quantity_reserved >= 0`, and `quantity_reserved <= quantity_on_hand` after any sequence of movements
    - **Validates: Requirements 14.1, 14.3, 14.4**

  - [x] 11.5 Write unit tests for Inventory Service
    - Test atomic transfer atomicity (rollback on partial failure), low-stock threshold trigger, damage record cascade to quantity, barcode/QR generation, movement history ordering
    - _Requirements: 14.1â€“14.7, 15.3_

- [x] 12. Checkpoint â€” Core Commerce Phase
  - Ensure all tests pass across Marketplace, Search, Payment, Wallet, and Inventory services. Verify end-to-end flow: listing created â†’ indexed in ES â†’ purchased â†’ escrow held â†’ inventory decremented. Ask the user if questions arise.

---

### Phase 3 â€” Fulfilment & Intelligence

---

- [x] 13. Implement Logistics Service â€” carriers, tracking, and delivery proof
  - [x] 13.1 Create Logistics Service database models and Alembic migration
    - Implement SQLAlchemy models for `shipments`, `shipment_events` (Design Â§2.10 schema)
    - _Requirements: 16.1_

  - [x] 13.2 Implement shipping quotes, shipment creation, and carrier webhooks
    - `POST /logistics/quote` â€” fan-out async calls to GIG, DHL, FedEx, and local rider APIs; aggregate and return price + ETA quotes within 10 s
    - `POST /logistics/shipments` â€” submit to selected carrier API, store tracking number within 60 s, create `shipments` record
    - `POST /logistics/webhook/{carrier}` â€” validate carrier HMAC, insert `shipment_events`, update `shipments.status`, publish `shipment.updated` to RabbitMQ within 30 s
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 13.3 Implement shipment tracking and delivery proof collection
    - `GET /logistics/shipments/{tracking_no}` â€” return status, event history, estimated delivery, carrier tracking URL
    - On delivered webhook: call carrier API for delivery proof (photo/signature), store `proof_asset_url`; if proof unavailable within 2 h set `proof_status='unavailable'` and log failure
    - _Requirements: 16.5, 16.6, 16.7_

  - [x] 13.4 Write unit tests for Logistics Service
    - Test carrier quote fan-out with partial failures, HMAC webhook validation per carrier, delivery proof retrieval timeout handling, `shipment.updated` event payload correctness
    - _Requirements: 16.1â€“16.7_

- [x] 14. Implement AI Service â€” all AI capabilities
  - [x] 14.1 Implement NL search parsing, voice transcription, and commerce assistant
    - `POST /ai/search/parse` â€” accept NL query, extract intent/entities, return structured filter JSON
    - `POST /ai/search/transcribe` â€” accept audio file, run speech-to-text (e.g., OpenAI Whisper), return transcript
    - `POST /ai/assistant/query` â€” accept NL query + conversation history (â‰¤20 turns, cached in Redis `ai:session:{user_id}:{session_id}` TTL 2 h), return â‰¤10 relevant listings from Search Service within 3 s
    - `POST /ai/assistant/compare` â€” accept 2+ listing IDs, return structured side-by-side comparison of specs, price, trust badge, avg rating
    - When no exact match: return â‰¤5 alternative suggestions with natural-language explanation
    - _Requirements: 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 14.2 Implement CV scoring, interview prep, review moderation, and chat AI
    - `POST /ai/cv/score` â€” accept CV text + job required skills list, return match score (0â€“100) and missing skills list, store on `job_applications` record within 3 min
    - `POST /ai/interview/prep` â€” accept job listing ID + applicant user ID, return tailored interview question set
    - `POST /ai/review/moderate` â€” classify review text for spam/abuse, return confidence score; if > 0.85 trigger quarantine
    - `POST /ai/chat/translate` â€” accept message text + target language, return translated text
    - `POST /ai/chat/suggest-reply` â€” accept last 5 messages in thread, return â‰¤3 reply suggestions
    - _Requirements: 6.3, 6.4, 9.5, 10.6, 10.7, 11.5_

  - [x] 14.3 Implement AI Business Intelligence endpoints
    - `POST /ai/bi/insights` â€” analyse seller/branch analytics data, generate natural-language daily insight summaries; detect >15% metric deviation from 4-week rolling average and publish notification event
    - `POST /ai/bi/forecast` â€” generate 30-day revenue forecast per branch based on historical order data
    - `POST /ai/bi/question` â€” accept free-text business question, return NL answer within 10 s from authenticated user's analytics data
    - Generate restocking recommendations for SKUs below reorder threshold
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 14.4 Write unit tests for AI Service
    - Test NL query parsing with ambiguous inputs, CV scoring edge cases (empty skills list, 100% match), reply suggestion count enforcement (â‰¤3), spam confidence threshold boundary (0.85), session history truncation at 20 turns, BI insight deviation detection at 15% threshold
    - _Requirements: 6.3, 6.4, 9.1â€“9.5, 10.6, 10.7, 11.5, 18.1â€“18.5_

- [x] 15. Implement Chat Service â€” WebSocket messaging and media
  - [x] 15.1 Create Chat Service database models and Alembic migration
    - Implement SQLAlchemy models for `threads`, `messages`, `message_queue` (Design Â§2.6 schema)
    - _Requirements: 10.1, 10.5_

  - [x] 15.2 Implement WebSocket connection management and real-time messaging
    - `GET /ws/chat` â€” upgrade to WebSocket with JWT validation; maintain online status in Redis `chat:online:{user_id}` (heartbeat TTL 30 s)
    - Deliver text, voice note (â‰¤5 MB), image (â‰¤10 MB), and file (â‰¤25 MB) message types
    - Broadcast read receipts to sender on message read; broadcast typing indicators `chat:typing:{thread_id}:{user_id}` (Redis TTL 3 s) within 1 s of typing start
    - On WebSocket disconnect: queue outgoing messages in `message_queue`; deliver in order on reconnection
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.8_

  - [x] 15.3 Implement message history, media upload, and AI translation
    - `GET /chat/threads`, `GET /chat/threads/{id}/messages` â€” list threads, retrieve last 500 messages per thread
    - `POST /chat/threads/{id}/media` â€” validate file size per type, upload to S3 (`chat/{thread_id}/media/`)
    - On message receipt in different language from recipient preference: call `POST /ai/chat/translate` and attach translated version to message payload
    - Expose `POST /ai/chat/suggest-reply` flow from Chat context
    - _Requirements: 10.2, 10.5, 10.6, 10.7_

  - [x] 15.4 Write unit tests for Chat Service
    - Test WebSocket message ordering on reconnect, message queue delivery guarantee, typing indicator TTL, read receipt broadcast, media file size enforcement per type, translation trigger on language mismatch
    - _Requirements: 10.1â€“10.8_

- [x] 16. Implement Analytics Service â€” dashboards and reporting
  - [x] 16.1 Create Analytics Service database models and Alembic migration
    - Implement SQLAlchemy models for `order_facts`, `analytics_snapshots` (Design Â§2.11 schema)
    - _Requirements: 17.1_

  - [x] 16.2 Implement order fact ingestion and snapshot refresh
    - Consume `order.completed` â†’ append `order_facts` record, refresh `analytics_snapshots` for seller/branch/business at daily/weekly/monthly granularity within 5 min
    - _Requirements: 17.2_

  - [x] 16.3 Implement dashboard endpoints, retention report, and exports
    - `GET /analytics/seller/{id}/summary` â€” total revenue, total orders, avg order value, unique customers, conversion rate at requested granularity
    - `GET /analytics/branch/{id}/summary` â€” branch metrics (scoped to Branch Manager)
    - `GET /analytics/business/{id}/overview` â€” consolidated cross-branch dashboard
    - `GET /analytics/seller/{id}/top-listings` â€” top 20 by revenue and order count
    - `GET /analytics/seller/{id}/retention` â€” repeat purchase rate, avg days between purchases per customer
    - `GET /analytics/export` â€” generate CSV and PDF exports; complete within 60 s for â‰¤100,000 rows
    - Business Owner branch comparison view: side-by-side revenue, orders, AOV for all branches
    - _Requirements: 17.1, 17.3, 17.4, 17.5, 17.6, 15.4, 15.5_

  - [x] 16.4 Write unit tests for Analytics Service
    - Test snapshot aggregation correctness, retention calculation, export row limit enforcement, branch comparison scoping, granularity (daily/weekly/monthly/custom) range calculations
    - _Requirements: 17.1â€“17.6, 15.4â€“15.5_

- [x] 17. Checkpoint â€” Fulfilment & Intelligence Phase
  - Ensure all tests pass across Logistics, AI, Chat, and Analytics services. Verify the `order.confirmed â†’ inventory.decrement â†’ shipment.created â†’ shipment.updated â†’ escrow.auto_release` flow. Ask the user if questions arise.

---

### Phase 4 â€” CRM, Subscriptions & Cross-Cutting Concerns

---

- [x] 18. Implement CRM Service â€” customer records and purchase history
  - [x] 18.1 Create CRM Service database models and Alembic migration
    - Implement SQLAlchemy models for `customer_records`, `customer_notes`, `customer_orders` (Design Â§2.13 schema)
    - _Requirements: 19.1_

  - [x] 18.2 Implement CRM record management, notes, and purchase history
    - Consume `order.completed` â†’ upsert `customer_records` (update `total_orders`, `total_spend` within 60 s), append `customer_orders`
    - `GET /crm/customers` â€” search by name, phone, email within seller scope, results within 500 ms
    - `GET /crm/customers/{buyer_id}` â€” full customer record with total orders and spend
    - `POST /crm/customers/{buyer_id}/notes` â€” create timestamped note (â‰¤1000 chars), attributed to staff user ID
    - `GET /crm/customers/{buyer_id}/orders` â€” purchase history queryable by date range and category
    - Enforce data access scoping: seller sees only own buyer records; Branch Manager sees only branch-scoped records
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [x] 18.3 Write unit tests for CRM Service
    - Test upsert idempotency on duplicate `order.completed` events, scope enforcement (seller vs branch manager), note character limit, search response time target (mocked DB), purchase history date range filtering
    - _Requirements: 19.1â€“19.6_

- [x] 19. Implement Subscription Service â€” tier management and billing
  - [x] 19.1 Create Subscription Service database models and Alembic migration
    - Implement SQLAlchemy models for `subscriptions`, `invoices`, `tier_entitlements`, `enterprise_contracts` (Design Â§2.14 schema)
    - Seed `tier_entitlements` table with Starter/Growth/Pro/Enterprise values from Design Â§6
    - _Requirements: 20.1, 20.2_

  - [x] 19.2 Implement subscription upgrade, downgrade, and feature gate enforcement
    - `GET /subscriptions/tiers` â€” list all tiers with entitlements
    - `GET /subscriptions/me` â€” return current subscription + entitlements
    - `POST /subscriptions/upgrade` â€” on payment confirmation activate new tier immediately, emit `subscription.tier_changed` to RabbitMQ
    - `POST /subscriptions/downgrade` â€” schedule downgrade to end of billing cycle, notify user â‰¥3 days before effective date
    - Feature gate middleware: check `subscription_tier` from JWT against `tier_entitlements` for AI BI access, multi-branch, custom domain, 360Â° media
    - _Requirements: 20.2, 20.3, 20.4_

  - [x] 19.3 Implement recurring billing, retry logic, FX invoice generation, and enterprise contracts
    - Scheduled billing job: charge subscription on billing cycle start; on failure retry after 24 h, then 48 h; downgrade to Starter after both retries fail, notify user after each failure
    - `GET /subscriptions/invoices` â€” paginated invoice history
    - On invoice generation: fetch FX rate from configured provider, convert price to user's default currency, store `fx_rate` and local currency amount on invoice
    - `POST /subscriptions/enterprise` â€” create `enterprise_contracts` record; override standard tier defaults for that user
    - _Requirements: 20.1, 20.5, 20.6, 20.7, 20.8_

  - [x] 19.4 Write property test for FX conversion determinism
    - **Property 7: FX Conversion Determinism**
    - Use Hypothesis `decimal_strategy()` + `currency_strategy()`; assert two calls to `fx_service.convert(price, c1, c2, rate)` with identical inputs return identical output (pure function, no side effects)
    - **Validates: Requirements 24.2, 24.4, 24.5**

  - [x] 19.5 Write unit tests for Subscription Service
    - Test upgrade immediate activation, downgrade scheduling, retry exhaustion â†’ Starter downgrade, enterprise contract override of standard defaults, invoice FX rate stamping, feature gate rejection for under-tier users
    - _Requirements: 20.1â€“20.8_

- [x] 20. Implement Notification Service â€” multi-channel delivery
  - [x] 20.1 Create Notification Service database models and Alembic migration
    - Implement SQLAlchemy models for `notification_preferences`, `notifications` (Design Â§2.12 schema)
    - _Requirements: 21.1_

  - [x] 20.2 Implement notification dispatch, retry logic, and preference management
    - `POST /notifications/send` â€” route to FCM push / Africa's Talking SMS / AWS SES or SendGrid email / WhatsApp Business API based on user's preference settings; queue on offline device (deliver within 60 s of reconnect)
    - Implement retry logic: up to 3 attempts per channel; on exhaustion set `status='failed'`, log reason
    - SMS delivery within 60 s, email within 2 min of triggering event for all five supported countries
    - `GET /notifications/history` â€” last 90 days of notification records per user
    - `PATCH /notifications/preferences` â€” enable/disable each channel per notification category
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

  - [x] 20.3 Write unit tests for Notification Service
    - Test channel routing based on preference settings, retry exhaustion to `failed` status, offline queue delivery ordering, preference per-category override, 90-day history window
    - _Requirements: 21.1â€“21.7_

- [x] 21. Implement observability and platform operations
  - [x] 21.1 Add Prometheus metrics, health endpoints, and structured logging to all services
    - Mount Prometheus `starlette-prometheus` middleware on every FastAPI app (from `shared/metrics.py`): expose `/metrics` with request count, error rate, and response time histograms
    - Add `GET /health` to every service: return `{"service": "...", "version": "...", "status": "ok", "dependencies": {"db": "ok", "redis": "ok", "rabbitmq": "ok"}}` within 500 ms
    - Configure `structlog` for JSON structured logging in all services; ship logs to central aggregation store; retain â‰¥30 days
    - _Requirements: 23.1, 23.2, 23.4_

  - [x] 21.2 Configure Grafana dashboards, error-rate alerts, DLQ alerts, and HPA
    - Create Grafana dashboards importing Prometheus metrics for each service
    - Alert rule: error rate > 5% over 5-min rolling window â†’ fire Grafana alert to ops notification channel
    - Configure Dead-Letter Queue alert: Grafana alert within 5 min of any DLQ receiving a message
    - Add `consumer_retry_count` metric to all RabbitMQ consumers; route to DLQ after 3 failures
    - Add Kubernetes HPA manifest per service: `minReplicas: 2`, `maxReplicas: 20`, `targetCPUUtilizationPercentage: 70`
    - _Requirements: 23.3, 23.5, 23.6_

  - [x] 21.3 Write unit tests for observability components
    - Test `/health` endpoint dependency check logic (DB/Redis/RabbitMQ failure states), Prometheus metric registration, DLQ routing after 3 consumer failures
    - _Requirements: 23.1, 23.4, 23.6_

- [x] 22. Implement multi-currency and FX rate support
  - [x] 22.1 Implement FX rate provider integration and currency conversion utilities
    - Create `shared/fx.py`: fetch FX rates for NGN/GHS/KES/ZAR/XOF from configured provider; cache rates in Redis with TTL â‰¤4 h (refresh on expiry); expose `get_rate(base, target)` and `convert(amount, base, target)` as pure functions
    - Integrate into Marketplace Service listing display (convert to viewer's default currency) and Subscription Service invoice generation
    - _Requirements: 24.1, 24.2, 24.5_

  - [x] 22.2 Implement per-user default currency preference and payment display
    - Wire user's `default_currency` preference (User Service profile) into Marketplace price display and Payment Service pre-confirmation display
    - Payment Service `POST /payments/initiate` â€” display converted amount in user's default currency alongside transaction currency before confirmation
    - _Requirements: 2.9, 24.3, 24.4_

  - [x] 22.3 Write unit tests for FX utilities
    - Test `convert()` with known rates, stale cache refresh trigger, unsupported currency rejection, rounding behaviour for all five currencies
    - _Requirements: 24.1â€“24.5_

- [x] 23. Final checkpoint â€” full platform integration
  - Ensure all tests pass across all 14 services. Run the three end-to-end Docker Compose flows from Design Â§Testing Strategy: (1) registration â†’ listing â†’ search â†’ purchase â†’ escrow release; (2) branch creation â†’ inventory â†’ transfer â†’ low-stock alert; (3) subscription upgrade â†’ quota increase â†’ feature gate unlock. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build.
- Each task references specific requirements for traceability.
- Checkpoints validate incremental progress before advancing to the next phase.
- Property tests use the **Hypothesis** library and cover the 7 correctness invariants defined in Design Â§8.
- Unit tests use **pytest** with **pytest-asyncio** for async FastAPI routes.
- Integration tests use a real PostgreSQL Docker container and mocked RabbitMQ (aio-pika mocks).
- Contract tests (Pact) for the AI Service `/ai/search/parse` and Wallet Service `/wallet/transfer` endpoints are part of `tests/contract/` and should be run as part of CI.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "4.1", "6.1", "8.1", "9.1", "10.1", "11.1", "13.1", "15.1", "16.1", "18.1", "19.1", "20.1"] },
    { "id": 2, "tasks": ["2.2", "4.2", "6.2", "8.2", "9.2", "10.2", "11.2", "13.2", "14.1", "15.2", "16.2", "18.2", "19.2", "20.2", "21.1", "22.1"] },
    { "id": 3, "tasks": ["2.3", "4.3", "6.3", "8.3", "9.3", "10.3", "11.3", "13.3", "14.2", "15.3", "16.3", "18.3", "19.3", "20.3", "21.2", "22.2"] },
    { "id": 4, "tasks": ["2.4", "4.4", "6.4", "9.4", "14.3", "19.4"] },
    { "id": 5, "tasks": ["2.5", "6.5", "6.6", "6.7", "6.8", "6.9"] },
    { "id": 6, "tasks": ["2.6", "2.7", "2.8", "4.5", "6.10", "6.11", "8.4", "8.5", "9.5", "9.6", "10.4", "10.5", "11.4", "11.5", "13.4", "14.4", "15.4", "16.4", "19.5", "20.3", "21.3", "22.3"] },
    { "id": 7, "tasks": ["2.9"] }
  ]
}
```
