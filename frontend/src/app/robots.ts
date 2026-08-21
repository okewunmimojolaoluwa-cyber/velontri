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
          '/search',    // search result pages should not be indexed
        ],
      },
    ],
    // Hardcoded — never rely on env vars here
    sitemap: 'https://velontri.pxxl.click/sitemap.xml',
  };
}
