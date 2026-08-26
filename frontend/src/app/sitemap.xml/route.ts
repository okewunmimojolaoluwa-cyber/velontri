/**
 * GET /sitemap.xml — Next.js App Router Route Handler
 *
 * Why a Route Handler instead of sitemap.ts?
 *   Next.js sitemap.ts hardcodes Content-Type: application/xml
 *   Google MagnifyingGlass Console rejects application/xml with (400) Unsupported
 *   content-type. This handler explicitly sends text/xml; charset=utf-8.
 *
 * Listing data source:
 *   Fetches from the Velontri public listings API endpoint which already
 *   filters status = 'active' (approved, public, not draft/rejected/deleted).
 *   Fields used: id, updated_at (for real lastmod timestamps).
 *
 * Caching:
 *   force-dynamic + Cache-Control: max-age=3600 means:
 *   - CDN caches for 1 hour
 *   - Stale-while-revalidate for 24 hours so crawlers always get a response
 *   - New approved listings appear within 1 hour without a redeploy
 *
 * X-Robots-Tag:
 *   Intentionally NOT set — sitemaps must never be marked noindex.
 *   The noindex was previously set here by mistake and blocked GSC.
 */
import { NextResponse } from 'next/server';

const SITE = 'https://velontri.pxxl.click';

// Use server-side env var (not NEXT_PUBLIC_ which is build-time only)
// Falls back to the known production API URL
const API = process.env.API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://velontri.onrender.com/api/v1';

/* ── Static pages ────────────────────────────────────────────────────── */
// lastmod uses a real date — not today-on-every-request (that tells Google
// pages changed when they didn't, wasting crawl budget)
const STATIC_PAGES = [
  { loc: `${SITE}/`,           changefreq: 'daily',  priority: '1.0', lastmod: '2026-01-01' },
  { loc: `${SITE}/listings`,   changefreq: 'hourly', priority: '0.9', lastmod: '2026-01-01' },
  { loc: `${SITE}/search`,     changefreq: 'daily',  priority: '0.7', lastmod: '2026-01-01' },
  { loc: `${SITE}/plans`,      changefreq: 'weekly', priority: '0.6', lastmod: '2026-01-01' },
];

const CATEGORIES = [
  'vehicles', 'property', 'electronics', 'fashion',
  'furniture', 'jobs', 'services', 'agriculture',
  'health-beauty', 'sports', 'books',
];

/* ── XML helpers ─────────────────────────────────────────────────────── */
function esc(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

function entry(
  loc: string,
  lastmod?: string,
  changefreq?: string,
  priority?: string,
): string {
  const lines = [`  <url>`, `    <loc>${esc(loc)}</loc>`];
  if (lastmod)    lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority)   lines.push(`    <priority>${priority}</priority>`);
  lines.push(`  </url>`);
  return lines.join('\n');
}

/* ── Fetch active listing entries from the live API ─────────────────── */
async function listingEntries(): Promise<string[]> {
  const results: string[] = [];
  const PAGE_SIZE = 100;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    let res: Response;
    try {
      res = await fetch(`${API}/listings?page=${page}&page_size=${PAGE_SIZE}`, {
        // ISR: allow CDN/Next.js to revalidate after 1 hour
        // so new approved listings appear in the sitemap without redeploy
        next:    { revalidate: 3600 },
        headers: { Accept: 'application/json' },
        signal:  AbortSignal.timeout(12_000),
      });
    } catch {
      // API timeout or network error — return what we have so far
      break;
    }

    if (!res.ok) break;

    let json: any;
    try { json = await res.json(); } catch { break; }

    const items: any[] = Array.isArray(json?.data) ? json.data : [];
    if (items.length === 0) break;

    for (const item of items) {
      if (!item?.id) continue;

      // Use the listing's real updated_at for lastmod — not today's date.
      // This tells Google accurately when the page last changed.
      const lastmod = item.updated_at
        ? new Date(item.updated_at).toISOString().split('T')[0]
        : item.created_at
        ? new Date(item.created_at).toISOString().split('T')[0]
        : undefined;

      results.push(entry(
        `${SITE}/listings/${item.id}`,
        lastmod,
        'daily',
        '0.7',
      ));
    }

    const meta = json?.meta;
    hasMore = (meta?.has_next === true) && (items.length === PAGE_SIZE);
    page++;

    // Sitemap protocol limit: 50,000 URLs per file
    // We cap at 45,000 to leave headroom; implement sitemap index when needed
    if (results.length >= 45_000) break;
  }

  return results;
}

/* ── Route handler ───────────────────────────────────────────────────── */

// force-dynamic: never pre-render as static HTML at build time
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  // Build static section
  const staticSection = STATIC_PAGES.map(p =>
    entry(p.loc, p.lastmod, p.changefreq, p.priority)
  );

  // Build category section
  const categorySection = CATEGORIES.map(slug =>
    entry(
      `${SITE}/categories/${slug}`,
      '2026-01-01',
      'daily',
      '0.8',
    )
  );

  // Build dynamic listings section — fetched from live API
  const dynamicSection = await listingEntries();

  // Deduplicate (defensive — shouldn't be needed but cheap insurance)
  const seen = new Set<string>();
  const allEntries: string[] = [];
  for (const e of [...staticSection, ...categorySection, ...dynamicSection]) {
    // Extract the <loc> value for dedup check
    const locMatch = e.match(/<loc>(.*?)<\/loc>/);
    if (!locMatch) continue;
    const loc = locMatch[1];
    if (seen.has(loc)) continue;
    seen.add(loc);
    allEntries.push(e);
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allEntries,
    '</urlset>',
  ].join('\n');

  return new NextResponse(xml, {
    status: 200,
    headers: {
      // text/xml — required by Google MagnifyingGlass Console (application/xml is rejected)
      'Content-Type':  'text/xml; charset=utf-8',
      // Cache for 1 hour on CDN; stale-while-revalidate for 24 hours
      // No X-Robots-Tag — sitemaps must NEVER be marked noindex
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
