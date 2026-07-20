# Velontri Permission Matrix

## Permission Definitions

### Marketplace Permissions

| Permission ID | Name | Description | Resource |
|--------------|------|-------------|----------|
| MP001 | view_listings | View marketplace listings | listings |
| MP002 | search_listings | Search marketplace listings | listings |
| MP003 | view_listing_details | View detailed listing information | listings |
| MP004 | create_listings | Create new listings | listings |
| MP005 | edit_own_listings | Edit own listings | listings |
| MP006 | delete_own_listings | Delete own listings | listings |
| MP007 | edit_any_listings | Edit any listing in the system | listings |
| MP008 | delete_any_listings | Delete any listing in the system | listings |
| MP009 | promote_listings | Promote listings for visibility | listings |
| MP010 | buy_items | Purchase items from listings | orders |
| MP011 | sell_items | Sell items on marketplace | orders |
| MP012 | save_listings | Save listings to favorites | listings |
| MP013 | follow_stores | Follow stores for updates | stores |

### Financial Permissions

| Permission ID | Name | Description | Resource |
|--------------|------|-------------|----------|
| FN001 | view_own_wallet_balance | View own wallet balance | wallet |
| FN002 | add_funds | Add funds to own wallet | wallet |
| FN003 | withdraw_funds | Withdraw from own wallet | wallet |
| FN004 | view_any_wallet_balance | View any user's wallet balance | wallet |
| FN005 | view_own_escrow_balance | View own escrow balance | escrow |
| FN006 | view_any_escrow_balance | View any user's escrow balance | escrow |
| FN007 | view_own_transactions | View own transaction history | transactions |
| FN008 | view_any_transactions | View any user's transaction history | transactions |
| FN009 | request_refunds | Request refunds for orders | refunds |
| FN010 | process_refunds | Process refund requests | refunds |
| FN011 | view_revenue_reports | View platform revenue reports | reports |
| FN012 | view_sales_reports | View platform sales reports | reports |

### Communication Permissions

| Permission ID | Name | Description | Resource |
|--------------|------|-------------|----------|
| CM001 | send_messages | Send messages to other users | messages |
| CM002 | receive_messages | Receive messages from other users | messages |
| CM003 | view_any_messages | View any user's messages | messages |
| CM004 | leave_reviews | Leave reviews for listings/users | reviews |
| CM005 | reply_to_reviews | Reply to reviews on own listings | reviews |
| CM006 | delete_own_reviews | Delete own reviews | reviews |
| CM007 | delete_any_reviews | Delete any review in the system | reviews |
| CM008 | view_notifications | View system notifications | notifications |
| CM009 | send_announcements | Send platform announcements | announcements |
| CM010 | send_email_campaigns | Send email marketing campaigns | campaigns |
| CM011 | send_sms_campaigns | Send SMS marketing campaigns | campaigns |
| CM012 | send_push_notifications | Send push notifications | notifications |

### Store Permissions

| Permission ID | Name | Description | Resource |
|--------------|------|-------------|----------|
| ST001 | create_store | Create a new store | stores |
| ST002 | edit_own_store | Edit own store information | stores |
| ST003 | delete_own_store | Delete own store | stores |
| ST004 | edit_any_store | Edit any store in the system | stores |
| ST005 | delete_any_store | Delete any store in the system | stores |
| ST006 | view_store_analytics | View store performance analytics | stores |
| ST007 | view_any_store_analytics | View any store's analytics | stores |
| ST008 | manage_store_followers | Manage store followers | stores |

### Moderation Permissions

