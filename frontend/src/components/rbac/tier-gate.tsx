'use client';

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import type { TierFeature } from '@/lib/rbac/permissions';

interface TierGateProps {
  feature: TierFeature;
  children: ReactNode;
  fallback?: ReactNode;
}

export function TierGate({ feature, children, fallback = null }: TierGateProps) {
  const { hasTierFeature } = usePermissions();
  return hasTierFeature(feature) ? <>{children}</> : <>{fallback}</>;
}
