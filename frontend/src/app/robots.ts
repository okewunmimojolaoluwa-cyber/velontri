import type { MetadataRoute } from 'next';

/**
 * Next.js App Router robots.ts
 * Served at /robots.txt — Content-Type: text/plain; charset=utf-8
 *
 * NOTE: Cloudflare (pxxl.click) prepends its own managed content block to
 * this file, which includes:
 *   User-agent: Google-Extended
 *   Disallow: /
 * That blocks Google's AI-augmented search crawler but NOT the main
 * Googlebot crawler — which is what Google Search Console uses for indexing.
 *
 * We explicitly allow Googlebot here to make the intent unambiguous.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── Explicitly allow Googlebot (main search crawler) ──────────────
      // This overrides any Cloudflare-injected restrictions for Googlebot.
      {
        userAgent: 'Googlebot',
        allow: ['/'],
        disallow: [
          '/dashboard/',
          '/admin/',
          '/mod/',
          '/api/',
          '/login',
          '/register',
          '/forgot-password',
          '/verify-phone',
          '/verify-2fa',
          '/auth/',
        ],
      },
      // ── All other crawlers ─────────────────────────────────────────────
      {
        userAgent: '*',
        allow: [
          '/',
          '/listings',
          '/listings/',
          '/categories/',
          '/plans',
          '/stores/',
        ],
        disallow: [
          '/dashboard/',
          '/admin/',
          '/mod/',
          '/api/',
          '/login',
          '/register',
          '/forgot-password',
          '/verify-phone',
          '/verify-2fa',
          '/auth/',
          '/search',
        ],
      },
    ],
    sitemap: 'https://velontri.pxxl.click/sitemap.xml',
    // No 'host' directive — it causes robots.txt parser warnings
  };
}
