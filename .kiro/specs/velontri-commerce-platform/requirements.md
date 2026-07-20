# Requirements Document

## Introduction

Velontri is a Pan-African, AI-powered commerce operating system designed to unify buying, selling, hiring, managing, and growing businesses on a single platform. It targets individuals, SMEs, multi-branch enterprises, and agents across Africa, initially supporting Nigeria, Ghana, Kenya, South Africa, and francophone West Africa (WAEMU/XOF zone).

The platform is architected as 14 independently deployable Python/FastAPI microservices communicating over RabbitMQ (async events) and HTTP/REST (synchronous calls), backed by PostgreSQL, Redis, Elasticsearch, AWS S3, and WebSockets. All services are containerised with Docker and orchestrated via Kubernetes.

This document covers all 20+ functional modules across the following service boundaries:

- **Auth Service** — identity, JWT, OAuth, 2FA, device tracking
- **User Service** — profiles, trust & verification, subscription tiers
- **Marketplace Service** — product listings, reviews, categories
- **Search Service** — Elasticsearch-powered keyword, voice, and AI search
- **AI Service** — commerce assistant, business intelligence, CV scoring
- **Chat Service** — real-time WebSocket messaging
- **Payment Service** — escrow, multi-gateway (Paystack, Flutterwave, mobile money)
- **Wallet Service** — deposit, withdraw, transfer, cashback, rewards
- **Inventory Service** — stock tracking, barcode/QR, transfers, returns
- **Logistics Service** — multi-carrier shipping, tracking, delivery proof
- **Analytics Service** — sales dashboards, branch performance, revenue reporting
- **Notification Service** — push, SMS, email, WhatsApp
- **CRM Service** — customer records, notes, purchase history
- **Subscription Service** — SaaS tier management, billing, feature gates

Phase 2 features (AI Store Builder, Live Streaming, Affiliate Programme, Auction Engine, B2B/Wholesale Portal, Digital Products, API Marketplace) are explicitly out of scope.

---

## Glossary

- **Velontri Platform**: The complete multi-service commerce system described in this document.
- **Auth Service**: The microservice responsible for authentication, token issuance, and session management.
- **User Service**: The microservice responsible for user profiles, roles, trust badges, and subscription assignment.
- **Marketplace Service**: The microservice responsible for product/service/job/property/vehicle listings, categories, and reviews.
- **Search Service**: The microservice responsible for full-text, filtered, voice, and AI-driven product search via Elasticsearch.
- **AI Service**: The microservice responsible for commerce assistance, product comparison, AI business intelligence, CV scoring, and AI reply suggestions.
- **Chat Service**: The microservice responsible for real-time WebSocket messaging between platform participants.
- **Payment Service**: The microservice responsible for multi-gateway payment processing, escrow lifecycle management, and refund handling.
- **Wallet Service**: The microservice responsible for per-user wallet balances, top-ups, withdrawals, transfers, and rewards.
- **Inventory Service**: The microservice responsible for stock levels, barcode/QR tracking, inter-branch transfers, and damage recording.
- **Logistics Service**: The microservice responsible for shipping quote aggregation, carrier dispatch, shipment tracking, and delivery proof collection.
- **Analytics Service**: The microservice responsible for revenue dashboards, order metrics, customer analytics, and branch performance reporting.
- **Notification Service**: The microservice responsible for push notification, SMS, email, and WhatsApp message delivery.
- **CRM Service**: The microservice responsible for customer relationship records, notes, and purchase history.
- **Subscription Service**: The microservice responsible for SaaS tier management, feature entitlements, and recurring billing.
- **Buyer**: A registered user who purchases products, services, jobs, or property listings on the platform.
- **Seller**: A registered user or business that creates and manages listings on the platform.
- **Agent**: A registered user who acts on behalf of a business or enterprise, performing transactions under an assigned scope.
- **Branch Manager**: A user role with administrative access scoped to a single physical branch of a multi-branch business.
- **Business Owner**: A user role with administrative access over all branches and operations of a single business entity.
- **Enterprise Admin**: A user role with top-level administrative access over an enterprise account comprising multiple businesses or brand entities.
- **Guest**: An unauthenticated visitor who can browse listings but cannot transact.
- **Listing**: A Marketplace entity representing a product, service, job, property, or vehicle offered by a Seller.
- **Escrow**: A payment hold mechanism where funds are retained by the Payment Service until the Buyer confirms delivery.
- **Wallet**: A per-user stored-value account managed by the Wallet Service.
- **Subscription Tier**: A named SaaS plan (Starter, Growth, Pro, Enterprise) that governs feature access and billing.
- **Trust Badge**: A verification level (Bronze, Silver, Gold, Diamond) assigned by the User Service to a Seller's profile.
- **Branch**: A physical or logical organisational unit under a Business Owner, with its own inventory, staff, and analytics scope.
- **SKU**: A unique Stock Keeping Unit identifier for a variant of a product.
- **RabbitMQ**: The message broker used for asynchronous event communication between microservices.
- **JWT**: JSON Web Token — the bearer token format used for authenticated API requests.
- **2FA**: Two-Factor Authentication — a secondary verification step during login.
- **OTP**: One-Time Password — a time-limited numeric code used for 2FA and phone verification.
- **KYC**: Know Your Customer — the identity verification process underpinning Trust Badges.
- **Multi-currency Support**: The platform's ability to denominate, display, and process transactions in NGN, GHS, KES, ZAR, and XOF.
- **VIN**: Vehicle Identification Number — a unique 17-character code used to look up vehicle history.
- **CV**: Curriculum Vitae — a document uploaded by a job applicant.
- **AI Commerce Assistant**: The conversational AI feature within the AI Service that helps Buyers find and compare products using natural-language queries.
- **AI Business Intelligence (AI BI)**: The AI Service feature that analyses seller/branch metrics and surfaces actionable insights.
- **Store**: A branded seller storefront within the Marketplace, optionally mapped to a custom subdomain.
- **Carrier**: A third-party logistics provider (GIG Logistics, DHL, FedEx, local riders) integrated via the Logistics Service.
- **Paystack**: A payment gateway used for card and bank transfer processing in Nigeria and Ghana.
- **Flutterwave**: A payment gateway used across multiple African markets.
- **Mobile Money**: Mobile-network-based payment methods (e.g., M-Pesa, MTN Mobile Money) integrated via the Payment Service.
- **Prometheus/Grafana**: The observability stack used for service metrics collection and dashboarding.
- **Kubernetes**: The container orchestration platform used for service deployment and scaling.

