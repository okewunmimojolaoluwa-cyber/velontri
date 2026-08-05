'use client';

const ACCESS_KEY  = 'velontri_access';
const REFRESH_KEY = 'velontri_refresh';

const ACCESS_MAX_AGE  = 8 * 60 * 60;         // 8 hours — matches backend
const REFRESH_MAX_AGE = 365 * 24 * 60 * 60;  // 1 year — permanent session

export function getAccessToken(): string | null {
  if (typeof document === 'undefined') return null;
  return getCookie(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof document === 'undefined') return null;
  return getCookie(REFRESH_KEY);
}

export function setTokens(access: string, refresh?: string): void {
  if (typeof document === 'undefined') return;
  setCookie(ACCESS_KEY, access, ACCESS_MAX_AGE);
  if (refresh) setCookie(REFRESH_KEY, refresh, REFRESH_MAX_AGE);
}

export function clearTokens(): void {
  if (typeof document === 'undefined') return;
  deleteCookie(ACCESS_KEY);
  deleteCookie(REFRESH_KEY);
}

/** Returns seconds until the access token expires, or 0 if expired/missing. */
function accessTokenExpiresIn(): number {
  const token = getAccessToken();
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const remaining = payload.exp - Math.floor(Date.now() / 1000);
    return Math.max(0, remaining);
  } catch {
    return 0;
  }
}

// ── Cookie helpers ─────────────────────────────────────────────────────────

function getCookie(name: string): string | null {
  const m = document.cookie.match(`(?:^|;)\\s*${name}=([^;]*)`);
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
  const secure = isHttps ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
  const secure = isHttps ? '; Secure' : '';
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

// ── Single-flight refresh ──────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

export async function refreshTokenSingleFlight(
  apiUrl: string,
): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const rt = getRefreshToken();
  if (!rt) return null;

  refreshPromise = fetch(`${apiUrl}/auth/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: rt }),
  })
    .then(async (r) => {
      if (!r.ok) { clearTokens(); return null; }
      const body = await r.json();
      const tokens = body?.data;
      if (tokens?.access_token) {
        setTokens(tokens.access_token, tokens.refresh_token);
        return tokens.access_token as string;
      }
      clearTokens();
      return null;
    })
    .catch(() => { clearTokens(); return null; })
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
}

/**
 * Proactively refresh the access token if it expires within 30 minutes.
 * Call this on app mount so users are never surprised by mid-session expiry.
 */
export async function proactiveRefresh(apiUrl: string): Promise<void> {
  const remaining = accessTokenExpiresIn();
  // Refresh if access token is missing OR expires within 30 minutes
  if (remaining < 30 * 60) {
    await refreshTokenSingleFlight(apiUrl);
  }
}