| Permission ID | Name | Description | Resource |
|--------------|------|-------------|----------|
| MO001 | approve_listings | Approve pending listings | listings |
| MO002 | reject_listings | Reject pending listings | listings |
| MO003 | suspend_listings | Suspend active listings | listings |
| MO004 | approve_stores | Approve pending stores | stores |
| MO005 | reject_stores | Reject pending stores | stores |
| MO006 | suspend_stores | Suspend active stores | stores |
| MO007 | approve_kyc | Approve KYC verification requests | kyc |
| MO008 | reject_kyc | Reject KYC verification requests | kyc |
| MO009 | suspend_users | Suspend user accounts | users |
| MO010 | view_reports | View user reports | reports |
| MO011 | resolve_disputes | Resolve user disputes | disputes |
| MO012 | handle_support_tickets | Handle support tickets | tickets |
| MO013 | view_moderation_logs | View moderation action logs | logs |

### Admin Permissions

| Permission ID | Name | Description | Resource |
|--------------|------|-------------|----------|
| AD001 | create_moderators | Create new moderator accounts | moderators |
| AD002 | edit_moderators | Edit moderator accounts | moderators |
| AD003 | suspend_moderators | Suspend moderator accounts | moderators |
| AD004 | delete_moderators | Delete moderator accounts | moderators |
| AD005 | assign_permissions | Assign permissions to moderators | permissions |
| AD006 | remove_permissions | Remove permissions from moderators | permissions |
| AD007 | view_audit_logs | View system audit logs | logs |
| AD008 | configure_platform | Configure platform settings | settings |
| AD009 | manage_homepage | Manage homepage content | homepage |
| AD010 | manage_categories | Manage marketplace categories | categories |
| AD011 | manage_locations | Manage geographic locations | locations |
| AD012 | manage_currencies | Manage supported currencies | currencies |
| AD013 | manage_languages | Manage supported languages | languages |
| AD014 | create_coupons | Create discount coupons | coupons |
| AD015 | create_promotions | Create promotional campaigns | promotions |
| AD016 | manage_subscriptions | Manage subscription plans | subscriptions |
| AD017 | export_reports | Export system reports | reports |
| AD018 | view_business_settings | View business settings | settings |
| AD019 | edit_business_settings | Edit business settings | settings |
| AD020 | view_platform_settings | View platform settings | settings |
| AD021 | edit_platform_settings | Edit platform settings | settings |

---

## Role-Permission Matrix

### Guest Role (Level 0)

| Category | Permissions |
|----------|-------------|
| Marketplace | MP001, MP002, MP003 |
| Financial | - |
| Communication | - |
| Store | - |
| Moderation | - |
| Admin | - |

**Total**: 3 permissions

### User Role (Level 1)

| Category | Permissions |
|----------|-------------|
| Marketplace | MP001, MP002, MP003, MP004, MP005, MP006, MP009, MP010, MP011, MP012, MP013 |
| Financial | FN001, FN002, FN003, FN005, FN007, FN009 |
| Communication | CM001, CM002, CM004, CM005, CM006, CM008 |
| Store | ST001, ST002, ST003, ST006, ST008 |
| Moderation | - |
| Admin | - |

**Total**: 27 permissions

### Moderator Role (Level 2)

| Category | Permissions |
|----------|-------------|
| Marketplace | MP001, MP002, MP003 |
| Financial | - |
| Communication | CM008, CM009 |
| Store | - |
| Moderation | MO001, MO002, MO003, MO004, MO005, MO006, MO007, MO008, MO009, MO010, MO011, MO012, MO013 |
| Admin | - |

**Total**: 16 permissions

### Super Admin Role (Level 3)

| Category | Permissions |
|----------|-------------|
| Marketplace | ALL (MP001-MP013) |
| Financial | ALL (FN001-FN012) |
| Communication | ALL (CM001-CM012) |
| Store | ALL (ST001-ST008) |
| Moderation | ALL (MO001-MO013) |
| Admin | ALL (AD001-AD021) |

**Total**: 67 permissions

---

## Permission Assignment Rules

### Automatic Assignment
- **Guest**: Automatically assigned to unauthenticated users
- **User**: Automatically assigned upon registration
- **Moderator**: Manually assigned by Super Admin
- **Super Admin**: Single account, created during system setup