---

## Requirements

### Requirement 1 — User Registration and Authentication

**User Story:** As a new user, I want to register, log in, and manage my account securely, so that I can access platform features appropriate to my role.

#### Acceptance Criteria

1. THE Auth Service SHALL accept registration requests containing email address, phone number, password, full name, and country code, and SHALL create a new user record with a unique user ID upon successful validation.
2. WHEN a registration request is received, THE Auth Service SHALL send an OTP to the submitted phone number within 30 seconds to verify ownership before activating the account.
3. WHEN a user submits valid credentials (email/phone and password), THE Auth Service SHALL issue a signed JWT access token with a 15-minute expiry and a refresh token with a 7-day expiry.
4. WHEN a JWT access token expires, THE Auth Service SHALL accept a valid refresh token and issue a new JWT access token without requiring the user to re-enter credentials.
5. WHEN 2FA is enabled on an account and a login attempt is made with correct credentials, THE Auth Service SHALL require a valid OTP before issuing tokens.
6. THE Auth Service SHALL support OAuth 2.0 login via Google and Apple identity providers, mapping the provider identity to a Velontri user account.
7. WHEN a login succeeds, THE Auth Service SHALL record the device fingerprint, IP address, and timestamp in the login history for the authenticated user.
8. WHEN more than 5 consecutive failed login attempts occur for the same account within 15 minutes, THE Auth Service SHALL lock the account and notify the registered email address.
9. IF a login attempt originates from a device not previously associated with the account, THEN THE Auth Service SHALL send a new-device alert to the registered email address before completing the session.
10. THE Auth Service SHALL support role assignment at registration and role elevation via the User Service for Seller, Agent, Branch Manager, Business Owner, and Enterprise Admin roles.
11. WHEN a user requests a password reset, THE Auth Service SHALL send a time-limited reset link to the registered email address that expires after 30 minutes.
12. THE Auth Service SHALL expose a token introspection endpoint that returns the authenticated user's ID, roles, and subscription tier for downstream service authorisation.

---

### Requirement 2 — User Profiles and Trust & Verification

**User Story:** As a Seller, I want to build a verified profile with trust badges, so that Buyers can assess my credibility before transacting.

#### Acceptance Criteria

1. THE User Service SHALL maintain a profile record for each user containing full name, profile photo, bio, location (country, state, city), phone number, email, registered_at, and active subscription tier.
2. THE User Service SHALL assign a Bronze trust badge to an account upon confirmed phone number verification.
3. WHEN a user submits a government-issued ID document and the document passes automated validation, THE User Service SHALL upgrade the account's trust badge to Silver within 24 hours.
4. WHEN a user submits a business registration certificate and the certificate passes automated validation, THE User Service SHALL upgrade the account's trust badge to Gold within 48 hours.
5. WHEN a Diamond-tier physical verification appointment is scheduled, completed, and confirmed by a Velontri agent, THE User Service SHALL upgrade the account's trust badge to Diamond.
6. THE User Service SHALL display the current trust badge level on all public-facing Seller profile views and Listing detail pages.
7. THE User Service SHALL support role-based access control, enforcing that Branch Manager access is scoped to the assigned branch and that Business Owner access spans all branches of the registered business.
8. WHEN a user's subscription tier changes, THE User Service SHALL update the active subscription tier on the profile record within 60 seconds of the Subscription Service emitting a tier-change event via RabbitMQ.
9. THE User Service SHALL support multi-currency profile preferences, allowing each user to select a default display currency from NGN, GHS, KES, ZAR, and XOF.

---

### Requirement 3 — Marketplace Listings

