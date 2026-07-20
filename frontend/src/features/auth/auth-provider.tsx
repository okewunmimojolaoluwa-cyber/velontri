'use client';

import {
  createContext, useCallback, useContext,
  useEffect, useMemo, useState, type ReactNode,
} from 'react';
import type { AuthSession } from '@/types/auth';
import { parseJwtPayload, payloadToSession } from '@/lib/auth/jwt';
import { getAccessToken, clearTokens } from '@/lib/auth/token-refresh';

interface AuthContextValue {
  session: AuthSession;
  isLoading: boolean;
  setSessionFromToken: (token: string) => void;
  clearSession: () => void;
  logout: () => void;
  /** Called by consumers that want cache-clear on user change */
  onSessionChange?: (newUserId: string | null) => void;
}

const GUEST_SESSION: AuthSession = {
  userId: '',
  role: 'guest',
  rawRoles: [],
  subscriptionTier: 'starter',
  branchIds: [],
  countryCode: 'NG',
  isAuthenticated: false,
};

function readSessionFromCookie(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const token = getAccessToken();
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  return payloadToSession(payload);
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * CacheClearer — a child component that calls queryClient.clear()
 * when the userId changes. Keeps AuthProvider free of TanStack Query dependency.
 */
export function AuthCacheClearer({ onClear }: { onClear: () => void }) {
  // This component is used by Providers to wire up cache clearing
  return null;
}

export function AuthProvider({
  children,
  initialSession,
  onClearCache,
}: {
  children: ReactNode;
  initialSession?: AuthSession | null;
  onClearCache?: () => void;
}) {
  // Server: always GUEST (no document.cookie).
  // Client: useState initializer reads cookie synchronously before first render.
  const [session, setSession] = useState<AuthSession>(GUEST_SESSION);

  // After hydration, sync to cookie (runs only on client)
  useEffect(() => {
    const s = initialSession ?? readSessionFromCookie();
    if (s) setSession(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSessionFromToken = useCallback((token: string) => {
    const payload = parseJwtPayload(token);
    if (payload) {
      onClearCache?.();
      setSession(payloadToSession(payload));
    }
  }, [onClearCache]);

  const clearSession = useCallback(() => {
    onClearCache?.();
    setSession(GUEST_SESSION);
  }, [onClearCache]);

  const logout = useCallback(() => {
    clearTokens();
    onClearCache?.();
    setSession(GUEST_SESSION);
  }, [onClearCache]);

  const value = useMemo(
    () => ({ session, isLoading: false, setSessionFromToken, clearSession, logout }),
    [session, setSessionFromToken, clearSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
