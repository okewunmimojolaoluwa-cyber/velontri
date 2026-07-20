# Velontri Frontend Architecture

**Document version:** 1.0.0  
**Status:** Approved — implementation follows `docs/EXECUTION_PLAN.md`  
**Last updated:** June 22, 2026  
**PRD reference:** `docs/PRD.md` v1.2.0  
**Backend API:** `http://localhost:8000/api/v1`

---

## Approval Gate

> **Implementation is blocked until this document is approved.**  
> Phases 2–8 (pages, components, API wiring, dashboards, tests) begin only after sign-off on Phase 1 architecture.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Folder Structure](#3-folder-structure)
4. [Route Structure](#4-route-structure)
5. [Layout Architecture](#5-layout-architecture)
6. [Authentication Architecture](#6-authentication-architecture)
7. [State Management Architecture](#7-state-management-architecture)
8. [API Integration Layer](#8-api-integration-layer)
9. [Design System](#9-design-system)
10. [Theme System](#10-theme-system)
11. [Component Library](#11-component-library)
12. [RBAC System](#12-rbac-system)
13. [Page Inventory (Phase 2)](#13-page-inventory-phase-2)
14. [Dashboard Architecture (Phases 5–6)](#14-dashboard-architecture-phases-56)
15. [Testing Strategy (Phase 7)](#15-testing-strategy-phase-7)
16. [Senior Frontend Audit Checklist (Phase 8)](#16-senior-frontend-audit-checklist-phase-8)
17. [Deployment Strategy](#17-deployment-strategy)
18. [Gap Analysis](#18-gap-analysis)
19. [Implementation Roadmap](#19-implementation-roadmap)

---

## 1. Executive Summary

Velontri's frontend is a **production-grade Next.js 14 App Router** application in `frontend/`, consuming the unified backend gateway at `/api/v1`. The architecture preserves **all 24 PRD requirements** without simplification:

- 7 user personas (guest → enterprise admin)
- 4 subscription tiers with feature gates
- 14 backend service domains exposed as typed API modules
- 6 role-specific dashboards + admin console
- Real-time chat (WebSocket), AI assistant, escrow, wallet, inventory, CRM, analytics, multi-branch

**Architectural principles:**

| Principle | Decision |
|-----------|----------|
| Framework | Next.js 14 App Router (`frontend/src/app/`) |
| Server state | TanStack Query v5 |
| HTTP client | Axios with interceptors |
| Client UI state | Zustand (ephemeral) + React Context (auth session) |
| Styling | Tailwind CSS + CSS variables design tokens |
| Components | shadcn/ui primitives + Velontri domain components |
| Auth | httpOnly cookies + Edge middleware (existing `middleware.ts`) |
| RBAC | JWT claims + route guards + component-level `<Can>` |
| i18n-ready | English first; structure supports `next-intl` later |
| A11y | WCAG 2.1 AA target |
| SEO | Metadata API, JSON-LD, sitemap, robots |

---

## 2. Technology Stack

### Core

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.x | App Router, SSR/SSG, middleware |
| `react` / `react-dom` | 18.x | UI |
| `typescript` | 5.x | Type safety |
| `@tanstack/react-query` | 5.x | Server state, cache, retry |
| `axios` | 1.x | HTTP client + interceptors |
| `zustand` | 4.x | Client UI state |
| `zod` | 3.x | Runtime validation + form schemas |
| `react-hook-form` | 7.x | Forms |
| `@hookform/resolvers` | 3.x | Zod integration |
| `next-themes` | 0.3.x | Dark mode |
| `tailwindcss` | 3.x | Utility CSS |
| `class-variance-authority` | 0.7.x | Component variants |
| `clsx` + `tailwind-merge` | — | Class composition |
| `lucide-react` | — | Icons |
| `date-fns` | 3.x | Date formatting (Africa/Lagos default) |
| `recharts` | 2.x | Analytics charts |
| `@radix-ui/*` | — | Accessible primitives (via shadcn) |

### Dev / Test

| Package | Purpose |
|---------|---------|
| `vitest` | Unit + integration tests |
| `@testing-library/react` | Component tests |
| `@playwright/test` | E2E tests |
| `msw` | API mocking in tests |
| `@axe-core/playwright` | Accessibility E2E |
| `eslint` + `eslint-plugin-jsx-a11y` | Lint + a11y rules |

---

## 3. Folder Structure

```
frontend/
├── public/
│   ├── favicon.ico
│   ├── og/                          # Open Graph images
│   ├── icons/                       # PWA icons (future)
│   └── locales/                     # Static locale assets (future)
│
├── src/
│   ├── app/                         # Next.js App Router (pages)
│   │   ├── (public)/                # Marketing + browse (no auth)
│   │   ├── (auth)/                  # Login, register, verify
│   │   ├── (buyer)/                 # Buyer dashboard routes
│   │   ├── (seller)/                # Seller dashboard routes
│   │   ├── (agent)/                 # Agent dashboard routes
│   │   ├── (branch)/                # Branch manager routes
│   │   ├── (business)/              # Business owner routes
│   │   ├── (admin)/                 # Enterprise admin routes
│   │   ├── api/                     # Next.js route handlers (BFF optional)
│   │   ├── layout.tsx               # Root layout
│   │   ├── providers.tsx            # Query, theme, auth providers
│   │   ├── globals.css              # Design tokens + Tailwind
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/                      # shadcn primitives (Button, Input, …)
│   │   ├── layout/                  # Navbar, Footer, Sidebar, Shell
│   │   ├── auth/                    # LoginForm, OTPInput, DeviceList
│   │   ├── marketplace/             # ListingCard, CategoryGrid, …
│   │   ├── search/                  # SearchBar, Filters, VoiceSearch
│   │   ├── wallet/                  # WalletCard, TransactionList, …
│   │   ├── payments/                # EscrowTimeline, DisputeForm, …
│   │   ├── chat/                    # ThreadList, MessageBubble, …
│   │   ├── notifications/           # NotificationBell, PreferenceForm
│   │   ├── inventory/               # StockTable, TransferForm, …
│   │   ├── crm/                     # CustomerTable, NotesPanel, …
│   │   ├── analytics/               # MetricCard, ChartPanel, ExportBtn
│   │   ├── logistics/               # QuoteForm, TrackingMap, …
│   │   ├── ai/                      # AssistantPanel, BIInsights, …
│   │   ├── subscription/            # TierCard, UpgradeModal, …
│   │   ├── branch/                  # BranchSelector, BranchCard, …
│   │   ├── rbac/                    # Can, RoleGate, TierGate
│   │   └── shared/                  # EmptyState, ErrorState, Skeleton, …
│   │
│   ├── features/                    # Feature modules (hooks + logic)
│   │   ├── auth/
│   │   ├── listings/
│   │   ├── search/
│   │   ├── wallet/
│   │   ├── payments/
│   │   ├── chat/
│   │   ├── notifications/
│   │   ├── inventory/
│   │   ├── crm/
│   │   ├── analytics/
│   │   ├── logistics/
│   │   ├── ai/
│   │   ├── subscriptions/
│   │   ├── branches/
│   │   └── admin/
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts            # Axios instance
│   │   │   ├── interceptors.ts      # Auth, retry, error mapping
│   │   │   ├── query-client.ts      # TanStack Query defaults
│   │   │   └── endpoints/           # Per-service API functions
│   │   │       ├── auth.ts
│   │   │       ├── users.ts
│   │   │       ├── listings.ts
│   │   │       ├── search.ts
│   │   │       ├── ai.ts
│   │   │       ├── chat.ts
│   │   │       ├── payments.ts
│   │   │       ├── wallet.ts
│   │   │       ├── inventory.ts
│   │   │       ├── logistics.ts
│   │   │       ├── analytics.ts
│   │   │       ├── notifications.ts
│   │   │       ├── crm.ts
│   │   │       └── subscriptions.ts
│   │   ├── auth/
│   │   │   ├── session.ts           # Cookie read/write (server)
│   │   │   ├── jwt.ts               # Payload parse (no verify client-side)
│   │   │   └── token-refresh.ts     # Refresh queue (single-flight)
│   │   ├── rbac/
│   │   │   ├── permissions.ts       # Permission matrix (from PRD)
│   │   │   ├── roles.ts             # Role helpers
│   │   │   └── tier-gates.ts        # Subscription feature gates
│   │   ├── websocket/
│   │   │   └── chat-client.ts       # WebSocket manager
│   │   ├── seo/
│   │   │   ├── metadata.ts          # generateMetadata helpers
│   │   │   └── json-ld.ts           # Structured data builders
│   │   └── utils/
│   │       ├── cn.ts
│   │       ├── currency.ts          # NGN, GHS, KES, ZAR, XOF
│   │       └── format.ts
│   │
│   ├── hooks/                       # Cross-feature hooks
│   │   ├── use-auth.ts
│   │   ├── use-permissions.ts
│   │   ├── use-tier.ts
│   │   ├── use-media-query.ts
│   │   └── use-debounce.ts
│   │
│   ├── stores/                      # Zustand stores
│   │   ├── ui-store.ts              # Sidebar, modals, toasts
│   │   ├── cart-store.ts            # Checkout draft
│   │   ├── chat-store.ts            # Active thread, typing
│   │   └── search-store.ts          # Filter persistence
│   │
│   ├── types/                       # TypeScript types
│   │   ├── api.ts                   # ApiResponse<T>, ApiError
│   │   ├── auth.ts
│   │   ├── listings.ts
│   │   ├── wallet.ts
│   │   ├── payments.ts
│   │   └── …
│   │
│   ├── config/
│   │   ├── site.ts                  # Site name, default locale
│   │   ├── navigation.ts            # Nav items per role
│   │   └── routes.ts                # Route constants + guards
│   │
│   └── test/                        # Test utilities
│       ├── setup.ts
│       ├── mocks/
│       └── fixtures/
│
├── middleware.ts                    # Edge auth (existing — extend routes)
├── next.config.js
├── tailwind.config.ts
├── components.json                  # shadcn config
├── vitest.config.ts
├── playwright.config.ts
├── .env.local.example
├── package.json
└── tsconfig.json
```

**Conventions:**

- `app/` = routes only (thin page shells)
- `features/` = business logic + TanStack Query hooks
- `components/` = presentational + composed UI
- `lib/api/endpoints/` = raw API calls (no React)
- No API calls inside components — always via hooks in `features/`

---

## 4. Route Structure

### 4.1 Complete Route Tree

```
/                                           # Home (public)
├── search                                  # Search results
│   └── [query]                             # Deep-linked search
├── listings                                # Browse all listings
│   ├── products                            # Product category browse
│   ├── services                            # Services browse
│   ├── jobs                                # Jobs browse
│   ├── property                            # Property browse
│   ├── vehicles                            # Vehicles browse
│   └── [id]                                # Listing detail (type-aware)
│       ├── apply                           # Job application (buyer)
│       ├── book                            # Service booking (buyer)
│       └── reviews                         # Reviews tab
├── stores                                  # Store directory
│   └── [slug]                              # Store profile
├── subscriptions/tiers                     # Public tier catalog
├── about
├── contact
├── terms
├── privacy
│
├── login                                   # Auth-only
├── register
├── verify-phone
├── forgot-password
├── reset-password/[token]
├── auth/2fa                                # 2FA setup + verify
│
├── dashboard                               # Role-aware redirect hub
│
├── buyer/                                  # Buyer persona
│   ├── dashboard
│   ├── orders
│   │   └── [id]
│   ├── checkout/[listingId]
│   ├── wallet
│   │   ├── topup
│   │   ├── withdraw
│   │   ├── transfer
│   │   ├── transactions
│   │   └── rewards
│   ├── messages
│   │   └── [threadId]
│   ├── notifications
│   ├── profile
│   └── settings
│       ├── security                      # 2FA, devices
│       ├── preferences                   # Currency, notifications
│       └── subscription
│
├── seller/                                 # Seller persona
│   ├── dashboard
│   ├── listings
│   │   ├── create
│   │   │   ├── product
│   │   │   ├── service
│   │   │   ├── job
│   │   │   ├── property
│   │   │   └── vehicle
│   │   └── [id]/edit
│   ├── store
│   ├── orders                              # Seller order view
│   ├── reviews
│   ├── analytics
│   ├── wallet
│   └── settings
│
├── agent/                                  # Agent persona
│   ├── dashboard
│   ├── listings                            # On-behalf listings
│   ├── crm
│   │   └── customers/[id]
│   └── analytics
│
├── branch/                                 # Branch manager
│   ├── dashboard
│   ├── inventory
│   │   ├── stock
│   │   ├── transfers
│   │   ├── damage
│   │   └── sku/[sku]
│   ├── staff
│   └── analytics
│
├── business/                               # Business owner
│   ├── dashboard
│   ├── branches
│   │   ├── create
│   │   └── [id]
│   ├── inventory                           # Cross-branch view
│   ├── analytics
│   │   ├── seller
│   │   └── branch/[id]
│   ├── crm
│   ├── subscriptions
│   │   ├── upgrade
│   │   └── invoices
│   └── settings
│
├── admin/                                  # Enterprise admin / ops
│   ├── dashboard
│   ├── users
│   │   └── [id]
│   ├── listings/moderation
│   ├── disputes
│   │   └── [id]
│   ├── roles
│   ├── analytics/platform
│   └── settings
│
├── payments/                               # Shared escrow flows
│   ├── [id]                                # Payment detail + escrow timeline
│   └── [id]/dispute
│
├── logistics/                              # Shipment tracking
│   └── track/[trackingNo]
│
├── ai/                                     # AI surfaces
│   ├── assistant                           # Commerce assistant
│   └── bi                                  # Business intelligence (tier-gated)
│
└── api/                                    # Optional BFF routes
    └── auth/callback                       # OAuth callback (future)
```

**Total routes:** ~95 page routes + dynamic segments.

### 4.2 Route Groups & Middleware Mapping

| Route group | Layout | Auth | Roles |
|-------------|--------|------|-------|
| `(public)` | `PublicLayout` | None | guest+ |
| `(auth)` | `AuthLayout` | Guest only | — |
| `(buyer)` | `DashboardLayout` | Required | buyer+ |
| `(seller)` | `DashboardLayout` | Required | seller, agent, business_owner, enterprise_admin |
| `(agent)` | `DashboardLayout` | Required | agent, business_owner, enterprise_admin |
| `(branch)` | `DashboardLayout` | Required | branch_manager, business_owner, enterprise_admin |
| `(business)` | `DashboardLayout` | Required | business_owner, enterprise_admin |
| `(admin)` | `AdminLayout` | Required | enterprise_admin, moderator, ops |

### 4.3 `/dashboard` Hub Logic

```typescript
// Role priority redirect (first match wins)
const DASHBOARD_REDIRECT: Record<string, string> = {
  enterprise_admin: '/admin/dashboard',
  moderator:        '/admin/listings/moderation',
  ops:              '/admin/disputes',
  business_owner:   '/business/dashboard',
  branch_manager:   '/branch/dashboard',
  agent:            '/agent/dashboard',
  seller:           '/seller/dashboard',
  buyer:            '/buyer/dashboard',
};
// Default: /buyer/dashboard
```

---

## 5. Layout Architecture

### 5.1 Layout Hierarchy

```
RootLayout (html, body, providers, fonts)
├── PublicLayout
│   ├── Navbar (search, categories, auth CTAs)
│   ├── <main>{children}</main>
│   └── Footer
│
├── AuthLayout
│   ├── Split panel (brand left, form right)
│   └── No Navbar/Footer
│
├── DashboardLayout
│   ├── TopBar (notifications, wallet quick-view, user menu)
│   ├── Sidebar (role-filtered nav from config/navigation.ts)
│   ├── Breadcrumbs
│   ├── <main>{children}</main>
│   └── AIAssistantFab (tier-gated, floating)
│
└── AdminLayout
    ├── AdminSidebar (moderation, disputes, users)
    ├── AuditBanner (ops mode indicator)
    └── <main>{children}</main>
```

### 5.2 Responsive Breakpoints

| Token | Width | Layout behavior |
|-------|-------|-----------------|
| `sm` | 640px | Stack filters; bottom nav on mobile |
| `md` | 768px | Collapsible sidebar |
| `lg` | 1024px | Full sidebar + 2-column dashboards |
| `xl` | 1280px | 3-column listing grids |
| `2xl` | 1536px | Max content width 1440px centered |

### 5.3 Shared Layout Components

| Component | Responsibility |
|-----------|----------------|
| `AppShell` | Grid container, skip-link, focus trap |
| `Navbar` | Logo, SearchBar, CategoryMenu, AuthMenu |
| `Footer` | Links, currencies, social, legal |
| `Sidebar` | Role-filtered navigation |
| `TopBar` | Page title, actions, notifications |
| `Breadcrumbs` | SEO + wayfinding |
| `PageHeader` | Title, description, primary CTA |
| `MobileNav` | Bottom tab bar (buyer/seller) |

---

## 6. Authentication Architecture

### 6.1 Token Storage

| Token | Storage | Rationale |
|-------|---------|-----------|
| `access_token` | httpOnly cookie `velontri_access` | XSS protection; readable by middleware |
| `refresh_token` | httpOnly cookie `velontri_refresh` | Never exposed to JS |
| JWT payload (client) | Parsed from cookie in Server Components via `headers()` | No localStorage for tokens |

**Existing `middleware.ts`** is extended (not replaced) to:
- Protect all dashboard routes per route tree
- Silent refresh on expiring tokens (already implemented)
- Forward `x-velontri-user-id`, `x-velontri-roles`, `x-velontri-tier`, `x-velontri-branch-ids` to pages

### 6.2 Auth Flow Diagram

```
Register → Verify Phone OTP → Login → Dashboard Hub
                ↓
         2FA (optional) → Device registered
                ↓
    Access token (15 min) ──expired──► Refresh (single-flight)
                ↓                           ↓
         API requests              Fail → Logout → /login
```

### 6.3 Auth Module Structure

```
features/auth/
├── hooks/
│   ├── use-login.ts
│   ├── use-register.ts
│   ├── use-verify-phone.ts
│   ├── use-logout.ts
│   ├── use-refresh-token.ts
│   ├── use-2fa.ts
│   └── use-devices.ts
├── components/          # Re-exported from components/auth/
└── schemas/
    ├── login.schema.ts
    ├── register.schema.ts
    └── otp.schema.ts
```

### 6.4 Session Provider

```typescript
// AuthContext exposes (derived from JWT + /users/me/profile)
interface AuthSession {
  userId: string;
  roles: VelontriRole[];
  subscriptionTier: SubscriptionTier;
  branchIds: string[];
  countryCode: string;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

Server Components read session from `headers()`. Client Components use `useAuth()`.

### 6.5 OAuth (Google, Apple)

- `POST /api/v1/auth/login/oauth` — popup or redirect flow
- Callback route: `app/api/auth/callback/route.ts` (Phase 2)
- Tokens set via server action into httpOnly cookies

---

## 7. State Management Architecture

### 7.1 State Categories

| Category | Tool | Examples |
|----------|------|----------|
| **Server/async data** | TanStack Query | Listings, wallet balance, analytics |
| **Auth session** | React Context | User, roles, tier |
| **Ephemeral UI** | Zustand | Sidebar open, active modal |
| **URL state** | `nuqs` or searchParams | Filters, pagination, sort |
| **Form state** | react-hook-form | Login, listing create |
| **Real-time** | WebSocket + Zustand | Chat messages, typing |

### 7.2 TanStack Query Conventions

```typescript
// Query key factory pattern
export const listingKeys = {
  all:    ['listings'] as const,
  lists:  () => [...listingKeys.all, 'list'] as const,
  list:   (filters: ListingFilters) => [...listingKeys.lists(), filters] as const,
  detail: (id: string) => [...listingKeys.all, 'detail', id] as const,
};

// Default options (lib/api/query-client.ts)
{
  staleTime: 60_000,           // 1 min
  gcTime: 300_000,             // 5 min
  retry: (count, error) => count < 2 && isRetryable(error),
  refetchOnWindowFocus: true,
}
```

### 7.3 Cache Invalidation Map

| Mutation | Invalidates |
|----------|-------------|
| Create listing | `listings.list`, `analytics.seller` |
| Initiate payment | `wallet.balance`, `orders` |
| Confirm delivery | `payments.detail`, `wallet.balance` |
| Send message | `chat.thread` (optimistic update) |
| Upgrade subscription | `subscriptions.me`, `auth.session` |
| Stock transfer | `inventory.stock`, `inventory.history` |

### 7.4 Zustand Stores

| Store | State |
|-------|-------|
| `ui-store` | `sidebarOpen`, `theme` (mirror), `toastQueue` |
| `cart-store` | `checkoutDraft` (listingId, qty, options) |
| `chat-store` | `activeThreadId`, `typingUsers`, `unreadCounts` |
| `search-store` | `recentQueries`, `savedFilters` |

---

## 8. API Integration Layer

### 8.1 Axios Client

```typescript
// lib/api/client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // http://localhost:8000/api/v1
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // cookies
});
```

### 8.2 Request Interceptor

1. Attach `Authorization: Bearer <access>` from cookie (server) or memory (client refresh)
2. Attach `X-Request-ID: crypto.randomUUID()` for error correlation
3. Attach `Accept-Language` from locale (future)

### 8.3 Response Interceptor

```typescript
// Pseudocode — lib/api/interceptors.ts
onResponseError(async (error) => {
  const { code } = error.response?.data?.error ?? {};

  if (code === 'TOKEN_EXPIRED' && !error.config._retry) {
    error.config._retry = true;
    await refreshTokenSingleFlight();
    return apiClient(error.config);
  }

  if (code === 'TOKEN_INVALID' || code === 'UNAUTHORIZED') {
    await logout();
    redirect('/login');
  }

  throw mapApiError(error); // → VelontriApiError
});
```

### 8.4 Retry Logic

| Condition | Retries | Backoff |
|-----------|---------|---------|
| Network error | 2 | Exponential 1s, 2s |
| HTTP 502/503/504 | 2 | Exponential |
| `TOKEN_EXPIRED` | 1 | After refresh |
| 4xx (except 429) | 0 | — |
| 429 `QUOTA_EXCEEDED` | 0 | Show upgrade UI |

### 8.5 API Response Types

```typescript
interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: PaginationMeta | null;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field: string | null;
  };
  request_id: string;
}
```

### 8.6 Endpoint Module Map

| Module | Backend prefix | Key operations |
|--------|----------------|----------------|
| `auth.ts` | `/auth` | register, login, refresh, 2fa, devices |
| `users.ts` | `/users` | profile, kyc, businesses, branches |
| `listings.ts` | `/listings` | CRUD, media, publish, reviews, bookings |
| `search.ts` | `/search` | search, autocomplete, voice, ai |
| `ai.ts` | `/ai` | assistant, bi, cv, moderation |
| `chat.ts` | `/chat` | threads, messages, media |
| `payments.ts` | `/payments` | initiate, confirm, dispute |
| `wallet.ts` | `/wallet` | balance, topup, withdraw, rewards |
| `inventory.ts` | `/inventory` | stock, transfers, damage, barcode |
| `logistics.ts` | `/logistics` | quote, shipments, tracking |
| `analytics.ts` | `/analytics` | dashboards, export |
| `notifications.ts` | `/notifications` | send, preferences, history |
| `crm.ts` | `/crm` | customers, notes, orders |
| `subscriptions.ts` | `/subscriptions` | tiers, upgrade, invoices |

### 8.7 WebSocket (Chat)

```typescript
// lib/websocket/chat-client.ts
const ws = new WebSocket(
  `${WS_BASE}/ws/chat?token=${accessToken}`
);
// Events: message, typing, read_receipt, presence
// Reconnect: exponential backoff, max 5 attempts
// Offline queue: Zustand buffer → flush on reconnect
```

Reference: `docs/WEBSOCKET_DOCUMENTATION.md`

---

## 9. Design System

### 9.1 Brand Identity

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0D6E4F` (Velontri Green) | CTAs, links, success |
| Primary hover | `#0A5A40` | Button hover |
| Accent | `#F5A623` (Gold) | Badges, premium, trust |
| Danger | `#DC2626` | Errors, disputes |
| Warning | `#D97706` | Escrow pending |
| Info | `#2563EB` | Informational |

### 9.2 Typography

| Role | Font | Size scale |
|------|------|------------|
| Display | `Inter` variable | 36/48/60px |
| Body | `Inter` | 14/16px |
| Mono | `JetBrains Mono` | Code, IDs, tracking numbers |

### 9.3 Spacing & Radius

- Spacing: 4px base grid (Tailwind default)
- Radius: `sm=4px`, `md=8px`, `lg=12px`, `xl=16px`, `full=9999px`
- Shadow: `sm`, `md`, `lg` elevation tokens

### 9.4 Component Variants (CVA)

All `ui/` components use `class-variance-authority`:

```typescript
// Example: Button variants
variant: default | destructive | outline | ghost | link
size:    sm | default | lg | icon
```

### 9.5 Domain Component Standards

Every domain component supports:

| Prop | Purpose |
|------|---------|
| `isLoading` | Skeleton state |
| `isEmpty` | EmptyState child |
| `error` | ErrorState with retry |
| `className` | Extension point |

### 9.6 Trust Badge Visual System

| Badge | Color | Icon |
|-------|-------|------|
| Bronze | `#CD7F32` | Phone verified |
| Silver | `#C0C0C0` | Gov ID |
| Gold | `#FFD700` | Business reg |
| Diamond | `#B9F2FF` | Agent verified |

---

## 10. Theme System

### 10.1 Implementation

- `next-themes` with `attribute="class"` on `<html>`
- CSS variables in `globals.css` for light/dark
- System preference default; user override persisted in `localStorage` key `velontri-theme`

### 10.2 Token Structure

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 160 84% 24%;
  --primary-foreground: 0 0% 100%;
  --muted: 210 40% 96%;
  --border: 214 32% 91%;
  --radius: 0.5rem;
  /* … full shadcn token set */
}

.dark {
  --background: 222 47% 7%;
  --foreground: 210 40% 98%;
  /* … */
}
```

### 10.3 Chart Theming

Recharts consume `--chart-1` through `--chart-5` CSS variables for dark-mode-safe analytics.

---

## 11. Component Library

### 11.1 Component Tree (Complete)

```
components/
├── ui/                          # 32 shadcn primitives
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── sheet.tsx                  # Mobile drawers
│   ├── tabs.tsx
│   ├── table.tsx
│   ├── skeleton.tsx
│   ├── toast.tsx
│   ├── badge.tsx
│   ├── avatar.tsx
│   ├── dropdown-menu.tsx
│   ├── command.tsx                # Command palette
│   ├── pagination.tsx
│   └── …
│
├── layout/
│   ├── navbar.tsx
│   ├── footer.tsx
│   ├── sidebar.tsx
│   ├── top-bar.tsx
│   ├── mobile-nav.tsx
│   ├── breadcrumbs.tsx
│   ├── page-header.tsx
│   └── dashboard-shell.tsx
│
├── auth/
│   ├── login-form.tsx
│   ├── register-form.tsx
│   ├── otp-input.tsx
│   ├── password-strength.tsx
│   ├── two-factor-setup.tsx
│   ├── device-list.tsx
│   └── oauth-buttons.tsx
│
├── marketplace/
│   ├── listing-card.tsx
│   ├── listing-grid.tsx
│   ├── listing-detail/
│   │   ├── product-detail.tsx
│   │   ├── service-detail.tsx
│   │   ├── job-detail.tsx
│   │   ├── property-detail.tsx
│   │   └── vehicle-detail.tsx
│   ├── category-grid.tsx
│   ├── store-card.tsx
│   ├── review-card.tsx
│   ├── review-form.tsx
│   ├── media-gallery.tsx
│   ├── variant-selector.tsx
│   ├── booking-form.tsx
│   ├── job-application-form.tsx
│   ├── mortgage-calculator.tsx    # Property PRD
│   └── publish-wizard.tsx
│
├── search/
│   ├── search-bar.tsx
│   ├── search-filters.tsx
│   ├── search-results.tsx
│   ├── autocomplete-dropdown.tsx
│   ├── voice-search-button.tsx
│   └── ai-search-toggle.tsx
│
├── wallet/
│   ├── wallet-card.tsx
│   ├── balance-display.tsx
│   ├── transaction-list.tsx
│   ├── transaction-row.tsx
│   ├── topup-form.tsx
│   ├── withdraw-form.tsx
│   ├── transfer-form.tsx
│   └── rewards-panel.tsx
│
├── payments/
│   ├── escrow-timeline.tsx
│   ├── payment-status-badge.tsx
│   ├── initiate-payment-form.tsx
│   ├── confirm-delivery-button.tsx
│   ├── dispute-form.tsx
│   └── gateway-selector.tsx
│
├── chat/
│   ├── thread-list.tsx
│   ├── thread-item.tsx
│   ├── message-list.tsx
│   ├── message-bubble.tsx
│   ├── chat-input.tsx
│   ├── typing-indicator.tsx
│   ├── read-receipt.tsx
│   └── media-attachment.tsx
│
├── notifications/
│   ├── notification-bell.tsx
│   ├── notification-list.tsx
│   ├── notification-item.tsx
│   └── preference-form.tsx
│
├── inventory/
│   ├── stock-table.tsx
│   ├── sku-form.tsx
│   ├── barcode-display.tsx
│   ├── transfer-form.tsx
│   ├── damage-form.tsx
│   ├── movement-history.tsx
│   └── low-stock-alert.tsx
│
├── crm/
│   ├── customer-table.tsx
│   ├── customer-card.tsx
│   ├── customer-detail.tsx
│   ├── purchase-history.tsx
│   ├── notes-panel.tsx
│   └── note-form.tsx
│
├── analytics/
│   ├── metric-card.tsx
│   ├── chart-panel.tsx
│   ├── top-listings-table.tsx
│   ├── retention-chart.tsx
│   ├── export-button.tsx
│   └── date-range-picker.tsx
│
├── logistics/
│   ├── quote-form.tsx
│   ├── carrier-comparison.tsx
│   ├── shipment-card.tsx
│   ├── tracking-timeline.tsx
│   └── delivery-proof.tsx
│
├── ai/
│   ├── assistant-panel.tsx
│   ├── assistant-message.tsx
│   ├── compare-panel.tsx
│   ├── cv-score-card.tsx
│   ├── bi-insights-panel.tsx
│   ├── forecast-chart.tsx
│   └── ai-fab.tsx
│
├── subscription/
│   ├── tier-card.tsx
│   ├── tier-comparison-table.tsx
│   ├── upgrade-modal.tsx
│   ├── invoice-list.tsx
│   └── feature-gate-banner.tsx
│
├── branch/
│   ├── branch-selector.tsx
│   ├── branch-card.tsx
│   ├── branch-form.tsx
│   └── multi-branch-overview.tsx
│
├── rbac/
│   ├── can.tsx
│   ├── role-gate.tsx
│   └── tier-gate.tsx
│
└── shared/
    ├── empty-state.tsx
    ├── error-state.tsx
    ├── loading-state.tsx
    ├── page-skeleton.tsx
    ├── confirm-dialog.tsx
    ├── currency-display.tsx
    ├── country-selector.tsx
    ├── trust-badge.tsx
    ├── pagination-controls.tsx
    └── seo-head.tsx
```

**Total components:** ~120 (32 primitives + ~88 domain)

---

## 12. RBAC System

### 12.1 Role Types

```typescript
type VelontriRole =
  | 'guest'
  | 'buyer'
  | 'seller'
  | 'agent'
  | 'branch_manager'
  | 'business_owner'
  | 'enterprise_admin'
  | 'moderator'
  | 'ops';

type SubscriptionTier =
  | 'starter'
  | 'basic'        // maps to PRD "Growth" in some docs — normalize to backend
  | 'professional' // maps to PRD "Pro"
  | 'enterprise';
```

> **Note:** Align tier string literals with backend JWT claims during implementation (`docs/ROLE_PERMISSION_MATRIX.md`).

### 12.2 Permission Model

```typescript
// lib/rbac/permissions.ts
type Permission =
  | 'listings:create'
  | 'listings:edit:own'
  | 'listings:moderate'
  | 'payments:initiate'
  | 'payments:dispute'
  | 'payments:resolve_dispute'
  | 'wallet:read'
  | 'wallet:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'analytics:seller'
  | 'analytics:branch'
  | 'analytics:platform'
  | 'crm:read'
  | 'crm:write'
  | 'ai:search'
  | 'ai:bi'
  | 'admin:users'
  | 'admin:roles'
  | …;

const ROLE_PERMISSIONS: Record<VelontriRole, Permission[]>;
```

Matrix derived from `docs/ROLE_PERMISSION_MATRIX.md` — **no permissions removed**.

### 12.3 Component Guards

```tsx
// Declarative
<Can permission="listings:create">
  <CreateListingButton />
</Can>

<RoleGate roles={['seller', 'agent', 'business_owner']}>
  <SellerDashboard />
</RoleGate>

<TierGate feature="ai_bi" fallback={<UpgradeBanner />}>
  <BIInsightsPanel />
</TierGate>
```

### 12.4 Route Guards

```typescript
// config/routes.ts
export const ROUTE_GUARDS: Record<string, GuardConfig> = {
  '/seller/listings/create': { roles: ['seller', 'agent', 'business_owner', 'enterprise_admin'] },
  '/branch/inventory':       { roles: ['branch_manager', 'business_owner', 'enterprise_admin'] },
  '/admin/disputes':         { roles: ['enterprise_admin', 'ops'] },
  '/ai/bi':                  { tier: ['professional', 'enterprise'] },
};
```

Middleware handles auth presence; layout server components enforce role/tier.

### 12.5 Tier Feature Gates

| Feature | starter | basic | professional | enterprise |
|---------|---------|-------|--------------|------------|
| Active listings | 3 | 10 | 50 | Unlimited |
| Store page | ❌ | ✅ | ✅ | ✅ |
| Analytics | ❌ | Basic | Full | Full + Export |
| AI search | ❌ | ❌ | ✅ | ✅ |
| CRM | ❌ | ❌ | ✅ | ✅ |
| Multi-branch | ❌ | ❌ | ❌ | ✅ |

---

## 13. Page Inventory (Phase 2)

Every page includes: **responsive layout**, **loading skeleton**, **empty state**, **error boundary**, **SEO metadata**, **dark mode**.

### 13.1 Public Pages (14)

| Page | Route | SEO | API |
|------|-------|-----|-----|
| Home | `/` | ✅ JSON-LD Organization | Featured listings |
| Search | `/search` | ✅ dynamic title | `GET /search` |
| Listings browse | `/listings` | ✅ | `GET /listings` |
| Products | `/listings/products` | ✅ | filtered |
| Services | `/listings/services` | ✅ | filtered |
| Jobs | `/listings/jobs` | ✅ | filtered |
| Property | `/listings/property` | ✅ | filtered |
| Vehicles | `/listings/vehicles` | ✅ | filtered |
| Listing detail | `/listings/[id]` | ✅ JSON-LD Product | `GET /listings/{id}` |
| Stores | `/stores` | ✅ | `GET /stores` |
| Store profile | `/stores/[slug]` | ✅ | store + listings |
| Tier catalog | `/subscriptions/tiers` | ✅ | `GET /subscriptions/tiers` |
| About | `/about` | ✅ | static |
| Contact | `/contact` | ✅ | form → notifications |

### 13.2 Auth Pages (7)

| Page | Route | API |
|------|-------|-----|
| Login | `/login` | `POST /auth/login` |
| Register | `/register` | `POST /auth/register` |
| Verify phone | `/verify-phone` | `POST /auth/verify-phone` |
| Forgot password | `/forgot-password` | `POST /auth/password/reset-request` |
| Reset password | `/reset-password/[token]` | `POST /auth/password/reset` |
| 2FA setup | `/auth/2fa` | `POST /auth/2fa/enable` |
| 2FA verify | `/auth/2fa/verify` | `POST /auth/2fa/verify` |

### 13.3 Buyer Pages (12)

| Page | Route | API |
|------|-------|-----|
| Dashboard | `/buyer/dashboard` | orders summary, notifications |
| Orders | `/buyer/orders` | payments list |
| Order detail | `/buyer/orders/[id]` | `GET /payments/{id}` |
| Checkout | `/buyer/checkout/[listingId]` | `POST /payments/initiate` |
| Wallet | `/buyer/wallet` | `GET /wallet/balance` |
| Top-up | `/buyer/wallet/topup` | `POST /wallet/topup` |
| Withdraw | `/buyer/wallet/withdraw` | `POST /wallet/withdraw` |
| Transfer | `/buyer/wallet/transfer` | `POST /wallet/transfer` |
| Transactions | `/buyer/wallet/transactions` | `GET /wallet/transactions` |
| Rewards | `/buyer/wallet/rewards` | `GET /wallet/rewards` |
| Messages | `/buyer/messages` | WebSocket + `GET /chat/threads` |
| Thread | `/buyer/messages/[threadId]` | messages history |
| Notifications | `/buyer/notifications` | `GET /notifications/history` |
| Profile | `/buyer/profile` | `GET /users/me/profile` |
| Settings | `/buyer/settings/*` | preferences, 2FA, devices |

### 13.4 Seller Pages (10)

| Page | Route | API |
|------|-------|-----|
| Dashboard | `/seller/dashboard` | analytics summary |
| My listings | `/seller/listings` | `GET /listings?seller=me` |
| Create listing | `/seller/listings/create/*` | `POST /listings` + media |
| Edit listing | `/seller/listings/[id]/edit` | `PATCH /listings/{id}` |
| Store | `/seller/store` | `POST /stores` |
| Orders | `/seller/orders` | seller payment view |
| Reviews | `/seller/reviews` | listing reviews |
| Analytics | `/seller/analytics` | `GET /analytics/seller/{id}/*` |
| Wallet | `/seller/wallet` | wallet endpoints |
| Settings | `/seller/settings` | profile + subscription |

### 13.5 Agent Pages (5)

| Page | Route | API |
|------|-------|-----|
| Dashboard | `/agent/dashboard` | CRM + listings summary |
| Listings | `/agent/listings` | on-behalf listings |
| CRM | `/agent/crm` | `GET /crm/customers` |
| Customer detail | `/agent/crm/customers/[id]` | CRM detail |
| Analytics | `/agent/analytics` | seller analytics |

### 13.6 Branch Manager Pages (6)

| Page | Route | API |
|------|-------|-----|
| Dashboard | `/branch/dashboard` | branch metrics |
| Stock | `/branch/inventory/stock` | `GET /inventory/{branch_id}/stock` |
| Transfers | `/branch/inventory/transfers` | `POST /inventory/transfers` |
| Damage | `/branch/inventory/damage` | `POST /inventory/damage` |
| SKU detail | `/branch/inventory/sku/[sku]` | history + barcode |
| Analytics | `/branch/analytics` | `GET /analytics/branch/{id}/*` |

### 13.7 Business Owner Pages (10)

| Page | Route | API |
|------|-------|-----|
| Dashboard | `/business/dashboard` | cross-branch overview |
| Branches | `/business/branches` | `GET /businesses` |
| Create branch | `/business/branches/create` | `POST /businesses/{id}/branches` |
| Branch detail | `/business/branches/[id]` | branch management |
| Inventory | `/business/inventory` | multi-branch stock |
| Analytics | `/business/analytics` | seller + branch |
| CRM | `/business/crm` | full CRM |
| Subscription | `/business/subscriptions` | tier management |
| Invoices | `/business/subscriptions/invoices` | `GET /subscriptions/invoices` |
| Settings | `/business/settings` | business profile |

### 13.8 Admin Pages (8)

| Page | Route | API |
|------|-------|-----|
| Dashboard | `/admin/dashboard` | platform metrics |
| Users | `/admin/users` | user management |
| User detail | `/admin/users/[id]` | `PATCH /users/{id}/roles` |
| Moderation | `/admin/listings/moderation` | `PATCH /listings/{id}/status` |
| Disputes | `/admin/disputes` | dispute list |
| Dispute detail | `/admin/disputes/[id]` | `PATCH /disputes/{id}/resolve` |
| Platform analytics | `/admin/analytics/platform` | ops analytics |
| Settings | `/admin/settings` | platform config |

### 13.9 Shared Feature Pages (8)

| Page | Route | API |
|------|-------|-----|
| Payment / Escrow | `/payments/[id]` | payment detail + timeline |
| Dispute | `/payments/[id]/dispute` | `POST /payments/{id}/dispute` |
| Shipment tracking | `/logistics/track/[trackingNo]` | `GET /logistics/shipments/{no}` |
| AI Assistant | `/ai/assistant` | `POST /ai/assistant/query` |
| AI BI | `/ai/bi` | `POST /ai/bi/*` (tier-gated) |
| Job application | `/listings/[id]/apply` | `POST /listings/{id}/applications` |
| Service booking | `/listings/[id]/book` | `POST /bookings` |
| Legal | `/terms`, `/privacy` | static |

**Total pages:** ~80 unique page components

---

## 14. Dashboard Architecture (Phases 5–6)

### 14.1 Dashboard Widget Matrix

| Widget | Buyer | Seller | Agent | Branch | Business | Admin |
|--------|-------|--------|-------|--------|----------|-------|
| Order summary | ✅ | ✅ | — | — | ✅ | — |
| Wallet balance | ✅ | ✅ | ✅ | — | ✅ | — |
| Active listings | — | ✅ | ✅ | — | ✅ | — |
| Revenue chart | — | ✅ | ✅ | — | ✅ | ✅ |
| Low stock alerts | — | — | — | ✅ | ✅ | — |
| CRM pipeline | — | — | ✅ | — | ✅ | — |
| Branch overview | — | — | — | ✅ | ✅ | — |
| Dispute queue | — | — | — | — | — | ✅ |
| Moderation queue | — | — | — | — | — | ✅ |
| AI insights | — | ✅* | ✅* | — | ✅* | — |
| Notifications feed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick actions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Tier-gated: professional / enterprise

### 14.2 Module UI Specifications

#### AI Assistant UI (`/ai/assistant`)
- Floating FAB on dashboard layouts
- Full-page chat interface with product cards inline
- Compare mode: side-by-side listings
- Voice input → `POST /search/voice` + `POST /ai/search/transcribe`

#### Wallet UI
- Multi-currency display (NGN, GHS, KES, ZAR, XOF)
- Transaction list with filters
- Top-up gateway selection by country
- Rewards redemption flow

#### Escrow UI
- Visual timeline: initiated → held → shipped → delivered → released
- 72h auto-release countdown
- Dispute initiation with evidence upload
- Confirm delivery CTA (buyer only)

#### Inventory UI
- Branch-scoped stock table
- Barcode/QR preview + print
- Inter-branch transfer wizard
- Damage recording with photos
- Movement history audit trail

#### CRM UI
- Customer search + filter
- Purchase history timeline
- Staff notes with author + timestamp
- Scope: seller sees own customers; business owner sees all branches

#### Analytics UI
- Date range picker
- Metric cards (revenue, orders, conversion)
- Top listings table
- Retention cohort chart
- CSV/PDF export (tier-gated)

#### Multi-Branch UI
- Branch selector in top bar (branch_manager+)
- Branch comparison cards
- Cross-branch inventory heatmap
- Per-branch analytics drill-down

---

## 15. Testing Strategy (Phase 7)

### 15.1 Test Pyramid

```
        ┌─────────┐
        │  E2E    │  Playwright (~40 flows)
        ├─────────┤
        │ Integr. │  Vitest + MSW (~80 tests)
        ├─────────┤
        │  Unit   │  Vitest (~200 tests)
        ├─────────┤
        │Component│  RTL (~150 tests)
        └─────────┘
```

### 15.2 Unit Tests

| Target | Examples |
|--------|----------|
| `lib/rbac/` | permission checks, tier gates |
| `lib/api/interceptors` | token refresh, retry, error mapping |
| `lib/utils/currency` | formatting all 5 currencies |
| `lib/auth/jwt` | payload parsing |

### 15.3 Component Tests

| Component | Cases |
|-----------|-------|
| `ListingCard` | renders, loading, empty image |
| `LoginForm` | validation, error display, submit |
| `EscrowTimeline` | all status states |
| `Can` | renders children / fallback |
| `WalletCard` | multi-currency display |

### 15.4 Integration Tests

| Flow | Tools |
|------|-------|
| Auth login → dashboard redirect | Vitest + MSW |
| Create listing → appears in list | MSW + Query |
| Payment initiate → wallet update | MSW chain |
| Token refresh on 401 | Axios interceptor test |

### 15.5 E2E Tests (Playwright)

| Flow | PRD requirement |
|------|-----------------|
| Guest browse → search → listing detail | Req 3, 8 |
| Register → verify → login → profile | Req 1, 2 |
| Seller create listing → publish | Req 3 |
| Buyer checkout → escrow → confirm delivery | Req 12 |
| Wallet top-up → transfer | Req 13 |
| Chat send message | Req 10 |
| Branch inventory transfer | Req 14, 15 |
| Subscription upgrade | Req 20 |
| Admin dispute resolution | Req 12, 22 |
| AI assistant query | Req 9 |
| Dark mode toggle persists | NFR |
| Mobile responsive nav | NFR |

### 15.6 Accessibility Tests

- `@axe-core/playwright` on all page templates
- Keyboard navigation on modals, sidebar, chat
- Screen reader labels on icon-only buttons
- Color contrast ≥ 4.5:1 (WCAG AA)

### 15.7 Coverage Targets

| Layer | Target |
|-------|--------|
| `lib/` | ≥ 90% |
| `features/` hooks | ≥ 80% |
| `components/` | ≥ 70% |
| E2E critical paths | 100% of PRD flows |

---

## 16. Senior Frontend Audit Checklist (Phase 8)

Run after Phase 7 completion.

### UX Consistency
- [ ] Design tokens used consistently (no hardcoded colors)
- [ ] Spacing rhythm matches 4px grid
- [ ] All forms use same validation pattern (Zod + RHF)
- [ ] Toast notifications for all mutations
- [ ] Confirm dialogs for destructive actions

### Accessibility
- [ ] WCAG 2.1 AA axe score 0 violations on key pages
- [ ] Focus management on route transitions
- [ ] `aria-live` on chat and notifications
- [ ] Skip navigation link present

### SEO
- [ ] Unique `<title>` and `<meta description>` per page
- [ ] JSON-LD on listing detail, store, organization
- [ ] `sitemap.xml` includes public listing URLs
- [ ] `robots.txt` blocks dashboard routes
- [ ] Open Graph images for listings

### Performance
- [ ] LCP < 2.5s on home (4G throttled)
- [ ] Images via `next/image` with WebP
- [ ] Route-level code splitting
- [ ] TanStack Query deduplication verified
- [ ] Bundle analysis < 200KB first load JS (public pages)

### Security
- [ ] No tokens in localStorage
- [ ] CSP headers configured
- [ ] XSS: no `dangerouslySetInnerHTML` without sanitization
- [ ] CSRF: cookies `SameSite=Lax`, `Secure` in production
- [ ] RBAC enforced server-side (not client-only)

### Responsiveness
- [ ] Tested at 320px, 768px, 1024px, 1440px
- [ ] Touch targets ≥ 44px on mobile
- [ ] Tables collapse to cards on mobile

### API Integration
- [ ] All pages mapped to backend endpoints (§13)
- [ ] Error codes from `ERROR_CATALOG.md` handled
- [ ] Token refresh single-flight verified
- [ ] WebSocket reconnect tested

### Type Safety
- [ ] `strict: true` in tsconfig
- [ ] API responses validated with Zod at boundary
- [ ] No `any` in `features/` or `lib/api/`

---

## 17. Deployment Strategy

### 17.1 Environments

| Env | Frontend URL | API URL |
|-----|--------------|---------|
| Local | `http://localhost:3000` | `http://localhost:8000/api/v1` |
| Staging | `https://staging.velontri.com` | `https://api-staging.velontri.com/api/v1` |
| Production | `https://velontri.com` | `https://api.velontri.com/api/v1` |

### 17.2 Hosting

- **Recommended:** Vercel (Next.js native)
- **Alternative:** AWS Amplify, Cloudflare Pages

### 17.3 Build Pipeline

```yaml
# .github/workflows/frontend.yml (future)
steps:
  - npm ci
  - npm run type-check
  - npm run lint
  - npm run test
  - npm run build
  - npx playwright test (staging only)
  - deploy to Vercel
```

### 17.4 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend gateway base |
| `NEXT_PUBLIC_WS_URL` | ✅ | WebSocket base (no /api/v1) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical URL for SEO |
| `NEXT_PUBLIC_GA_ID` | ❌ | Analytics (future) |

### 17.5 CDN & Caching

- Static assets: immutable cache
- Public listing pages: ISR revalidate 60s
- Dashboard pages: `dynamic = 'force-dynamic'`
- API responses: TanStack Query client cache only

---

## 18. Gap Analysis

### 18.1 Current State vs Target

| Area | Current | Target | Gap |
|------|---------|--------|-----|
| Folder structure | `src/app/page.tsx` only | Full tree (§3) | **Large** |
| Dependencies | next, react only | Full stack (§2) | **Large** |
| Design system | None | Tailwind + shadcn | **Large** |
| API layer | None | Axios + TanStack Query | **Large** |
| Auth | middleware.ts only | Full auth module | **Medium** |
| RBAC | Middleware regex | Permission matrix + guards | **Medium** |
| Pages | 1 home page | ~80 pages | **Large** |
| Components | 0 domain | ~120 components | **Large** |
| Tests | 0 | ~470 tests | **Large** |
| SEO | None | Metadata + sitemap | **Medium** |

### 18.2 Backend Alignment Notes

| Item | Status | Action |
|------|--------|--------|
| Tier naming | PRD uses Starter/Growth/Pro; JWT uses starter/basic/professional | Map in `tier-gates.ts` |
| OpenAPI types | 91 endpoints documented | Generate types from `/openapi.json` in Phase 4 |
| SDK | `backend/sdk/js/velontri-sdk.js` exists | Wrap with TanStack Query hooks; do not duplicate |
| OAuth | Backend ready | Frontend callback route needed |
| Pact contracts | Not in repo | Optional; MSW fixtures sufficient for now |

### 18.3 Risks

| Risk | Mitigation |
|------|------------|
| Gateway cold start 90s+ | Frontend health check retry; dev loading screen |
| WebSocket auth expiry | Reconnect with refreshed token |
| Large component count | Phased delivery per dashboard persona |
| Tier string mismatch | Single source of truth in `lib/rbac/tier-gates.ts` |

### 18.4 Out of Scope (Unchanged from PRD)

- Mobile native apps
- Phase 2 features (auctions, live streaming, etc.)
- Offline-first PWA (see `MOBILE_OFFLINE_ARCHITECTURE.md` for future)

---

## 19. Implementation Roadmap

### Sprint 0 — Foundation (awaiting approval)
- [ ] Install dependencies (§2)
- [ ] Scaffold folder structure (§3)
- [ ] Configure Tailwind + shadcn + themes (§9–10)
- [ ] Implement API client + interceptors (§8)
- [ ] Auth session provider + extend middleware (§6)
- [ ] RBAC primitives (§12)

### Sprint 1 — Public + Auth
- [ ] Public layout + Navbar + Footer
- [ ] Home, search, listings browse/detail
- [ ] Auth pages (login → verify → dashboard hub)

### Sprint 2 — Buyer + Seller core
- [ ] Buyer dashboard, wallet, checkout, escrow
- [ ] Seller listing create/edit, store, analytics

### Sprint 3 — Operations modules
- [ ] Chat WebSocket UI
- [ ] Notifications
- [ ] Inventory + logistics
- [ ] CRM

### Sprint 4 — Business + Admin
- [ ] Multi-branch dashboards
- [ ] Admin moderation + disputes
- [ ] AI assistant + BI

### Sprint 5 — Quality
- [ ] Full test suite (§15)
- [ ] Senior audit (§16)
- [ ] Performance + SEO pass
- [ ] Deployment pipeline (§17)

---

## Approval Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product | | | ☐ |
| Engineering | | | ☐ |
| Design | | | ☐ |

**Once approved, implementation begins at Sprint 0. No page code will be written before sign-off.**

---

*This document is the canonical frontend architecture for Velontri v1.0.0. It implements every PRD requirement without redesign or simplification.*