**User Story:** As a Seller, I want to create rich product and service listings with full media support, so that Buyers can discover and evaluate what I offer.

#### Acceptance Criteria

1. THE Marketplace Service SHALL accept listing creation requests containing title, description, price, currency (one of NGN, GHS, KES, ZAR, XOF), location (country, state, city, coordinates), category, subcategory, condition, brand, seller ID, and listing status.
2. THE Marketplace Service SHALL support listing types: Physical Product, Digital Service, Job Offer, Property (Rent, Sale, Shortlet, Commercial), and Vehicle.
3. THE Marketplace Service SHALL accept an unlimited number of image uploads per listing, storing each image in AWS S3 and recording the S3 URL in the listing record.
4. WHEN an image upload request is received, THE Marketplace Service SHALL validate that each image file is a supported format (JPEG, PNG, WebP, AVIF) and does not exceed 20 MB per file before storing.
5. THE Marketplace Service SHALL accept video uploads per listing up to 500 MB per video file in MP4 or MOV format.
6. WHERE a Seller has a Pro or Enterprise subscription tier, THE Marketplace Service SHALL accept a 360° view asset (equirectangular image or interactive HTML bundle) for applicable listing types.
7. THE Marketplace Service SHALL support product variants, where each variant contains a set of attribute key-value pairs (e.g., colour, size, storage), a distinct SKU, and an independent price and stock quantity.
8. THE Marketplace Service SHALL support structured specifications fields per category (e.g., RAM, Storage, Processor for Electronics; Engine size, Mileage for Vehicles) in addition to free-form description.
9. WHEN a listing is submitted for publication, THE Marketplace Service SHALL assign it a status of "pending_review" and notify the Notification Service to alert the moderation queue.
10. WHEN a listing is approved, THE Marketplace Service SHALL set the listing status to "active" and publish a listing-created event to RabbitMQ so the Search Service can index the listing within 5 minutes.
11. WHEN a listing is set to "active" and the associated variant stock quantity reaches zero, THE Marketplace Service SHALL automatically update the listing status to "out_of_stock".
12. THE Marketplace Service SHALL enforce listing quotas per subscription tier: Starter tier permits a maximum of 10 active listings per Seller; Growth tier permits 100; Pro and Enterprise tiers permit unlimited active listings.
13. THE Marketplace Service SHALL support a Store entity linked to a Seller, containing store_name, logo URL, banner URL, theme identifier, and an optional custom_domain value in the format {name}.velontri.com.
14. WHEN a custom_domain is submitted for a Store, THE Marketplace Service SHALL verify DNS CNAME resolution for the submitted subdomain before activating the custom domain mapping.

---

### Requirement 4 — Property Marketplace

**User Story:** As a property lister, I want to publish property listings with maps, virtual tours, and mortgage tools, so that prospective tenants and buyers can make informed decisions remotely.

#### Acceptance Criteria

1. THE Marketplace Service SHALL accept property-specific fields including property type (Rent, Sale, Shortlet, Commercial), bedroom count, bathroom count, total area (m²), furnishing status, amenities list, GPS coordinates, and address.
2. WHERE a property listing includes GPS coordinates, THE Marketplace Service SHALL embed an interactive map view using the stored coordinates on the listing detail page.
3. WHERE a Seller uploads a virtual tour asset (equirectangular 360° image or embedded tour URL), THE Marketplace Service SHALL display the virtual tour on the listing detail page.
4. THE Marketplace Service SHALL provide a mortgage calculator on Sale-type property listings that accepts property price, deposit amount, interest rate (%), and loan term (years), and returns the estimated monthly repayment amount.
5. WHEN a property listing is created with type "Shortlet", THE Marketplace Service SHALL accept a per-night pricing structure and an availability calendar with blocked dates.

---

### Requirement 5 — Vehicle Marketplace

**User Story:** As a vehicle buyer, I want to see verified vehicle history and financing options on listings, so that I can make a safe purchase decision.

#### Acceptance Criteria

1. THE Marketplace Service SHALL accept vehicle-specific fields including make, model, year, mileage (km), fuel type, transmission, colour, engine size (cc), VIN, condition, and asking price.
2. WHEN a VIN is submitted on a vehicle listing, THE Marketplace Service SHALL query the integrated VIN lookup provider and attach the returned vehicle history report (ownership history, accident records, odometer readings) to the listing within 2 minutes.
3. IF the VIN lookup provider returns an error, THEN THE Marketplace Service SHALL mark the VIN history field as "unavailable" and store the error reason on the listing record.
4. THE Marketplace Service SHALL display an inspection report section on vehicle listings, where a Velontri-certified inspector can upload a structured inspection report PDF.
5. WHERE a financing partner integration is active, THE Marketplace Service SHALL display estimated monthly financing repayments on vehicle listing pages, calculated using the listing price, a configurable deposit percentage, and configurable interest rate.

---

### Requirement 6 — Jobs Marketplace

**User Story:** As a job seeker, I want to find job listings, submit my CV, and receive AI-assisted preparation support, so that I can apply effectively and improve my chances.

#### Acceptance Criteria

