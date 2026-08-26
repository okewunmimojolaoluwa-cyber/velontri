import type { MetadataRoute } from 'next';

/**
 * Next.js App Router robots.ts
 * Served at /robots.txt with Content-Type: text/plain; charset=utf-8
 * No auth, no JS, no cookies required — accessible to all crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/listings/',
          '/listings',
          '/categories/',
          '/search',
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
        ],
      },
    ],
    sitemap: 'https://velontri.pxxl.click/sitemap.xml',
    host:    'https://velontri.pxxl.click',
  };
}
