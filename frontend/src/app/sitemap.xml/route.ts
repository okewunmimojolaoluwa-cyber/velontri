/**
 * GET /sitemap.xml
 *
 * Next.js App Router Route Handler — full control over Content-Type.
 *
 * Why not sitemap.ts?
 * Next.js's built-in sitemap.ts mechanism always emits:
 *   Content-Type: application/xml; charset=utf-8
 * Google Search Console's sitemap ingestion API rejects application/xml
 * with error: "(400) Unsupported content-type: application/xml"
 * It only accepts: text/xml  or  text/plain
 *
 * This route handler explicitly sets Content-Type: text/xml; charset=utf-8
 * and bypasses Next.js's built-in sitemap machinery entirely.
 */
import { NextResponse } from 'next/server';

const SITE = 'https://velontri.pxxl.click';
const API  = process.env.NEXT_PUBLIC_API_URL || 'https://velontri.onrender.com/api/v1';

/* ── Static pages always in the sitemap ──────────────────────────────── */
const STATIC = [
  { loc: `${SITE}/`,         changefreq: 'daily',  priority: '1.0' },
  { loc: `${SITE}/listings`, changefreq: 'hourly', priority: '0.9' },
];

const CATEGORIES = [
  'vehicles', 'property', 'electronics', 'fashion',
  'furniture', 'jobs', 'services', 'agriculture',
  'health-beauty', 'sports', 'books',
];

/* ── XML helpers ─────────────────────────────────────────────────────── */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(
  loc: string,
  opts: { lastmod?: string; changefreq?: string; priority?: string } = {},
): string {
  const parts = [`  <url>\n    <loc>${escapeXml(loc)}</loc>`];
  if (opts.lastmod)    parts.push(`    <lastmod>${opts.lastmod}</lastmod>`);
  if (opts.changefreq) parts.push(`    <changefreq>${opts.changefreq}</changefreq>`);
  if (opts.priority)   parts.push(`    <priority>${opts.priority}</priority>`);
  parts.push('  </url>');
  return parts.join('\n');
}

/* ── Fetch live listing IDs from the API ─────────────────────────────── */
async function getListingEntries(): Promise<string[]> {
  const entries: string[] = [];
  const pageSize = 100;
  let   page     = 1;
  let   hasMore  = true;

  while (hasMore) {
    try {
      const res = await fetch(
        `${API}/listings?page=${page}&page_size=${pageSize}`,
        {
          next:    { revalidate: 3600 },
          headers: { Accept: 'application/json' },
          signal:  AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) break;

      const json  = await res.json();
      const items: any[] = Array.isArray(json?.data) ? json.data : [];

      for (const item of items) {
        if (!item?.id) continue;
        const lastmod = item.updated_at
          ? new Date(item.updated_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        entries.push(urlEntry(
          `${SITE}/listings/${item.id}`,
          { lastmod, changefreq: 'daily', priority: '0.7' },
        ));
      }

      const meta = json?.meta;
      hasMore = meta?.has_next === true && items.length === pageSize;
      page++;
      if (entries.length >= 5000) break;

    } catch {
      break;
    }
  }

  return entries;
}

/* ── Route handler ───────────────────────────────────────────────────── */
export const dynamic = 'force-dynamic'; // always re-render, never cache as HTML

export async function GET(): Promise<NextResponse> {
  const today = new Date().toISOString().split('T')[0];

  // Static entries
  const staticEntries = STATIC.map(p =>
    urlEntry(p.loc, { lastmod: today, changefreq: p.changefreq, priority: p.priority }),
  );

  // Category entries
  const categoryEntries = CATEGORIES.map(slug =>
    urlEntry(`${SITE}/categories/${slug}`, {
      lastmod:    today,
      changefreq: 'daily',
      priority:   '0.8',
    }),
  );

  // Dynamic listing entries
  const listingEntries = await getListingEntries();

  const allEntries = [...staticEntries, ...categoryEntries, ...listingEntries];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allEntries,
    '</urlset>',
  ].join('\n');

  return new NextResponse(xml, {
    status: 200,
    headers: {
      // text/xml is what Google Search Console expects — not application/xml
      'Content-Type':  'text/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag':  'noindex',
    },
  });
}
