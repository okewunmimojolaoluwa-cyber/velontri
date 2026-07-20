import type { VelontriTokenPayload, AuthSession, VelontriRole } from '@/types/auth';
import { normaliseRole } from '@/types/auth';

export function parseJwtPayload(token: string): VelontriTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    return JSON.parse(atob(base64)) as VelontriTokenPayload;
  } catch { return null; }
}

export function isTokenExpired(p: VelontriTokenPayload): boolean {
  return Math.floor(Date.now() / 1000) >= p.exp;
}

export function isTokenExpiringSoon(p: VelontriTokenPayload, bufferSec = 120): boolean {
  return Math.floor(Date.now() / 1000) >= p.exp - bufferSec;
}

/** Resolve the single effective role from raw JWT roles array */
function resolveRole(rawRoles: string[]): VelontriRole {
  if (!rawRoles?.length) return 'user';
  // Priority order: super_admin > moderator > user
  for (const r of rawRoles) {
    const norm = normaliseRole(r);
    if (norm === 'super_admin') return 'super_admin';
  }
  for (const r of rawRoles) {
    const norm = normaliseRole(r);
    if (norm === 'moderator') return 'moderator';
  }
  return 'user';
}

export function payloadToSession(payload: VelontriTokenPayload): AuthSession {
  const rawRoles = payload.roles ?? [];
  return {
    userId:           payload.sub,
    role:             resolveRole(rawRoles),
    rawRoles,
    subscriptionTier: payload.subscription_tier ?? 'starter',
    branchIds:        payload.branch_ids ?? [],
    countryCode:      payload.country_code ?? 'NG',
    isAuthenticated:  true,
  };
}
