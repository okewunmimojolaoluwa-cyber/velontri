/**
 * Sitemap Route Handler — GET /sitemap.xml
 *
 * Replaces app/sitemap.ts because:
 *  - Explicit Content-Type: application/xml (GSC requires this)
 *  - No Next.js serialization quirks
 *  - Guaranteed 200 even when backend is unreachable
 */

import { NextResponse } from 'next/server';

const BASE = 'https://velontri.pxxl.click';
const API  = 'https://velontri.onrender.com/api/v1';

const CATEGORIES = [
  'vehicles', 'property', 'electronics', 'fashion',
  'furniture', 'jobs', 'services', 'agriculture',
  'health-beauty', 'sports', 'books',
];

/** Build a single <url> block */
function url(
  loc: string,
  changefreq: string,
  priority: string,
  lastmod: string
): string {
  return (
    `  <url>\n` +
    `    <loc>${loc}</loc>\n` +
    `    <lastmod>${lastmod}</lastmod>\n` +
    `    <changefreq>${changefreq}</changefreq>\n` +
    `    <priority>${priority}</priority>\n` +
    `  </url>`
  );
}

async function fetchListings(): Promise<{ id: string; updated_at?: string }[]> {
  try {
    const ac = new AbortController();
    const t  = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(`${API}/listings?page=1&page_size=500`, {
      signal: ac.signal,
      // No 'cache' option — let the runtime decide; we set Cache-Control on the response
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j?.data) ? j.data : [];
  } catch {
    return [];
  }
}

export async function GET(): Promise<NextResponse> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Static pages — always present regardless of backend state
  const staticUrls = [
    url(`${BASE}/`,          'daily',  '1.0', today),
    url(`${BASE}/listings`,  'hourly', '0.9', today),
    ...CATEGORIES.map(slug =>
      url(`${BASE}/categories/${slug}`, 'daily', '0.8', today)
    ),
  ];

  // Dynamic listing pages — best-effort from the DB
  const listings    = await fetchListings();
  const listingUrls = listings.map(l => {
    const lm = l.updated_at ? l.updated_at.slice(0, 10) : today;
    return url(`${BASE}/listings/${l.id}`, 'weekly', '0.6', lm);
  });

  // Build the XML — single-line opening tag avoids attribute-parsing edge cases
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...staticUrls, ...listingUrls].join('\n') +
    `\n</urlset>\n`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type':  'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