1. THE Marketplace Service SHALL accept job listing fields including job title, employer name, job type (Full-time, Part-time, Contract, Remote), location, salary range (min, max, currency), description, required skills list, application deadline, and employer ID.
2. WHEN a Buyer applies for a job listing, THE Marketplace Service SHALL accept a CV file in PDF or DOCX format up to 10 MB and associate it with the application record.
3. WHEN a CV is uploaded, THE AI Service SHALL score the CV against the job listing's required skills, returning a match score (0–100) and a list of missing skills, and storing the result on the application record within 3 minutes.
4. THE AI Service SHALL provide an AI Interview Preparation feature that accepts a job listing ID and applicant user ID, and returns a set of likely interview questions tailored to the job description and required skills.
5. WHEN an employer reviews an application, THE Marketplace Service SHALL record the review timestamp, reviewer ID, and status change (Shortlisted, Rejected, Hired) on the application record.
6. THE Marketplace Service SHALL notify the Notification Service to send a status update notification to the applicant whenever an application status changes.

---

### Requirement 7 — Services Marketplace

**User Story:** As a services buyer, I want to browse, book, and pay for skilled service providers, so that I can hire professionals without leaving the platform.

#### Acceptance Criteria

1. THE Marketplace Service SHALL accept service listing fields including service title, category (e.g., Electrician, Developer, Designer, Cleaner), description, pricing structure (fixed, hourly, or package), availability schedule, and service area (location radius or remote).
2. WHEN a Buyer submits a booking request for a service listing, THE Marketplace Service SHALL create a booking record with status "pending" and notify the Seller via the Notification Service within 30 seconds.
3. WHEN a Seller accepts a booking, THE Marketplace Service SHALL update the booking status to "confirmed", block the booked time slot in the Seller's availability calendar, and notify the Buyer via the Notification Service.
4. WHEN a completed service booking is marked as "done" by the Seller and confirmed by the Buyer, THE Payment Service SHALL release any escrow-held funds for the booking to the Seller's Wallet.
5. IF a Buyer cancels a confirmed booking more than 24 hours before the scheduled time, THEN THE Payment Service SHALL initiate a full refund to the Buyer's Wallet within 1 hour.

---

### Requirement 8 — Advanced Search Engine

**User Story:** As a Buyer, I want to search for listings using keywords, voice, filters, and natural-language AI queries, so that I can find exactly what I need quickly.

#### Acceptance Criteria

1. THE Search Service SHALL index all active listings from the Marketplace Service, including title, description, category, subcategory, brand, location, price, currency, condition, and listing type, within 5 minutes of a listing-created or listing-updated event being received from RabbitMQ.
2. THE Search Service SHALL accept keyword search queries and return ranked results using Elasticsearch's BM25 relevance algorithm with a response time under 500 ms for the 95th percentile of requests.
3. THE Search Service SHALL support filter parameters in search queries: price range (min, max), location (country, state, city, radius in km), category, subcategory, brand, condition, availability status, and seller trust badge level.
4. THE Search Service SHALL support voice search by accepting an audio file input, transcribing the audio via the AI Service, and executing the resulting text query.
5. WHEN a natural-language AI search query is received (e.g., "Toyota under 10 million in Lagos"), THE Search Service SHALL forward the query to the AI Service for intent parsing and entity extraction, then execute the structured search query returned by the AI Service.
6. THE Search Service SHALL return paginated results with a configurable page size (default 20, maximum 100), including total result count and next-page cursor.
7. THE Search Service SHALL support autocomplete suggestions, returning up to 10 matching listing titles or category names within 200 ms of receiving a partial query string of 2 or more characters.

---

### Requirement 9 — AI Commerce Assistant

**User Story:** As a Buyer, I want an AI assistant that finds products, compares options, and suggests alternatives, so that I can make confident purchasing decisions.

#### Acceptance Criteria

1. THE AI Service SHALL accept natural-language product queries from authenticated Buyers and return a curated list of up to 10 relevant listings sourced from the Search Service.
2. WHEN a Buyer submits two or more listing IDs for comparison, THE AI Service SHALL return a structured side-by-side comparison of specifications, prices, seller trust badges, and average ratings for the selected listings.
3. WHEN no exact match is found for a query, THE AI Service SHALL return up to 5 alternative listing suggestions with a brief natural-language explanation of why each alternative is relevant.
4. THE AI Service SHALL accept conversation history (up to 20 prior turns) with each query to maintain contextual follow-up capability within a session.
5. THE AI Service SHALL respond to product queries within 3 seconds under normal load conditions.

---

### Requirement 10 — Chat System

**User Story:** As a platform participant, I want real-time chat with Buyers and Sellers, so that I can negotiate, clarify, and coordinate transactions efficiently.

#### Acceptance Criteria

