'use client';

import {
 createContext, useCallback, useContext,
 useEffect, useMemo, useState, type ReactNode,
} from 'react';
import type { AuthSession } from '@/types/auth';
import { parseJwtPayload, payloadToSession } from '@/lib/auth/jwt';
import { getAccessToken, getRefreshToken, clearTokens, refreshTokenSingleFlight, proactiveRefresh } from '@/lib/auth/token-refresh';
import { siteConfig } from '@/config/site';

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
  // Synchronously initialize state on client if cookie exists
 const [session, setSession] = useState<AuthSession>(() => {
 if (initialSession) return initialSession;
 return readSessionFromCookie() ?? GUEST_SESSION;
 });

 const [isLoading, setIsLoading] = useState<boolean>(() => {
 if (initialSession) return false;
 const s = readSessionFromCookie();
 return !s; // If valid cookie exists immediately, not loading. If missing, loading while checking refresh token.
 });

 useEffect(() => {
 let active = true;
 async function initAuth() {
      // Try to use existing access token first
 const s = initialSession ?? readSessionFromCookie();
 if (s) {
 if (active) {
 setSession(s);
 setIsLoading(false);
 }
        // Proactively refresh in the background if access token is near expiry
        // This ensures the user stays logged in without any visible interruption
 proactiveRefresh(siteConfig.apiUrl).then(() => {
 if (!active) return;
 const refreshed = readSessionFromCookie();
 if (refreshed) setSession(refreshed);
 }).catch(() => {});
 return;
 }

      // No valid access token — try silent refresh using the 1-year refresh token
 const rt = getRefreshToken();
 if (rt) {
 try {
 const newAccess = await refreshTokenSingleFlight(siteConfig.apiUrl);
 if (newAccess) {
 const freshSession = readSessionFromCookie();
 if (freshSession && active) {
 setSession(freshSession);
 setIsLoading(false);
 return;
 }
 }
 } catch (_) {}
 }

 if (active) {
 setSession(GUEST_SESSION);
 setIsLoading(false);
 }
 }

 initAuth();
 return () => { active = false; };
 }, [initialSession]);

 const setSessionFromToken = useCallback((token: string) => {
 const payload = parseJwtPayload(token);
 if (payload) {
 onClearCache?.();
 setSession(payloadToSession(payload));
 setIsLoading(false);
 }
 }, [onClearCache]);

 const clearSession = useCallback(() => {
 onClearCache?.();
 setSession(GUEST_SESSION);
 setIsLoading(false);
 }, [onClearCache]);

 const logout = useCallback(() => {
 clearTokens();
 onClearCache?.();
 setSession(GUEST_SESSION);
 setIsLoading(false);
 }, [onClearCache]);

 const value = useMemo(
 () => ({ session, isLoading, setSessionFromToken, clearSession, logout }),
 [session, isLoading, setSessionFromToken, clearSession, logout],
 );

 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
 const ctx = useContext(AuthContext);
 if (!ctx) throw new Error('useAuth must be used within AuthProvider');
 return ctx;
}
