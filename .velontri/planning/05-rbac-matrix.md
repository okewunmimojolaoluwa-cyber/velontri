# Velontri RBAC Matrix

## Role Hierarchy

```
Guest (Level 0)
    ↓
User (Level 1)
    ↓
Moderator (Level 2)
    ↓
Super Admin (Level 3)
```

### Role Promotion Rules
- **Guest → User**: Self-registration
- **User → Moderator**: Cannot self-promote (only Super Admin can assign)
- **Moderator → Super Admin**: Cannot self-promote (single account only)
- **Super Admin**: Single account, cannot be created by others

---

## Permission Categories

### 1. Marketplace Permissions
### 2. Financial Permissions
### 3. Communication Permissions
### 4. Store Permissions
### 5. Moderation Permissions
### 6. Admin Permissions

---

## RBAC Matrix

| Permission | Guest | User | Moderator | Super Admin |
|------------|-------|------|-----------|-------------|
| **MARKETPLACE** | | | | |
| View listings | ✅ | ✅ | ✅ | ✅ |
| Search listings | ✅ | ✅ | ✅ | ✅ |
| View listing details | ✅ | ✅ | ✅ | ✅ |
| Create listings | ❌ | ✅ | ❌ | ✅ |
| Edit own listings | ❌ | ✅ | ❌ | ✅ |
| Delete own listings | ❌ | ✅ | ❌ | ✅ |
| Edit any listing | ❌ | ❌ | ❌ | ✅ |
| Delete any listing | ❌ | ❌ | ❌ | ✅ |
| Promote listings | ❌ | ✅ | ❌ | ✅ |
| Buy items | ❌ | ✅ | ❌ | ✅ |
| Sell items | ❌ | ✅ | ❌ | ✅ |
| Save listings | ❌ | ✅ | ❌ | ✅ |
| Follow stores | ❌ | ✅ | ❌ | ✅ |
| **FINANCIAL** | | | | |
| View own wallet balance | ❌ | ✅ | ❌ | ✅ |
| Add funds to wallet | ❌ | ✅ | ❌ | ✅ |
| Withdraw from wallet | ❌ | ✅ | ❌ | ✅ |
| View any wallet balance | ❌ | ❌ | ❌ | ✅ |
| View own escrow balance | ❌ | ✅ | ❌ | ✅ |
| View any escrow balance | ❌ | ❌ | ❌ | ✅ |
| View own transactions | ❌ | ✅ | ❌ | ✅ |
| View any transactions | ❌ | ❌ | ❌ | ✅ |
| Request refunds | ❌ | ✅ | ❌ | ✅ |
| Process refunds | ❌ | ❌ | ❌ | ✅ |
| View revenue reports | ❌ | ❌ | ❌ | ✅ |
| View sales reports | ❌ | ❌ | ❌ | ✅ |
| **COMMUNICATION** | | | | |
| Send messages | ❌ | ✅ | ❌ | ✅ |
| Receive messages | ❌ | ✅ | ❌ | ✅ |
| View any messages | ❌ | ❌ | ❌ | ✅ |
| Leave reviews | ❌ | ✅ | ❌ | ✅ |
| Reply to reviews | ❌ | ✅ | ❌ | ✅ |
| Delete own reviews | ❌ | ✅ | ❌ | ✅ |
| Delete any reviews | ❌ | ❌ | ❌ | ✅ |
| View notifications | ❌ | ✅ | ✅ | ✅ |
| Send announcements | ❌ | ❌ | ✅ | ✅ |
| Send email campaigns | ❌ | ❌ | ❌ | ✅ |
| Send SMS campaigns | ❌ | ❌ | ❌ | ✅ |
| Send push notifications | ❌ | ❌ | ❌ | ✅ |
| **STORE** | | | | |
| Create store | ❌ | ✅ | ❌ | ✅ |
| Edit own store | ❌ | ✅ | ❌ | ✅ |
| Delete own store | ❌ | ✅ | ❌ | ✅ |
| Edit any store | ❌ | ❌ | ❌ | ✅ |
| Delete any store | ❌ | ❌ | ❌ | ✅ |
| View store analytics | ❌ | ✅ | ❌ | ✅ |
| View any store analytics | ❌ | ❌ | ❌ | ✅ |
| Manage store followers | ❌ | ✅ | ❌ | ✅ |
| **MODERATION** | | | | |
| Approve listings | ❌ | ❌ | ✅ | ✅ |
| Reject listings | ❌ | ❌ | ✅ | ✅ |
| Suspend listings | ❌ | ❌ | ✅ | ✅ |
| Approve stores | ❌ | ❌ | ✅ | ✅ |
| Reject stores | ❌ | ❌ | ✅ | ✅ |
| Suspend stores | ❌ | ❌ | ✅ | ✅ |
| Approve KYC | ❌ | ❌ | ✅ | ✅ |
| Reject KYC | ❌ | ❌ | ✅ | ✅ |
| Suspend users | ❌ | ❌ | ✅ | ✅ |
| View reports | ❌ | ❌ | ✅ | ✅ |
| Resolve disputes | ❌ | ❌ | ✅ | ✅ |
| Handle support tickets | ❌ | ❌ | ✅ | ✅ |
| View moderation logs | ❌ | ❌ | ✅ | ✅ |
| **ADMIN** | | | | |
| Create moderators | ❌ | ❌ | ❌ | ✅ |
| Edit moderators | ❌ | ❌ | ❌ | ✅ |
| Suspend moderators | ❌ | ❌ | ❌ | ✅ |
| Delete moderators | ❌ | ❌ | ❌ | ✅ |
| Assign permissions | ❌ | ❌ | ❌ | ✅ |
| Remove permissions | ❌ | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ❌ | ✅ |
| Configure platform | ❌ | ❌ | ❌ | ✅ |
| Manage homepage | ❌ | ❌ | ❌ | ✅ |
| Manage categories | ❌ | ❌ | ❌ | ✅ |
| Manage locations | ❌ | ❌ | ❌ | ✅ |
| Manage currencies | ❌ | ❌ | ❌ | ✅ |
| Manage languages | ❌ | ❌ | ❌ | ✅ |
| Create coupons | ❌ | ❌ | ❌ | ✅ |
| Create promotions | ❌ | ❌ | ❌ | ✅ |
| Manage subscriptions | ❌ | ❌ | ❌ | ✅ |
| Export reports | ❌ | ❌ | ❌ | ✅ |
| View business settings | ❌ | ❌ | ❌ | ✅ |
| Edit business settings | ❌ | ❌ | ❌ | ✅ |
| View platform settings | ❌ | ❌ | ❌ | ✅ |
| Edit platform settings | ❌ | ❌ | ❌ | ✅ |