1. THE Chat Service SHALL establish and maintain persistent WebSocket connections for authenticated users, delivering messages with an end-to-end latency under 300 ms on the same continent under normal network conditions.
2. THE Chat Service SHALL support message types: text, voice note (audio file ≤ 5 MB), image (≤ 10 MB), and file attachment (≤ 25 MB).
3. THE Chat Service SHALL record and broadcast read receipts to the sender when a message is read by the recipient.
4. THE Chat Service SHALL broadcast typing indicators to the recipient within 1 second of the sender beginning to type.
5. THE Chat Service SHALL store chat message history and make it available to authenticated participants on reconnection for the most recent 500 messages per conversation thread.
6. WHEN a message is received in a language different from the recipient's profile language preference, THE Chat Service SHALL offer a translated version of the message using the AI Service translation capability.
7. WHEN a participant requests an AI reply suggestion, THE AI Service SHALL generate up to 3 contextually appropriate reply options based on the last 5 messages in the conversation thread.
8. IF a WebSocket connection is lost, THEN THE Chat Service SHALL queue outgoing messages for delivery and deliver them in order upon reconnection within the same session.

---

### Requirement 11 — Reviews and Ratings System

**User Story:** As a Buyer, I want to rate and review products, sellers, and services, so that the community can make informed decisions based on real experiences.

#### Acceptance Criteria

1. THE Marketplace Service SHALL accept a review submission for a listing only when the submitting user has a confirmed completed order or booking associated with that listing.
2. THE Marketplace Service SHALL accept review fields: numeric rating (integer 1–5), written comment (maximum 2000 characters), optional image attachments (up to 5 images, each ≤ 10 MB), and optional video attachment (≤ 100 MB, MP4 or MOV).
3. THE Marketplace Service SHALL calculate and store a rolling average rating for each listing, updated within 60 seconds of a new review being submitted.
4. THE Marketplace Service SHALL calculate and store a rolling average Seller rating based on all reviews received across the Seller's listings, updated within 60 seconds of a new review submission.
5. IF a review contains text that the AI Service classifies as spam or abusive with a confidence score above 0.85, THEN THE Marketplace Service SHALL quarantine the review for manual moderation rather than publishing it.
6. THE Marketplace Service SHALL allow a Seller to submit one public response of up to 1000 characters to each review on their listings.

---

### Requirement 12 — Escrow Payments

**User Story:** As a Buyer, I want my payment to be held in escrow until I confirm delivery, so that I am protected from fraud.

#### Acceptance Criteria

1. WHEN a Buyer initiates a purchase and selects escrow payment, THE Payment Service SHALL charge the full order amount (including any applicable fees) to the Buyer's selected payment method and hold the funds in escrow, issuing the Seller an order-confirmed notification.
2. THE Payment Service SHALL support payment methods: card (via Paystack and Flutterwave), bank transfer (Paystack), mobile money (Flutterwave, M-Pesa), and Velontri Wallet balance.
3. THE Payment Service SHALL process payments denominated in NGN, GHS, KES, ZAR, and XOF, routing each currency to the appropriate configured gateway.
4. WHEN a Buyer confirms delivery of an order, THE Payment Service SHALL release the escrowed funds to the Seller's Wallet within 1 hour.
5. WHEN an order is not confirmed or disputed within 72 hours of the logistics carrier marking delivery as complete, THE Payment Service SHALL automatically release escrowed funds to the Seller's Wallet and notify both Buyer and Seller.
6. WHEN a Buyer raises a dispute within 72 hours of the carrier delivery confirmation, THE Payment Service SHALL freeze the escrowed funds and create a dispute record with status "open" pending manual resolution.
7. WHEN a dispute is resolved in favour of the Buyer, THE Payment Service SHALL refund the full escrowed amount to the Buyer's Wallet within 1 hour.
8. WHEN a dispute is resolved in favour of the Seller, THE Payment Service SHALL release the escrowed amount to the Seller's Wallet within 1 hour.
9. THE Payment Service SHALL calculate and collect a platform transaction fee per completed order at the rate configured for the Seller's subscription tier, recording the fee amount on the transaction record.

---

### Requirement 13 — Wallet System

**User Story:** As a user, I want a platform wallet to deposit, withdraw, transfer funds, and receive cashback rewards, so that I can transact without repeatedly using external payment methods.

#### Acceptance Criteria

1. THE Wallet Service SHALL maintain a separate wallet ledger record per user, storing balance in the user's default currency and a full transaction history.
2. WHEN a top-up request is received, THE Wallet Service SHALL credit the wallet balance within 60 seconds of the Payment Service confirming receipt of funds from the external payment method.
3. WHEN a withdrawal request is submitted, THE Wallet Service SHALL validate that the requested amount does not exceed the available balance minus any held funds, initiate a payout via the configured payment gateway for the user's country, and record the transaction with status "processing".
4. WHEN a Wallet-to-Wallet transfer is requested, THE Wallet Service SHALL debit the sender's balance and credit the recipient's balance atomically within a single database transaction, completing the operation within 10 seconds.
5. THE Wallet Service SHALL record a cashback credit to the Buyer's wallet upon order completion, calculated at the cashback rate configured for the Buyer's subscription tier.
6. THE Wallet Service SHALL maintain a rewards points ledger per user and provide a redemption endpoint that converts accumulated points to wallet credit at the configured redemption rate.
7. THE Wallet Service SHALL expose a balance inquiry endpoint returning current balance, held balance, and pending transactions for the authenticated user.
8. IF a withdrawal or transfer request references an amount greater than the available balance, THEN THE Wallet Service SHALL reject the request with an insufficient-funds error response and SHALL NOT debit the account.

