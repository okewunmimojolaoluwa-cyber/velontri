/** ──────────────────────────────────────────────
 *  Velontri Role System (4 roles only)
 *  ─────────────────────────────────────────────
 *  guest       → unauthenticated / public browsing
 *  user        → registered account (buyer + seller unified)
 *  moderator   → internal staff, created by super_admin
 *  super_admin → business owner, full platform control
 */
export type VelontriRole = 'guest' | 'user' | 'moderator' | 'super_admin';

/** Legacy role values still stored in the DB — mapped to new roles */
export type LegacyRole =
  | 'buyer' | 'seller' | 'agent'
  | 'branch_manager' | 'business_owner'
  | 'enterprise_admin' | 'ops' | 'moderator';

/** Map legacy DB roles → new 4-role system */
export function normaliseRole(legacy: LegacyRole | string): VelontriRole {
  switch (legacy) {
    case 'enterprise_admin':
    case 'super_admin':
      return 'super_admin';
    case 'ops':
    case 'moderator':
    case 'branch_manager':   // branch_manager → moderator in new system
      return 'moderator';
    case 'buyer':
    case 'seller':
    case 'agent':
    case 'business_owner':
      return 'user';
    default:
      return 'user';
  }
}

export type SubscriptionTier = 'starter' | 'basic' | 'professional' | 'enterprise';

export interface VelontriTokenPayload {
  sub: string;
  roles: string[];
  subscription_tier: SubscriptionTier;
  branch_ids: string[];
  country_code: string;
  exp: number;
  iat: number;
}

export interface AuthSession {
  userId: string;
  role: VelontriRole;           // single normalised role
  rawRoles: string[];           // original JWT roles array
  subscriptionTier: SubscriptionTier;
  branchIds: string[];
  countryCode: string;
  isAuthenticated: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  device_fingerprint?: string;
  user_agent?: string;
}

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  full_name: string;
  country_code: string;
}

export interface RegisterResponse {
  user_id: string;
  email?: string;
  message?: string;
}

export interface LoginResponse {
  tokens: AuthTokens | null;
  requires_2fa: boolean;
  two_fa_session_id: string | null;
  message: string;
}
