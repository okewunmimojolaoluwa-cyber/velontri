import type { MetadataRoute } from 'next';

const SITE = 'https://velontri.pxxl.click';
const API  = process.env.NEXT_PUBLIC_API_URL || 'https://velontri.onrender.com/api/v1';

/* ── Static public pages ─────────────────────────────────────────────── */
const STATIC_PAGES: MetadataRoute.Sitemap = [
  {
    url:             `${SITE}/`,
    lastModified:    new Date(),
    changeFrequency: 'daily',
    priority:        1.0,
  },
  {
    url:             `${SITE}/listings`,
    lastModified:    new Date(),
    changeFrequency: 'hourly',
    priority:        0.9,
  },
  // NOTE: /search is intentionally excluded — it is a search interface,
  // not an independent indexable landing page.
];

/* ── Category pages (all confirmed 200 in production) ───────────────── */
const CATEGORIES = [
  'vehicles',
  'property',
  'electronics',
  'fashion',
  'furniture',
  'jobs',
  'services',
  'agriculture',
  'health-beauty',
  'sports',
  'books',
] as const;

const CATEGORY_PAGES: MetadataRoute.Sitemap = CATEGORIES.map(slug => ({
  url:             `${SITE}/categories/${slug}`,
  lastModified:    new Date(),
  changeFrequency: 'daily',
  priority:        0.8,
}));

/* ── Fetch active listing pages from the live API ───────────────────── */
async function fetchListingUrls(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const pageSize = 100;
  let   page     = 1;
  let   hasMore  = true;

  while (hasMore) {
    try {
      const res = await fetch(
        `${API}/listings?page=${page}&page_size=${pageSize}`,
        {
          // ISR: re-fetch at most once per hour so new listings appear quickly
          next:    { revalidate: 3600 },
          headers: { Accept: 'application/json' },
          signal:  AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) break;

      const json  = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];

      for (const item of items) {
        if (!item?.id) continue;
        entries.push({
          url:             `${SITE}/listings/${item.id}`,
          lastModified:    item.updated_at
                             ? new Date(item.updated_at)
                             : new Date(),
          changeFrequency: 'daily',
          priority:        0.7,
        });
      }

      const meta = json?.meta;
      hasMore = meta?.has_next === true && items.length === pageSize;
      page++;

      // Safety cap — never exceed 5 000 listing URLs
      if (entries.length >= 5000) break;

    } catch {
      // API unreachable during build — skip listings, static pages still go in
      break;
    }
  }

  return entries;
}

/* ── Main export ─────────────────────────────────────────────────────── */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listingUrls = await fetchListingUrls();

  return [
    ...STATIC_PAGES,
    ...CATEGORY_PAGES,
    ...listingUrls,
  ];
}
