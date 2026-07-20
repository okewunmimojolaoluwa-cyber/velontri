'use client';

const ACCESS_KEY  = 'velontri_access';
const REFRESH_KEY = 'velontri_refresh';

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
  setCookie(ACCESS_KEY, access, 8 * 60 * 60); // 8 hours — matches backend ACCESS_TOKEN_TTL
  if (refresh) setCookie(REFRESH_KEY, refresh, 7 * 24 * 3600);
}

export function clearTokens(): void {
  if (typeof document === 'undefined') return;
  deleteCookie(ACCESS_KEY);
  deleteCookie(REFRESH_KEY);
}

// ── Cookie helpers ─────────────────────────────────────────────────────────

function getCookie(name: string): string | null {
  const m = document.cookie.match(`(?:^|;)\\s*${name}=([^;]*)`);
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0`;
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
