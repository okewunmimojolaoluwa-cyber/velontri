# Velontri Role & Permission Matrix

## Role Definitions

| Role | Description |
|---|---|
| `guest` | Unauthenticated user. Can browse, search, view listings. |
| `buyer` | Authenticated user. Can purchase, book, message sellers, manage wallet. |
| `seller` | Can create/manage listings, view analytics, manage store. |
| `agent` | Real estate or auto agent. Can create listings on behalf of others. Same as seller + CRM. |
| `branch_manager` | Manages inventory and staff at a business branch. |
| `business_owner` | Owns one or more businesses. Can create branches, view all branch analytics. |
| `enterprise_admin` | Platform superuser. Full access to all resources. Can moderate, resolve disputes, manage roles. |
| `moderator` | Can approve/reject listings. Cannot access financial data. |
| `ops` | Operations team. Can resolve disputes. Read-only analytics. |

A user can hold **multiple roles** simultaneously (e.g., `buyer` + `seller`).

---

## JWT Claims Structure

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "iss": "velontri-auth",
  "aud": "velontri-api",
  "iat": 1720000000,
  "exp": 1720000900,
  "roles": ["buyer", "seller"],
  "subscription_tier": "professional",
  "branch_ids": ["branch-uuid-1", "branch-uuid-2"],
  "country_code": "NG"
}
```

**Field descriptions:**
- `sub` — User UUID (primary key)
- `iss` — Always `velontri-auth`
- `aud` — Always `velontri-api`
- `exp` — Unix timestamp; access token is valid for 900 seconds (15 min)
- `roles` — Array of role strings
- `subscription_tier` — `starter | basic | professional | enterprise`
- `branch_ids` — UUIDs of branches the user manages (branch_manager only)
- `country_code` — ISO 3166-1 alpha-2

---

## How to Check Roles on the Frontend

### Parse the JWT (TypeScript)

```typescript
interface VelontriTokenPayload {
  sub: string;
  roles: string[];
  subscription_tier: 'starter' | 'basic' | 'professional' | 'enterprise';
  branch_ids: string[];
  country_code: string;
  exp: number;
}

function parseToken(token: string): VelontriTokenPayload {
  const base64 = token.split('.')[1];
  return JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')));
}

function hasRole(token: string, role: string): boolean {
  try {
    return parseToken(token).roles.includes(role);
  } catch {
    return false;
  }
}

function canCreateListing(token: string): boolean {
  const { roles } = parseToken(token);
  return roles.some(r => ['seller', 'agent', 'business_owner', 'enterprise_admin'].includes(r));
}
```

### React Hook Example

```typescript
// From useAuth.ts — roles helpers
const { user } = useAuth();

