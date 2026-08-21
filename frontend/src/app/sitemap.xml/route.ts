/**
 * Sitemap Route Handler — /sitemap.xml
 *
 * Why a Route Handler instead of app/sitemap.ts:
 * - Explicit control over Content-Type: application/xml header
 * - No Next.js serialization/caching quirks that cause GSC "could not read"
 * - Guaranteed 200 status with proper XML even if backend is unreachable
 * - Works correctly on pxxl, Vercel, Render and any Node.js host
 */

import { NextResponse } from 'next/server';

const BASE = 'https://velontri.pxxl.click';
const API  = 'https://velontri.onrender.com/api/v1';

const CATEGORIES = [
  'vehicles', 'property', 'electronics', 'fashion',
  'furniture', 'jobs', 'services', 'agriculture',
  'health-beauty', 'sports', 'books',
];

function xmlUrl(
  loc: string,
  opts: { lastmod?: string; changefreq?: string; priority?: string } = {}
): string {
  const { lastmod, changefreq, priority } = opts;
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    lastmod   ? `    <lastmod>${lastmod}</lastmod>`         : '',
    changefreq? `    <changefreq>${changefreq}</changefreq>`: '',
    priority  ? `    <priority>${priority}</priority>`      : '',
    '  </url>',
  ].filter(Boolean).join('\n');
}

async function fetchListingIds(): Promise<{ id: string; updated_at?: string }[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `${API}/listings?page=1&page_size=500`,
      { signal: controller.signal, cache: 'no-store' }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function GET(): Promise<NextResponse> {
  const today = new Date().toISOString().split('T')[0];

  // Always-present pages
  const staticEntries = [
    xmlUrl(`${BASE}/`, { changefreq: 'daily', priority: '1.0', lastmod: today }),
    xmlUrl(`${BASE}/listings`, { changefreq: 'hourly', priority: '0.9', lastmod: today }),
    ...CATEGORIES.map(slug =>
      xmlUrl(`${BASE}/categories/${slug}`, { changefreq: 'daily', priority: '0.8', lastmod: today })
    ),
  ];

  // Dynamic listing pages from real DB — best-effort, silent on failure
  const listings = await fetchListingIds();
  const listingEntries = listings.map(l => {
    const lastmod = l.updated_at
      ? new Date(l.updated_at).toISOString().split('T')[0]
      : today;
    return xmlUrl(`${BASE}/listings/${l.id}`, {
      changefreq: 'weekly',
      priority: '0.6',
      lastmod,
    });
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
    '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
    ...staticEntries,
    ...listingEntries,
    '</urlset>',
  ].join('\n');

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Robots-Tag': 'noindex',   // don't index the sitemap file itself
    },
  });
}