---

### Requirement 14 — Inventory Management

**User Story:** As a Business Owner or Branch Manager, I want to track, transfer, and manage stock across branches in real time, so that I can prevent stockouts and fulfil orders accurately.

#### Acceptance Criteria

1. THE Inventory Service SHALL maintain a stock record per SKU per branch, containing SKU, product ID, branch ID, quantity_on_hand, quantity_reserved, quantity_damaged, and reorder_threshold.
2. THE Inventory Service SHALL generate and associate a unique barcode (Code 128 format) and a QR code with each SKU on creation, returning both as downloadable image assets.
3. WHEN an order is confirmed by the Payment Service, THE Inventory Service SHALL decrement the quantity_reserved for the ordered SKU and branch by the ordered quantity within 30 seconds of receiving the order-confirmed event from RabbitMQ.
4. WHEN a stock transfer is initiated between two branches, THE Inventory Service SHALL deduct the transfer quantity from the source branch's quantity_on_hand and add it to the destination branch's quantity_on_hand atomically upon transfer confirmation.
5. WHEN the quantity_on_hand for a SKU at a branch falls below the reorder_threshold, THE Inventory Service SHALL publish a low-stock event to RabbitMQ and notify the Notification Service to alert the Branch Manager and Business Owner.
6. THE Inventory Service SHALL record stock damage entries with fields: SKU, branch ID, quantity_damaged, reason, and recorded_by user ID.
7. THE Inventory Service SHALL provide a stock movement history endpoint returning all quantity changes (sales, transfers, damage, adjustments) for a given SKU and branch, ordered chronologically.

---

### Requirement 15 — Multi-Branch Management

**User Story:** As a Business Owner, I want to manage multiple branch locations under one business account, each with isolated inventory, staff, and reporting, so that I can scale operations across cities.

#### Acceptance Criteria

1. THE User Service SHALL support a Business entity containing business_name, registration_number, logo, country, and owner user ID, and SHALL allow each Business to have one or more Branch records containing branch_name, address, city, country, and assigned staff list.
2. THE User Service SHALL enforce that a Branch Manager role is scoped exclusively to the branches assigned to that user, preventing access to inventory, orders, or staff records belonging to other branches.
3. WHEN a Business Owner creates a new Branch, THE Inventory Service SHALL initialise an empty stock ledger for that branch within 60 seconds of receiving the branch-created event from RabbitMQ.
4. THE Analytics Service SHALL provide per-branch revenue, order count, and top-selling product reports accessible to the Business Owner and the assigned Branch Manager.
5. THE Analytics Service SHALL provide a consolidated business-level dashboard that aggregates revenue, orders, and stock metrics across all branches of the Business.

---

### Requirement 16 — Logistics Module

**User Story:** As a Buyer or Seller, I want to get real-time shipping quotes, track shipments, and receive proof of delivery, so that fulfilment is transparent and reliable.

#### Acceptance Criteria

1. THE Logistics Service SHALL integrate with a minimum of three carriers (GIG Logistics, DHL, and FedEx) and SHALL support local rider dispatch as a fourth carrier option.
2. WHEN a shipping quote request is received with origin address, destination address, parcel weight (kg), and dimensions (cm), THE Logistics Service SHALL return price and estimated delivery time quotes from all configured active carriers within 10 seconds.
3. WHEN a Seller confirms a carrier and shipment is created, THE Logistics Service SHALL submit the shipment to the selected carrier's API and return a tracking number within 60 seconds.
4. WHEN the Logistics Service receives a carrier webhook update for a tracked shipment, THE Logistics Service SHALL update the shipment status and publish a shipment-updated event to RabbitMQ within 30 seconds.
5. THE Logistics Service SHALL expose a shipment tracking endpoint returning the current carrier status, status history, estimated delivery date, and carrier tracking URL for a given tracking number.
6. WHEN a carrier marks a shipment as delivered, THE Logistics Service SHALL request delivery proof (photo or digital signature) from the carrier API and store the proof asset URL on the shipment record.
7. IF delivery proof is not available from the carrier API within 2 hours of the delivered status update, THEN THE Logistics Service SHALL mark the proof_status field as "unavailable" and log the failure for manual follow-up.

---

### Requirement 17 — Sales Analytics and Reporting

**User Story:** As a Business Owner, Branch Manager, or Seller, I want real-time dashboards and downloadable reports, so that I can monitor performance and make data-driven decisions.

#### Acceptance Criteria

