import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://velontri.pxxl.click';
const API  = process.env.NEXT_PUBLIC_API_URL   ?? 'https://velontri.onrender.com/api/v1';

// Category slugs that have dedicated pages
const CATEGORIES = [
  'vehicles', 'property', 'electronics', 'fashion',
  'furniture', 'jobs', 'services', 'agriculture',
  'health-beauty', 'sports', 'books',
];

async function fetchActiveListings(): Promise<{ id: string; updated_at?: string }[]> {
  try {
    // Fetch in pages to build the sitemap — max 1000 URLs per sitemap file
    const res = await fetch(`${API}/listings?page=1&page_size=500&status=active`, {
      next: { revalidate: 3600 }, // re-fetch every hour
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ── 1. Static / structural pages ────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,             lastModified: now, changeFrequency: 'daily',  priority: 1.0 },
    { url: `${BASE}/listings`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/search`,   lastModified: now, changeFrequency: 'daily',  priority: 0.7 },
  ];

  // ── 2. Category pages ────────────────────────────────────────────────────
  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map(slug => ({
    url: `${BASE}/categories/${slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // ── 3. Dynamic listing pages ─────────────────────────────────────────────
  const listings = await fetchActiveListings();
  const listingRoutes: MetadataRoute.Sitemap = listings.map(l => ({
    url: `${BASE}/listings/${l.id}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...listingRoutes];
}