const isSeller = user?.roles.includes('seller') ?? false;
const isAdmin  = user?.roles.includes('enterprise_admin') ?? false;
const canViewCRM = user?.roles.some(r => ['agent', 'branch_manager', 'business_owner', 'enterprise_admin'].includes(r)) ?? false;
```

---

## Permission Matrix

✅ = Allowed | ❌ = Denied | 🔐 = Own resources only | 👑 = Role required

### Auth Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| POST /auth/register | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/token/refresh | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/logout | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET  /auth/introspect | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/2fa/enable | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET  /auth/devices | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DELETE /auth/devices/{id} | ❌ | 🔐 | 🔐 | 🔐 | 🔐 | 🔐 | ✅ |

### User Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| GET /users/{id}/profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PATCH /users/me/profile | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /users/me/kyc/* | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /businesses | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| GET /businesses | ❌ | ❌ | 🔐 | 🔐 | ❌ | ✅ | ✅ |
| POST /businesses/{id}/branches | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| PATCH /users/{id}/roles | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 enterprise_admin |

### Marketplace Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| GET /listings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /listings/{id} | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /listings | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| PATCH /listings/{id} | ❌ | ❌ | 🔐 | 🔐 | ❌ | 🔐 | ✅ |
| DELETE /listings/{id} | ❌ | ❌ | 🔐 | 🔐 | ❌ | 🔐 | ✅ |
| POST /listings/{id}/images | ❌ | ❌ | 🔐 | 🔐 | ❌ | 🔐 | ✅ |
| POST /listings/{id}/publish | ❌ | ❌ | 🔐 | 🔐 | ❌ | 🔐 | ✅ |
| PATCH /listings/{id}/status | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 moderator/admin |
| POST /listings/{id}/reviews | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| POST /reviews/{id}/response | ❌ | ❌ | 🔐 | 🔐 | ❌ | 🔐 | ✅ |
| POST /bookings | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| POST /stores | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| POST /listings/{id}/applications | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Search Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| GET /search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /search/autocomplete | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /search/voice | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /search/ai | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Payment Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| POST /payments/initiate | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| POST /payments/{id}/confirm-delivery | ❌ | 🔐 | ❌ | ❌ | ❌ | ❌ | ✅ |
| POST /payments/{id}/dispute | ❌ | 🔐 | ❌ | ❌ | ❌ | ❌ | ✅ |
| PATCH /disputes/{id}/resolve | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 enterprise_admin/ops |
| GET /payments/{id} | ❌ | 🔐 | 🔐 | ❌ | ❌ | ❌ | ✅ |

### Wallet Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| GET /wallet/balance | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /wallet/topup | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /wallet/withdraw | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /wallet/transfer | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /wallet/transactions | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /wallet/rewards | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /wallet/rewards/redeem | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Inventory Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| GET /inventory/{branch_id}/stock | ❌ | ❌ | ❌ | ❌ | 🔐 | ✅ | ✅ |
| POST /inventory/sku | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| POST /inventory/transfers | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| POST /inventory/damage | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

### Analytics Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| GET /analytics/seller/{id}/summary | ❌ | ❌ | 🔐 | 🔐 | ❌ | ✅ | ✅ |
| GET /analytics/branch/{id}/summary | ❌ | ❌ | ❌ | ❌ | 🔐 | ✅ | ✅ |
| GET /analytics/seller/{id}/top-listings | ❌ | ❌ | 🔐 | 🔐 | ❌ | ✅ | ✅ |

### CRM Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| GET /crm/customers | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /crm/customers/{id} | ❌ | ❌ | 🔐 | 🔐 | ✅ | ✅ | ✅ |
| POST /crm/customers/{id}/notes | ❌ | ❌ | 🔐 | 🔐 | ✅ | ✅ | ✅ |

### Subscription Service

| Endpoint | guest | buyer | seller | agent | branch_mgr | biz_owner | enterprise_admin |
|---|---|---|---|---|---|---|---|
| GET /subscriptions/tiers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /subscriptions/me | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /subscriptions/upgrade | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /subscriptions/downgrade | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /subscriptions/invoices | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Subscription Tier Capabilities

| Feature | starter | basic | professional | enterprise |
|---|---|---|---|---|
| Active listings | 3 | 10 | 50 | Unlimited |
| Store page | ❌ | ✅ | ✅ | ✅ |
| Analytics | ❌ | Basic | Full | Full + Export |
| AI search | ❌ | ❌ | ✅ | ✅ |
| Featured listing | ❌ | ❌ | ✅ | ✅ |
| API access (B2B) | ❌ | ❌ | ❌ | ✅ |
| CRM access | ❌ | ❌ | ✅ | ✅ |
| Multi-branch | ❌ | ❌ | ❌ | ✅ |

---

## Backend Role Enforcement

The backend checks roles via `shared/auth.py`:

```python
# Require at least one role from a list
from shared.auth import require_roles

@router.delete("/admin/thing")
async def delete(_: None = Depends(require_roles("enterprise_admin", "ops"))):
    ...

# Get user roles in a handler
@router.get("/my-data")
async def my_data(payload: dict = Depends(get_user_payload)):
    roles = payload.get("roles", [])
    if "seller" not in roles:
        raise ForbiddenError("Seller role required.")
```