### Manual Assignment
- **Moderator permissions**: Can be customized by Super Admin
  - Default: All moderation permissions (MO001-MO013)
  - Can be restricted to specific categories
  - Example: Content moderator (MO001-MO003 only)
  - Example: KYC moderator (MO007-MO008 only)

### Permission Inheritance
- **Guest**: No inheritance
- **User**: Inherits Guest permissions + User permissions
- **Moderator**: Inherits Guest permissions + Moderator permissions (NOT User permissions)
- **Super Admin**: Inherits ALL permissions

---

## Permission Validation Flow

### Frontend Validation

```typescript
// Permission check hook
function usePermission(permission: string): boolean {
  const { session } = useAuth();
  const role = session?.role;
  
  const rolePermissions = PERMISSIONS_BY_ROLE[role];
  return rolePermissions.includes(permission);
}

// Usage in component
function DeleteListingButton({ listingId }) {
  const canDelete = usePermission('delete_own_listings');
  const isOwner = useIsOwner(listingId);
  
  if (!canDelete || !isOwner) {
    return null; // Don't render button
  }
  
  return <Button>Delete Listing</Button>;
}
```

### Backend Validation

```python
# Permission decorator
def require_permission(permission: str):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            token = get_token_from_request()
            user = await verify_token(token)
            
            if not has_permission(user, permission):
                raise HTTPException(status_code=403, detail="Permission denied")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Usage in endpoint
@router.delete("/listings/{id}")
@require_permission("delete_own_listings")
async def delete_listing(id: str, current_user: User):
    # Verify ownership
    listing = await get_listing(id)
    if listing.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    
    await delete_listing(id)
    return {"success": True}
```

---

## Permission Groups

### Content Moderator Group
**Permissions**: MO001, MO002, MO003, MO010
**Purpose**: Approve/reject listings and view reports

### KYC Moderator Group
**Permissions**: MO007, MO008
**Purpose**: Handle KYC verification

### Dispute Moderator Group
**Permissions**: MO011, MO012
**Purpose**: Resolve disputes and handle tickets

### Store Moderator Group
**Permissions**: MO004, MO005, MO006
**Purpose**: Approve/reject/suspend stores

### Full Moderator Group
**Permissions**: MO001-MO013
**Purpose**: All moderation capabilities

---

## Permission Audit Trail

### Audit Events

Every permission check is logged:

```typescript
interface PermissionAuditEvent {
  timestamp: string;
  userId: string;
  role: string;
  permission: string;
  resource: string;
  resourceId?: string;
  action: string;
  granted: boolean;
  ipAddress: string;
  userAgent: string;
}
```

### Audit Retention

- **Denied attempts**: 90 days
- **Granted actions**: 1 year
- **Admin actions**: Permanent
- **Super Admin actions**: Permanent

### Audit Reporting

Generate reports for:
- Permission denial trends
- Suspicious activity patterns
- Role-based access reviews
- Compliance audits

---

## Permission Caching Strategy

### Client-Side Caching

```typescript
// Cache user permissions in memory
const permissionCache = new Map<string, Set<string>>();

function getUserPermissions(userId: string): Set<string> {
  if (permissionCache.has(userId)) {
    return permissionCache.get(userId);
  }
  
  const permissions = fetchPermissionsFromAPI(userId);
  permissionCache.set(userId, permissions);
  
  // Cache for 15 minutes
  setTimeout(() => permissionCache.delete(userId), 15 * 60 * 1000);
  
  return permissions;
}
```

### Server-Side Caching

```python
# Redis cache for permissions
CACHE_TTL = 900  # 15 minutes

async def get_user_permissions(user_id: str) -> Set[str]:
    cache_key = f"permissions:{user_id}"
    
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    permissions = await fetch_permissions_from_db(user_id)
    await redis.setex(cache_key, CACHE_TTL, json.dumps(permissions))
    
    return permissions
```

### Cache Invalidation

- User role change → Invalidate cache
- Permission assignment change → Invalidate cache
- Manual cache clear → Admin action
- TTL expiration → Automatic invalidation

---

## Permission Testing

### Test Cases

