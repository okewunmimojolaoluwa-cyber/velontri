'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/api/query-client';
import { AuthProvider } from '@/features/auth/auth-provider';
import type { AuthSession } from '@/types/auth';

export function Providers({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: AuthSession | null;
}) {
  const [queryClient] = useState(() => createQueryClient());

  // Wire cache clearing to auth changes — keeps AuthProvider free of TanStack dep
  const handleClearCache = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialSession={initialSession} onClearCache={handleClearCache}>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
