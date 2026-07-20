/**
 * middleware.ts — Next.js Edge Middleware for Velontri auth protection.
 *
 * Place this file at the ROOT of your Next.js app (not inside /app or /pages).
 * It runs on the Edge runtime — no Node.js APIs, no filesystem access.
 *
 * Features:
 * - Protects route patterns with JWT payload inspection (no signature verify in Edge)
 * - Silently refreshes access token via /api/v1/auth/token/refresh
 * - Redirects unauthenticated users to /login
 * - Forwards user id / roles / tier to pages via request headers
 *
 * Installation:
 *   cp frontend/middleware.ts ./middleware.ts   (if starting a new Next.js app)
 *   npm install next@14 react react-dom
 *   npm install -D @types/node @types/react typescript
 */

import type { NextRequest } from 'next/server';
import { NextResponse }     from 'next/server';

// ---------------------------------------------------------------------------
// Configuration — adjust these to match your app's route structure
// ---------------------------------------------------------------------------

/** Routes that REQUIRE a valid session. */
const PROTECTED: RegExp[] = [
  /^\/dashboard(\/.*)?$/,
  /^\/mod(\/.*)?$/,
  /^\/admin(\/.*)?$/,
  /^\/buyer(\/.*)?$/,
  /^\/seller(\/.*)?$/,
  /^\/agent(\/.*)?$/,
  /^\/branch(\/.*)?$/,
  /^\/business(\/.*)?$/,
  /^\/listings\/create(\/.*)?$/,
  /^\/listings\/[^/]+\/edit(\/.*)?$/,
  /^\/listings\/[^/]+\/(apply|book)(\/.*)?$/,
  /^\/wallet(\/.*)?$/,
  /^\/messages(\/.*)?$/,
  /^\/profile(\/.*)?$/,
  /^\/settings(\/.*)?$/,
  /^\/analytics(\/.*)?$/,
  /^\/inventory(\/.*)?$/,
  /^\/crm(\/.*)?$/,
  /^\/orders(\/.*)?$/,
  /^\/checkout(\/.*)?$/,
  /^\/payments\/[^/]+(\/.*)?$/,
  /^\/ai\/bi(\/.*)?$/,
  /^\/auth\/2fa(\/.*)?$/,
];

/** Routes only accessible when NOT authenticated — redirect to /dashboard if logged in. */
const AUTH_ONLY: RegExp[] = [
  /^\/login$/,
  /^\/register$/,
  /^\/forgot-password$/,
  /^\/reset-password(\/.*)?$/,
  /^\/verify-phone$/,
];

/** Routes that are always public — pass through with zero processing. */
const PUBLIC: RegExp[] = [
  /^\/_next\//,
  /^\/api\//,
  /^\/favicon/,
  /^\/static\//,
  /^\/images\//,
  /^\/$/, // home page
  /^\/listings(\/products|\/services|\/jobs|\/property|\/vehicles)?$/,
  /^\/listings\/[^/]+$/,
  /^\/search(\/.*)?$/,
  /^\/stores(\/[^/]+)?$/,
  /^\/about$/,
  /^\/contact$/,
  /^\/terms$/,
  /^\/privacy$/,
  /^\/subscriptions\/tiers$/,
  /^\/logistics\/track(\/.*)?$/,
  /^\/ai\/assistant$/,
  /^\/payment(\/.*)?$/,   // Paystack callback — must stay public
  /^\/plans$/,            // Public pricing page
];

// ---------------------------------------------------------------------------
// Environment — Edge-safe (no process.env with non-string literals)
// ---------------------------------------------------------------------------

/**
 * The Velontri API base URL.
 * Set NEXT_PUBLIC_API_URL in your .env.local / Vercel environment variables.
 * Default: https://api.velontri.com/api/v1
 */
declare const process: { env: Record<string, string | undefined>; readonly [k: string]: unknown };

function getApiBase(): string {
  // NEXT_PUBLIC_* env vars are inlined at build time — safe in Edge
  const envVal: string | undefined =
    typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_API_URL'] : undefined;
  return envVal ?? 'http://localhost:8000/api/v1';
}

function isProduction(): boolean {
  const envVal: string | undefined =
    typeof process !== 'undefined' ? process.env['NODE_ENV'] : undefined;
  return envVal === 'production';
}

// ---------------------------------------------------------------------------
// JWT utilities — Edge-compatible (no crypto, no fs, no Node APIs)
// JWT signature is NOT verified here — that is the API gateway's job.
// We only read the payload to check expiry and extract claims.
// ---------------------------------------------------------------------------

interface JwtPayload {
  sub: string;
  exp: number;
  iat: number;
  roles: string[];
  subscription_tier: string;
  branch_ids: string[];
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;

    // Restore base64 padding and replace URL-safe chars
    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');