```typescript
describe('Permission System', () => {
  test('Guest can view listings', () => {
    const guest = createGuestUser();
    expect(hasPermission(guest, 'view_listings')).toBe(true);
  });
  
  test('Guest cannot create listings', () => {
    const guest = createGuestUser();
    expect(hasPermission(guest, 'create_listings')).toBe(false);
  });
  
  test('User can edit own listings', () => {
    const user = createUser();
    expect(hasPermission(user, 'edit_own_listings')).toBe(true);
  });
  
  test('User cannot edit any listings', () => {
    const user = createUser();
    expect(hasPermission(user, 'edit_any_listings')).toBe(false);
  });
  
  test('Moderator can approve listings', () => {
    const moderator = createModerator();
    expect(hasPermission(moderator, 'approve_listings')).toBe(true);
  });
  
  test('Moderator cannot view financial data', () => {
    const moderator = createModerator();
    expect(hasPermission(moderator, 'view_any_wallet_balance')).toBe(false);
  });
  
  test('Super Admin has all permissions', () => {
    const admin = createSuperAdmin();
    ALL_PERMISSIONS.forEach(perm => {
      expect(hasPermission(admin, perm)).toBe(true);
    });
  });
});
```

---

## Permission Migration

### Legacy Role Migration

```typescript
// Map legacy roles to new permission sets
function migrateLegacyRole(legacyRole: string): string[] {
  const migrationMap = {
    'buyer': USER_PERMISSIONS.filter(p => p.startsWith('MP') || p.startsWith('CM')),
    'seller': USER_PERMISSIONS.filter(p => p.startsWith('MP') || p.startsWith('ST') || p.startsWith('FN')),
    'agent': USER_PERMISSIONS,
    'enterprise_admin': SUPER_ADMIN_PERMISSIONS,
    'branch_manager': MODERATOR_PERMISSIONS,
    'business_owner': USER_PERMISSIONS,
  };
  
  return migrationMap[legacyRole] || USER_PERMISSIONS;
}
```

### Data Migration Script

```python
async def migrate_user_permissions():
    users = await db.users.find_all()
    
    for user in users:
        legacy_roles = user.raw_roles
        new_permissions = []
        
        for role in legacy_roles:
            new_permissions.extend(migrate_legacy_role(role))
        
        # Remove duplicates
        new_permissions = list(set(new_permissions))
        
        # Update user permissions
        await db.user_permissions.update(
            user_id=user.id,
            permissions=new_permissions
        )
```

---

## Permission UI Components

### Permission Guard Component

```typescript
function PermissionGuard({ 
  permission, 
  fallback = null, 
  children 
}: PermissionGuardProps) {
  const hasPermission = usePermission(permission);
  
  if (!hasPermission) {
    return fallback;
  }
  
  return <>{children}</>;
}

// Usage
<PermissionGuard permission="delete_own_listings" fallback={<AccessDenied />}>
  <DeleteButton />
</PermissionGuard>
```

### Permission Badge Component

```typescript
function PermissionBadge({ permission }: { permission: string }) {
  const hasPermission = usePermission(permission);
  
  return (
    <Badge variant={hasPermission ? 'success' : 'error'}>
      {hasPermission ? 'Granted' : 'Denied'}
    </Badge>
  );
}
```

---

## Permission API Responses

### Check Permission Response

```json
{
  "has_permission": true,
  "permission": "create_listings",
  "granted_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-01-15T10:45:00Z"
}
```

### User Permissions Response

```json
{
  "user_id": "uuid-123",
  "role": "user",
  "permissions": [
    "view_listings",
    "create_listings",
    "edit_own_listings",
    "delete_own_listings"
  ],
  "total_permissions": 27,
  "cached_at": "2024-01-15T10:30:00Z"
}
```

### Permission Assignment Response

```json
{
  "success": true,
  "user_id": "uuid-456",
  "permission": "approve_listings",
  "granted_by": "uuid-789",
  "granted_at": "2024-01-15T10:30:00Z"
}
```