---

## Role-Specific Permission Sets

### Guest Permissions
```
✅ View listings
✅ Search listings
✅ View listing details
```

### User Permissions
```
✅ All Guest permissions
✅ Create listings
✅ Edit own listings
✅ Delete own listings
✅ Promote listings
✅ Buy items
✅ Sell items
✅ Save listings
✅ Follow stores
✅ View own wallet balance
✅ Add funds to wallet
✅ Withdraw from wallet
✅ View own escrow balance
✅ View own transactions
✅ Request refunds
✅ Send messages
✅ Receive messages
✅ Leave reviews
✅ Reply to reviews
✅ Delete own reviews
✅ View notifications
✅ Create store
✅ Edit own store
✅ Delete own store
✅ View store analytics
✅ Manage store followers
```

### Moderator Permissions
```
✅ All Guest permissions
✅ View listings
✅ Search listings
✅ View listing details
✅ View notifications
✅ Send announcements
✅ Approve listings
✅ Reject listings
✅ Suspend listings
✅ Approve stores
✅ Reject stores
✅ Suspend stores
✅ Approve KYC
✅ Reject KYC
✅ Suspend users
✅ View reports
✅ Resolve disputes
✅ Handle support tickets
✅ View moderation logs
```

### Super Admin Permissions
```
✅ ALL PERMISSIONS
```