1. THE Analytics Service SHALL compute and expose the following metrics per Seller or Branch at daily, weekly, monthly, and custom date-range granularities: total revenue, total orders, average order value, total unique customers, and conversion rate.
2. THE Analytics Service SHALL update dashboard metrics within 5 minutes of an order-completed event being received from RabbitMQ.
3. THE Analytics Service SHALL provide a top-performing listings report returning the top 20 listings by revenue and by order count for a given Seller or Branch and time period.
4. THE Analytics Service SHALL provide a customer retention report showing repeat purchase rate and average days between purchases per customer for a given Seller or Branch.
5. THE Analytics Service SHALL support export of all reports in CSV and PDF formats, with export requests completed within 60 seconds for datasets up to 100,000 rows.
6. THE Analytics Service SHALL provide a branch comparison view accessible to the Business Owner, displaying side-by-side revenue, order count, and average order value for all branches in a selected time period.

---

### Requirement 18 — AI Business Intelligence

**User Story:** As a Business Owner, I want AI-generated insights and recommendations about my business performance, so that I can take timely corrective action.

#### Acceptance Criteria

1. THE AI Service SHALL analyse per-Seller and per-Branch analytics data daily and generate natural-language insight summaries (e.g., "Lagos branch sales dropped 17% this week compared to last week").
2. WHEN a metric deviates by more than 15% from its 4-week rolling average, THE AI Service SHALL generate a targeted insight notification and publish it to the Notification Service for delivery to the Business Owner within 24 hours of the deviation being detected.
3. THE AI Service SHALL generate restocking recommendations for SKUs where the current quantity_on_hand is below the reorder_threshold, including the recommended reorder quantity and the average sales velocity over the prior 30 days.
4. THE AI Service SHALL accept a free-text business question from a Business Owner (e.g., "Which product category is growing fastest this quarter?") and return a natural-language answer derived from the authenticated user's analytics data within 10 seconds.
5. THE AI Service SHALL provide a predictive revenue forecast for the next 30 days per Branch, based on historical order data, displaying the forecast on the Analytics dashboard.

---

### Requirement 19 — CRM Module

**User Story:** As a Seller or Business Owner, I want a customer relationship management tool, so that I can track customer interactions, notes, and purchase history in one place.

#### Acceptance Criteria

1. THE CRM Service SHALL maintain a customer record per unique Buyer per Seller, containing Buyer user ID, first contact date, total orders, total spend, and contact details (phone, email where shared by the Buyer).
2. THE CRM Service SHALL record all completed orders associated with a Buyer–Seller relationship in the customer purchase history, queryable by date range and product category.
3. THE CRM Service SHALL allow a Seller to add timestamped notes of up to 1000 characters each to a customer record, with notes attributed to the creating staff user ID.
4. WHEN an order is completed, THE CRM Service SHALL update the associated customer record's total_orders and total_spend fields within 60 seconds of receiving the order-completed event from RabbitMQ.
5. THE CRM Service SHALL provide a customer search endpoint allowing Sellers to search their CRM records by name, phone number, or email, returning results within 500 ms.
6. THE CRM Service SHALL enforce data access scoping such that a Seller can only access CRM records for Buyers who have transacted with that Seller, and Branch Managers can only access records for Buyers who transacted with their assigned branch.

---

### Requirement 20 — Subscription and SaaS Tier Management

**User Story:** As a Seller or Business Owner, I want to choose and manage a subscription plan, so that I can unlock the features and capacity I need to grow my business.

#### Acceptance Criteria

