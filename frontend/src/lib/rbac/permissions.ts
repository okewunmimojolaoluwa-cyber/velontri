import type { VelontriRole, SubscriptionTier } from '@/types/auth';

export type Permission =
  // Marketplace
  | 'listings:read'
  | 'listings:create'
  | 'listings:edit:own'
  | 'listings:edit:any'
  | 'listings:delete:own'
  | 'listings:delete:any'
  | 'listings:promote'
  | 'listings:moderate'
  | 'listings:approve'
  | 'listings:reject'
  | 'listings:suspend'
  // Financial
  | 'wallet:read:own'
  | 'wallet:read:any'
  | 'wallet:add:own'
  | 'wallet:add:any'
  | 'wallet:withdraw:own'
  | 'wallet:withdraw:any'
  | 'escrow:read:own'
  | 'escrow:read:any'
  | 'transactions:read:own'
  | 'transactions:read:any'
  | 'refunds:request'
  | 'refunds:process'
  | 'revenue:read'
  | 'sales:read'
  // Communication
  | 'messages:send'
  | 'messages:receive'
  | 'messages:read:any'
  | 'reviews:create'
  | 'reviews:reply:own'
  | 'reviews:reply:any'
  | 'reviews:delete:own'
  | 'reviews:delete:any'
  | 'notifications:read'
  | 'announcements:create'
  | 'campaigns:email'
  | 'campaigns:sms'
  | 'campaigns:push'
  // Store
  | 'store:create'
  | 'store:edit:own'
  | 'store:edit:any'
  | 'store:delete:own'
  | 'store:delete:any'
  | 'store:analytics:own'
  | 'store:analytics:any'
  | 'store:followers:manage:own'
  | 'store:followers:manage:any'
  // Moderation
  | 'moderation:approve_listings'
  | 'moderation:reject_listings'
  | 'moderation:suspend_listings'
  | 'moderation:approve_stores'
  | 'moderation:reject_stores'
  | 'moderation:suspend_stores'
  | 'moderation:approve_kyc'
  | 'moderation:reject_kyc'
  | 'moderation:suspend_users'
  | 'moderation:view_reports'
  | 'moderation:resolve_disputes'
  | 'moderation:handle_tickets'
  | 'moderation:view_logs'
  // Admin
  | 'admin:create_moderators'
  | 'admin:edit_moderators'
  | 'admin:suspend_moderators'
  | 'admin:delete_moderators'
  | 'admin:assign_permissions'
  | 'admin:remove_permissions'
  | 'admin:view_audit_logs'
  | 'admin:configure_platform'
  | 'admin:manage_homepage'
  | 'admin:manage_categories'
  | 'admin:manage_locations'
  | 'admin:manage_currencies'
  | 'admin:manage_languages'
  | 'admin:create_coupons'
  | 'admin:create_promotions'
  | 'admin:manage_subscriptions'
  | 'admin:export_reports'
  | 'admin:view_business_settings'
  | 'admin:edit_business_settings'
  | 'admin:view_platform_settings'
  | 'admin:edit_platform_settings';

