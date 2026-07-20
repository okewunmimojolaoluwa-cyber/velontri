/**
 * Minimal type declarations for next/server (Edge runtime).
 * Replace this file once you run `npm install next` in your project.
 * These types match Next.js 14 exactly.
 */

declare module 'next/server' {
  // ── NextRequest ────────────────────────────────────────────────────────────
  export class NextRequest extends Request {
    readonly nextUrl: URL & {
      readonly pathname: string;
      readonly searchParams: URLSearchParams;
    };
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): Array<{ name: string; value: string }>;
      has(name: string): boolean;
    };
    readonly headers: Headers;
    readonly url: string;
    readonly method: string;
  }

  // ── ResponseCookies ────────────────────────────────────────────────────────
  interface ResponseCookie {
    name: string;
    value: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
    path?: string;
    domain?: string;
    expires?: Date;
  }

  interface ResponseCookies {
    set(name: string, value: string, options?: Omit<ResponseCookie, 'name' | 'value'>): void;
    delete(name: string): void;
    get(name: string): ResponseCookie | undefined;
    getAll(): ResponseCookie[];
  }

  // ── NextResponse ───────────────────────────────────────────────────────────
  export class NextResponse extends Response {
    readonly cookies: ResponseCookies;
    readonly headers: Headers;

    static next(init?: {
      request?: { headers?: HeadersInit };
      headers?: HeadersInit;
    }): NextResponse;

    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;

    static rewrite(destination: string | URL, init?: ResponseInit): NextResponse;

    static json(body: unknown, init?: ResponseInit): NextResponse;
  }
}