1. THE Subscription Service SHALL define and enforce four subscription tiers: Starter (free), Growth (₦10,000/month or equivalent in the user's currency), Pro (₦50,000/month or equivalent), and Enterprise (custom pricing via contract).
2. THE Subscription Service SHALL store and enforce feature entitlements per tier, including: active listing quota, analytics data retention window, AI Business Intelligence access, multi-branch access, custom domain support, and transaction fee rate.
3. WHEN a user upgrades to a higher subscription tier, THE Subscription Service SHALL activate the new tier's entitlements immediately upon payment confirmation and publish a tier-change event to RabbitMQ.
4. WHEN a user downgrades to a lower subscription tier, THE Subscription Service SHALL schedule the downgrade to take effect at the end of the current billing cycle and notify the user via the Notification Service at least 3 days before the effective date.
5. WHEN a recurring subscription payment fails, THE Subscription Service SHALL retry the charge after 24 hours, then again after 48 hours, and SHALL downgrade the account to the Starter tier if both retries fail, notifying the user via the Notification Service after each failure.
6. THE Subscription Service SHALL convert the monthly price to the user's default currency using the exchange rate fetched from the configured FX rate provider at the time of invoice generation.
7. THE Subscription Service SHALL generate and store a monthly invoice record per subscriber containing invoice date, amount, currency, tier name, payment status, and payment transaction reference.
8. WHERE an Enterprise contract is active, THE Subscription Service SHALL apply the custom pricing, feature set, and billing schedule defined in the contract record rather than the standard tier defaults.

---

### Requirement 21 — Notification Centre

**User Story:** As a platform user, I want to receive timely notifications across my preferred channels, so that I stay informed about activity that requires my attention.

#### Acceptance Criteria

1. THE Notification Service SHALL deliver notifications via four channels: in-app push (WebSocket/FCM), SMS, email, and WhatsApp, routing to each channel based on the user's notification preference settings.
2. WHEN an in-app push notification cannot be delivered within 30 seconds due to an offline device, THE Notification Service SHALL queue the notification and deliver it within 60 seconds of the device reconnecting.
3. THE Notification Service SHALL deliver transactional SMS notifications (order confirmation, OTP, payment receipt) within 60 seconds of the triggering event for recipients in all five supported countries.
4. THE Notification Service SHALL support notification preference management, allowing each user to enable or disable each channel (push, SMS, email, WhatsApp) independently per notification category.
5. WHEN an email notification is triggered, THE Notification Service SHALL send the email using the configured transactional email provider (e.g., AWS SES or SendGrid) within 2 minutes of the triggering event.
6. THE Notification Service SHALL maintain a notification history per user, storing the notification type, channel, content, sent_at timestamp, and delivery status, queryable for the most recent 90 days.
7. IF a notification delivery attempt to a given channel fails after 3 retries, THEN THE Notification Service SHALL mark the delivery record as "failed" and log the failure reason.

---

### Requirement 22 — Security and Fraud Prevention

**User Story:** As a platform operator, I want comprehensive security controls and automated fraud detection, so that users' accounts and funds are protected at all times.

#### Acceptance Criteria

1. THE Auth Service SHALL hash all stored passwords using the bcrypt algorithm with a minimum cost factor of 12.
2. THE Auth Service SHALL enforce HTTPS for all API endpoints and SHALL reject HTTP requests with a 301 redirect to the HTTPS equivalent.
3. THE Auth Service SHALL implement rate limiting on authentication endpoints, allowing a maximum of 10 requests per minute per IP address and responding with HTTP 429 when the limit is exceeded.
4. WHEN a payment transaction is submitted, THE Payment Service SHALL pass the transaction through a fraud-scoring model and reject transactions with a fraud score above the configured threshold, recording the rejection reason.
5. THE Auth Service SHALL support TOTP-based 2FA (RFC 6238 compliant) in addition to SMS OTP, allowing users to enrol a TOTP authenticator app.
6. THE Auth Service SHALL maintain a device registry per user account and SHALL allow the user to remotely revoke access for any registered device from their account settings.
7. WHEN a new JWT is issued, THE Auth Service SHALL include the audience claim scoped to the Velontri Platform and SHALL validate the audience claim on all incoming requests at the API gateway.
8. THE Auth Service SHALL log all privileged actions (role change, 2FA toggle, device revocation, password reset) with user ID, timestamp, and originating IP address, retaining logs for a minimum of 90 days.
9. WHEN an account is flagged by the fraud detection system, THE Payment Service SHALL suspend the account's payment capabilities and notify the Notification Service to alert the platform operations team within 5 minutes.

---

### Requirement 23 — Observability and Platform Operations

**User Story:** As a platform engineer, I want comprehensive metrics, logging, and health monitoring across all microservices, so that I can detect and resolve issues before they impact users.

#### Acceptance Criteria

1. THE Velontri Platform SHALL expose a Prometheus-compatible /metrics endpoint from each microservice, publishing request count, error rate, and response time histograms for all API endpoints.
2. THE Velontri Platform SHALL centralise structured JSON logs from all microservices into a shared log aggregation store, retaining logs for a minimum of 30 days.
3. WHEN any microservice's error rate exceeds 5% over a 5-minute rolling window, THE Velontri Platform SHALL trigger a Grafana alert and publish an alert event to the configured operations notification channel.
4. THE Velontri Platform SHALL expose a /health endpoint from each microservice that returns HTTP 200 with a JSON body containing service name, version, and dependency health status (database, Redis, RabbitMQ) within 500 ms.
5. THE Velontri Platform SHALL deploy all microservices as Docker containers orchestrated by Kubernetes, supporting horizontal pod autoscaling triggered when CPU utilisation exceeds 70% on any service.
6. WHEN a RabbitMQ consumer fails to process a message after 3 retries, THE Velontri Platform SHALL route the message to a dead-letter queue and alert the operations team via the configured notification channel.

---

### Requirement 24 — Multi-Currency and Multi-Country Support

**User Story:** As a Pan-African user, I want prices displayed and transactions processed in my local currency, so that I can engage with the platform without manual currency conversion.

#### Acceptance Criteria

1. THE Velontri Platform SHALL support the following currencies throughout all monetary display and processing flows: NGN (Nigerian Naira), GHS (Ghanaian Cedi), KES (Kenyan Shilling), ZAR (South African Rand), and XOF (West African CFA Franc).
2. THE Marketplace Service SHALL display listing prices in the viewing user's default currency, converting from the listing's base currency using the exchange rate fetched from the configured FX rate provider, refreshed at a maximum interval of 4 hours.
3. THE Payment Service SHALL process each transaction in the currency of the Seller's operating country and route it to the payment gateway configured for that country.
4. WHEN a user's default currency differs from the transaction currency, THE Payment Service SHALL display the converted amount in the user's default currency alongside the transaction currency amount before the user confirms payment.
5. THE Subscription Service SHALL convert subscription prices to the user's default currency using the exchange rate at invoice generation time, displaying the local currency amount on the invoice.