export const ROLE_PERMISSIONS: Record<VelontriRole, Permission[]> = {
  guest: [
    'listings:read',
  ],
  user: [
    // Marketplace
    'listings:read',
    'listings:create',
    'listings:edit:own',
    'listings:delete:own',
    'listings:promote',
    // Financial
    'wallet:read:own',
    'wallet:add:own',
    'wallet:withdraw:own',
    'escrow:read:own',
    'transactions:read:own',
    'refunds:request',
    // Communication
    'messages:send',
    'messages:receive',
    'reviews:create',
    'reviews:reply:own',
    'reviews:delete:own',
    'notifications:read',
    // Store
    'store:create',
    'store:edit:own',
    'store:delete:own',
    'store:analytics:own',
    'store:followers:manage:own',
  ],
  moderator: [
    // Marketplace (read-only for review)
    'listings:read',
    'listings:moderate',
    'listings:approve',
    'listings:reject',
    'listings:suspend',
    // Store moderation
    'store:read',
    'moderation:approve_stores',
    'moderation:reject_stores',
    'moderation:suspend_stores',
    // KYC
    'moderation:approve_kyc',
    'moderation:reject_kyc',
    // User moderation
    'moderation:suspend_users',
    // Reports & disputes
    'moderation:view_reports',
    'moderation:resolve_disputes',
    'moderation:handle_tickets',
    // Communication
    'notifications:read',
    'announcements:create',
    // Logs
    'moderation:view_logs',
  ],
  super_admin: [
    // All user permissions
    'listings:read',
    'listings:create',
    'listings:edit:own',
    'listings:edit:any',
    'listings:delete:own',
    'listings:delete:any',
    'listings:promote',
    'listings:moderate',
    'listings:approve',
    'listings:reject',
    'listings:suspend',
    'wallet:read:own',
    'wallet:read:any',
    'wallet:add:own',
    'wallet:add:any',
    'wallet:withdraw:own',
    'wallet:withdraw:any',
    'escrow:read:own',
    'escrow:read:any',
    'transactions:read:own',
    'transactions:read:any',
    'refunds:request',
    'refunds:process',
    'revenue:read',
    'sales:read',
    'messages:send',
    'messages:receive',
    'messages:read:any',
    'reviews:create',
    'reviews:reply:own',
    'reviews:reply:any',
    'reviews:delete:own',
    'reviews:delete:any',
    'notifications:read',
    'announcements:create',
    'store:create',
    'store:edit:own',
    'store:edit:any',
    'store:delete:own',
    'store:delete:any',
    'store:analytics:own',
    'store:analytics:any',
    'store:followers:manage:own',
    'store:followers:manage:any',
    // All moderator permissions
    'moderation:approve_listings',
    'moderation:reject_listings',
    'moderation:suspend_listings',
    'moderation:approve_stores',
    'moderation:reject_stores',
    'moderation:suspend_stores',
    'moderation:approve_kyc',
    'moderation:reject_kyc',
    'moderation:suspend_users',
    'moderation:view_reports',
    'moderation:resolve_disputes',
    'moderation:handle_tickets',
    'moderation:view_logs',
    // Admin-only permissions
    'admin:create_moderators',
    'admin:edit_moderators',
    'admin:suspend_moderators',
    'admin:delete_moderators',
    'admin:assign_permissions',
    'admin:remove_permissions',
    'admin:view_audit_logs',
    'admin:configure_platform',
    'admin:manage_homepage',
    'admin:manage_categories',
    'admin:manage_locations',
    'admin:manage_currencies',
    'admin:manage_languages',
    'admin:create_coupons',
    'admin:create_promotions',
    'admin:manage_subscriptions',
    'admin:export_reports',
    'admin:view_business_settings',
    'admin:edit_business_settings',
    'admin:view_platform_settings',
    'admin:edit_platform_settings',
    'campaigns:email',
    'campaigns:sms',
    'campaigns:push',
  ],
};

export function hasPermission(
  role: VelontriRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyRole(
  currentRole: VelontriRole,
  required: VelontriRole[],
): boolean {
  return required.includes(currentRole);
}

export function canCreateListing(role: VelontriRole): boolean {
  return hasPermission(role, 'listings:create');
}

export function canModerate(role: VelontriRole): boolean {
  return role === 'moderator' || role === 'super_admin';
}

export function isAdmin(role: VelontriRole): boolean {
  return role === 'super_admin';
}

export type TierFeature =
  | 'store_page'
  | 'analytics_basic'
  | 'analytics_full'
  | 'analytics_export'
  | 'ai_search'
  | 'ai_bi'
  | 'crm'
  | 'multi_branch'
  | 'featured_listing'
  | 'api_access';

const TIER_FEATURES: Record<SubscriptionTier, TierFeature[]> = {
  starter: [],
  basic: ['store_page', 'analytics_basic'],
  professional: [
    'store_page',
    'analytics_basic',
    'analytics_full',
    'ai_search',
    'crm',
    'featured_listing',
  ],
  enterprise: [
    'store_page',
    'analytics_basic',
    'analytics_full',
    'analytics_export',
    'ai_search',
    'ai_bi',
    'crm',
    'multi_branch',
    'featured_listing',
    'api_access',
  ],
};

export function hasTierFeature(
  tier: SubscriptionTier,
  feature: TierFeature,
): boolean {
  return TIER_FEATURES[tier]?.includes(feature) ?? false;
}

export const LISTING_QUOTA: Record<SubscriptionTier, number | null> = {
  starter: 3,
  basic: 10,
  professional: 50,
  enterprise: null,
};
