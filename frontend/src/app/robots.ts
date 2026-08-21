import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://velontri.pxxl.click';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/listings',
          '/listings/',
          '/categories/',
          '/search',
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
          '/dashboard/messages/',
          '/dashboard/settings/',
          '/dashboard/security/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/mod/',
          '/api/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
