import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/listings/',
          '/categories/',
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
  };
}
