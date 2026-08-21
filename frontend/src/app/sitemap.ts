import type { MetadataRoute } from 'next';

// Hardcode the production URLs — env vars may not resolve in all Next.js build contexts
const BASE = 'https://velontri.pxxl.click';
const API  = 'https://velontri.onrender.com/api/v1';

const CATEGORIES = [
  'vehicles', 'property', 'electronics', 'fashion',
  'furniture', 'jobs', 'services', 'agriculture',
  'health-beauty', 'sports', 'books',
];

// Static routes — these NEVER fail
const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${BASE}`,                       lastModified: new Date(), changeFrequency: 'daily',  priority: 1.0 },
  { url: `${BASE}/listings`,              lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
  { url: `${BASE}/search`,                lastModified: new Date(), changeFrequency: 'daily',  priority: 0.7 },
  ...CATEGORIES.map(slug => ({
    url: `${BASE}/categories/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  })),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Always return static routes — dynamic listing URLs are a bonus if API responds
  let listingRoutes: MetadataRoute.Sitemap = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${API}/listings?page=1&page_size=500`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      const listings: { id: string; updated_at?: string }[] =
        Array.isArray(json?.data) ? json.data : [];

      listingRoutes = listings.map(l => ({
        url: `${BASE}/listings/${l.id}`,
        lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch {
    // API unreachable — return static routes only. This is fine.
  }

  return [...STATIC_ROUTES, ...listingRoutes];
}