---

## Permission Inheritance

### Guest
- Base permissions only
- No inheritance

### User
- Inherits all Guest permissions
- Adds User-specific permissions
- Cannot inherit from higher roles

### Moderator
- Inherits all Guest permissions
- Does NOT inherit User permissions
- Adds Moderator-specific permissions
- Cannot inherit from Super Admin

### Super Admin
- Inherits all permissions from all roles
- Has full system access

---

## Permission Constraints

### User Constraints
- Can only edit/delete own listings
- Can only edit/delete own store
- Can only view own financial data
- Can only delete own reviews
- Cannot access moderation tools
- Cannot access admin tools

### Moderator Constraints
- Cannot buy or sell
- Cannot create stores
- Cannot access financial data
- Cannot access admin tools
- Cannot create other moderators
- Cannot modify platform settings
- All actions are logged

### Super Admin Constraints
- Single account only
- Cannot self-delete
- Cannot demote self
- All actions are logged
- Cannot access technical/developer tools

---

## Permission Assignment

### Default Permissions
- **Guest**: Assigned automatically to unauthenticated users
- **User**: Assigned automatically upon registration
- **Moderator**: Assigned by Super Admin only
- **Super Admin**: Single account, created during system setup

### Permission Revocation
- **Guest → User**: Revoked upon logout
- **User**: Can be suspended by Super Admin
- **Moderator**: Can be suspended/deleted by Super Admin
- **Super Admin**: Cannot be revoked (single account)

### Permission Modification
- **Guest**: Cannot be modified
- **User**: Cannot be modified (fixed permission set)
- **Moderator**: Permissions can be adjusted by Super Admin
- **Super Admin**: Full permissions, cannot be reduced

---

## Permission Checking Flow

```
User Action
    ↓
Check Authentication
    ↓
Check Role
    ↓
Check Permission
    ↓
Permission Granted?
    ├─ Yes → Execute Action
    └─ No  → Return 403 Forbidden
```

### Example: User tries to delete a listing

```
1. User is authenticated? ✅
2. User role? User
3. Permission: delete_own_listings
4. Does user own this listing? ✅
5. Permission granted → Delete listing
```

### Example: Moderator tries to view financial data

```
1. User is authenticated? ✅
2. User role? Moderator
3. Permission: view_any_transactions
4. Does moderator have this permission? ❌
5. Permission denied → Return 403 Forbidden
```

---

## Permission Storage

### Database Schema

```sql
-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- guest, user, moderator, super_admin
    level INTEGER NOT NULL, -- 0, 1, 2, 3
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role permissions junction table
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- User roles junction table
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);
```

### Permission Caching

- User permissions cached in JWT token
- Permission checks performed in-memory
- Cache invalidated on role change
- TTL: 15 minutes

---

## Audit Logging

### Logged Actions

All permission-based actions are logged:

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    role VARCHAR(50) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) NOT NULL, -- granted, denied
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Log Retention

- **Guest logs**: 7 days
- **User logs**: 90 days
- **Moderator logs**: 1 year
- **Super Admin logs**: Permanent

---

## Permission API Endpoints

### Check Permission
```
GET /api/permissions/check
Headers: Authorization: Bearer {token}
Query: permission={permission_name}
Response: { has_permission: boolean }
```

### Get User Permissions
```
GET /api/permissions/user
Headers: Authorization: Bearer {token}
Response: { permissions: string[] }
```

### Assign Moderator Permission
```
POST /api/permissions/assign
Headers: Authorization: Bearer {super_admin_token}
Body: { user_id, permission_id }
Response: { success: boolean }
```

### Revoke Permission
```
DELETE /api/permissions/revoke
Headers: Authorization: Bearer {super_admin_token}
Body: { user_id, permission_id }
Response: { success: boolean }
```
