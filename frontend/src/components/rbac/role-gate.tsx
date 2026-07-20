'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-provider';

interface RoleGateProps {
  /** Roles allowed to see children (accepts both 'roles' and 'allowedRoles' for compatibility) */
  allowedRoles?: string[];
  /** Alias for allowedRoles — used in legacy pages */
  roles?: string[];
  children: ReactNode;
  /** Optional fallback rendered when access is denied */
  fallback?: ReactNode;
}

/**
 * RoleGate – renders children only when the authenticated user has
 * at least one of the allowedRoles / roles. Falls back to null (or fallback prop).
 */
export function RoleGate({ allowedRoles, roles, children, fallback = null }: RoleGateProps) {
  const { session } = useAuth();

  // Accept both prop names
  const required = allowedRoles ?? roles ?? [];

  // If no roles specified, render children for any authenticated user
  if (required.length === 0) {
    return session.isAuthenticated ? <>{children}</> : <>{fallback}</>;
  }

  const userRoles: string[] =
    Array.isArray(session.rawRoles) && session.rawRoles.length > 0
      ? session.rawRoles
      : session.role ? [session.role] : [];

  const hasAccess =
    session.isAuthenticated &&
    userRoles.some((r) => required.includes(r));

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