    // atob is available in Edge runtime (and all modern browsers)
    const decoded = atob(base64);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

function isExpired(payload: JwtPayload): boolean {
  return Math.floor(Date.now() / 1000) >= payload.exp;
}

/** Return true when token expires within the next 5 minutes. */
function isExpiringSoon(payload: JwtPayload): boolean {
  return Math.floor(Date.now() / 1000) >= payload.exp - 300;
}

// ---------------------------------------------------------------------------
// Token refresh — calls the Velontri auth service from the Edge
// ---------------------------------------------------------------------------

interface RefreshedTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

async function tryRefreshToken(
  refreshToken: string,
): Promise<RefreshedTokens | null> {
  try {
    const res = await fetch(`${getApiBase()}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      // Edge fetch supports AbortSignal
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) return null;

    const body = (await res.json()) as {
      success: boolean;
      data?: RefreshedTokens;
    };

    if (body.success && body.data?.access_token) {
      return body.data;
    }
    return null;
  } catch {
    // Network error or timeout — fail silently
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route matching helpers
// ---------------------------------------------------------------------------

function matches(path: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((re) => re.test(path));
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const COOKIE_ACCESS  = 'velontri_access';
const COOKIE_REFRESH = 'velontri_refresh';

function setCookies(
  response: NextResponse,
  access: string,
  refresh?: string,
): void {
  const prod = isProduction();

  response.cookies.set(COOKIE_ACCESS, access, {
    httpOnly: true,
    secure: prod,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60, // 8 hours — matches server-side ACCESS_TOKEN_TTL_SECONDS (dev)
    path: '/',
  });

  if (refresh) {
    response.cookies.set(COOKIE_REFRESH, refresh, {
      httpOnly: true,
      secure: prod,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days — matches REFRESH_TOKEN_TTL_DAYS
      path: '/',
    });
  }
}

function deleteCookies(response: NextResponse): void {
  response.cookies.delete(COOKIE_ACCESS);
  response.cookies.delete(COOKIE_REFRESH);
}

// ---------------------------------------------------------------------------
// Redirect helpers
// ---------------------------------------------------------------------------

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

function redirectToDashboard(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/dashboard', request.url));
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1. Static / always-public routes — pass through immediately
  if (matches(pathname, PUBLIC)) {
    return NextResponse.next();
  }

  const rawAccess  = request.cookies.get(COOKIE_ACCESS)?.value;
  const rawRefresh = request.cookies.get(COOKIE_REFRESH)?.value;

  const isProtectedRoute = matches(pathname, PROTECTED);
  const isAuthOnlyRoute  = matches(pathname, AUTH_ONLY);

  // 2. No tokens at all
  if (!rawAccess && !rawRefresh) {
    if (isProtectedRoute) return redirectToLogin(request, pathname);
    return NextResponse.next();
  }

  // 3. Parse access token payload (no signature verification in Edge)
  let payload    = rawAccess ? parseJwtPayload(rawAccess) : null;
  let accessToken  = rawAccess;
  let refreshToken = rawRefresh;
  let tokenRefreshed = false;

  // 4. Refresh if token is expired or expiring soon
  if (rawRefresh && (!payload || isExpired(payload) || isExpiringSoon(payload))) {
    const refreshed = await tryRefreshToken(rawRefresh);

    if (refreshed) {
      accessToken    = refreshed.access_token;
      refreshToken   = refreshed.refresh_token ?? rawRefresh;
      payload        = parseJwtPayload(accessToken);
      tokenRefreshed = true;
    } else {
      // Refresh failed — treat as unauthenticated
      if (isProtectedRoute) {
        const response = redirectToLogin(request, pathname);
        deleteCookies(response);
        return response;
      }
      // Non-protected route — let them through but clear stale cookies
      const response = NextResponse.next();
      deleteCookies(response);
      return response;
    }
  }

  // 5. Authenticated user on an auth-only page → redirect to dashboard
  if (payload && !isExpired(payload) && isAuthOnlyRoute) {
    return redirectToDashboard(request);
  }

  // 6. Protected route but no valid token
  if (isProtectedRoute && (!payload || isExpired(payload))) {
    const response = redirectToLogin(request, pathname);
    deleteCookies(response);
    return response;
  }

  // 7. Build the response — forward user info to the app via headers
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  if (payload && !isExpired(payload)) {
    // These headers are readable in server components via headers() and in
    // API routes via request.headers.get('x-velontri-user-id')
    response.headers.set('x-velontri-user-id',   payload.sub);
    response.headers.set('x-velontri-roles',      (payload.roles ?? []).join(','));
    response.headers.set('x-velontri-tier',       payload.subscription_tier ?? 'starter');
    response.headers.set('x-velontri-branch-ids', (payload.branch_ids ?? []).join(','));
  }

  // 8. Persist refreshed tokens in cookies
  if (tokenRefreshed && accessToken) {
    setCookies(response, accessToken, refreshToken);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Matcher — tells Next.js which requests to run this middleware on.
// Excludes static assets to avoid unnecessary Edge invocations.
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Run on all paths EXCEPT:
     *   _next/static  — compiled JS/CSS bundles
     *   _next/image   — Next.js image optimisation
     *   favicon.ico   — browser icon
     *   image files   — .png .jpg .jpeg .gif .svg .ico .webp
     *   font files    — .woff .woff2 .ttf .eot
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)',
  ],
};
