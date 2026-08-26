import type { MetadataRoute } from 'next';

const SITE = 'https://velontri.pxxl.click';
const API  = process.env.NEXT_PUBLIC_API_URL || 'https://velontri.onrender.com/api/v1';

/* ── Static public pages ─────────────────────────────────── */
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: `${SITE}/`,          lastModified: new Date(), changeFrequency: 'daily',  priority: 1.0 },
  { url: `${SITE}/listings`,  lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
  { url: `${SITE}/search`,    lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
  { url: `${SITE}/plans`,     lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
];

/* ── Category pages ─────────────────────────────────────── */
const CATEGORIES = [
  'vehicles', 'property', 'electronics', 'fashion',
  'furniture', 'jobs', 'services', 'agriculture',
  'health-beauty', 'sports', 'books',
];
const CATEGORY_PAGES: MetadataRoute.Sitemap = CATEGORIES.map(slug => ({
  url:             `${SITE}/categories/${slug}`,
  lastModified:    new Date(),
  changeFrequency: 'daily',
  priority:        0.8,
}));

/* ── Fetch active listing IDs from the API ──────────────── */
async function fetchListingUrls(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const pageSize = 100;
  let   page     = 1;
  let   hasMore  = true;

  while (hasMore) {
    try {
      const res = await fetch(
        `${API}/listings?page=${page}&page_size=${pageSize}&status=active`,
        {
          next: { revalidate: 3600 }, // ISR — re-fetch every hour
          headers: { 'Accept': 'application/json' },
        },
      );
      if (!res.ok) break;

      const json = await res.json();
      const items: any[] = Array.isArray(json?.data) ? json.data : [];

      for (const item of items) {
        if (!item?.id) continue;
        entries.push({
          url:             `${SITE}/listings/${item.id}`,
          lastModified:    item.updated_at ? new Date(item.updated_at) : new Date(),
          changeFrequency: 'daily',
          priority:        0.7,
        });
      }

      const meta = json?.meta;
      hasMore = meta?.has_next === true && items.length === pageSize;
      page++;

      // Safety cap — never generate more than 5 000 listing URLs in one build
      if (entries.length >= 5000) break;
    } catch {
      // If the API is down during build, skip listings — static pages still go in
      break;
    }
  }

  return entries;
}

/* ── Fetch active store/seller pages ────────────────────── */
async function fetchStoreUrls(): Promise<MetadataRoute.Sitemap> {
  // Stores are surfaced via /listings?seller_id=xxx — we skip a dedicated
  // /stores/:id route for now since it doesn't exist as a public page yet.
  // Return empty — extend here when /stores/[id] page is added.
  return [];
}

/* ── Main sitemap export ─────────────────────────────────── */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listingUrls, storeUrls] = await Promise.all([
    fetchListingUrls(),
    fetchStoreUrls(),
  ]);

  return [
    ...STATIC_PAGES,
    ...CATEGORY_PAGES,
    ...listingUrls,
    ...storeUrls,
  ];
}
