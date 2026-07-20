'use client';

import { useAuth } from '@/features/auth/auth-provider';
import { hasPermission } from '@/lib/rbac/permissions';
import type { Permission, VelontriRole } from '@/types/auth';

export function usePermissions() {
  const { session } = useAuth();
  const role = session.role ?? 'guest';

  return {
    role,
    isAuthenticated: session.isAuthenticated,
    isUser: role === 'user',
    isModerator: role === 'moderator',
    isSuperAdmin: role === 'super_admin',
    isGuest: !session.isAuthenticated,
    can: (permission: Permission): boolean => hasPermission(role, permission),
    hasRole: (r: VelontriRole | VelontriRole[]): boolean =>
      Array.isArray(r) ? r.includes(role) : role === r,
  };
}
