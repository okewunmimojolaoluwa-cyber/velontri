/**
 * Listing detail — SERVER COMPONENT wrapper.
 *
 * Responsibilities:
 *  - generateMetadata(): fetch listing from API server-side, build dynamic
 *    title/description/OpenGraph/Twitter metadata for Google indexing.
 *  - Server-render a minimal SEO shell (title, price, description, location)
 *    so Googlebot gets crawlable content without executing JavaScript.
 *  - Render Product + BreadcrumbList JSON-LD structured data.
 *  - Import and render the full interactive client component below the fold.
 *
 * The interactive gallery, messaging, saves, etc. live in listing-client.tsx
 * which is a 'use client' component. Googlebot sees the SSR shell; users
 * get the full interactive experience via React hydration.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import ListingClientPage from './listing-client';

const API  = process.env.NEXT_PUBLIC_API_URL  ?? 'https://velontri.onrender.com/api/v1';
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://velontri.pxxl.click';

/* ── Types ────────────────────────────────────────────────────────────────── */
interface ListingData {
  id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  currency?: string;
  category?: string | null;
  listing_type?: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  condition?: string | null;
  image_url?: string | null;
  media_urls?: string[];
  seller_name?: string | null;
  seller_verified?: boolean;
  avg_rating?: number;
  review_count?: number;
  status?: string;
  created_at?: string;
}

/* ── Server-side data fetch ───────────────────────────────────────────────── */
async function fetchListing(id: string): Promise<ListingData | null> {
  try {
    const res = await fetch(`${API}/listings/${id}`, {
      next: { revalidate: 300 }, // cache for 5 minutes — balances freshness vs cost
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? null) as ListingData | null;
  } catch {
    return null;
  }
}

/* ── generateMetadata ─────────────────────────────────────────────────────── */
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const listing = await fetchListing(params.id);

  if (!listing) {
    return {
      title: 'Listing Not Found | Velontri',
      robots: { index: false, follow: false },
    };
  }

  const priceStr = listing.price
    ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: listing.currency ?? 'NGN', maximumFractionDigits: 0 }).format(listing.price)
    : '';

  const location = [listing.city, listing.state].filter(Boolean).join(', ') || listing.country || 'Nigeria';
  const title    = `${listing.title}${priceStr ? ` — ${priceStr}` : ''} | Velontri`;
  const desc     = listing.description
    ? `${listing.description.slice(0, 150).trim()}…`
    : `${listing.title}. Available on Velontri Nigeria — ${location}. ${priceStr ? `Price: ${priceStr}.` : ''} Buy and sell anything with no agent fees.`;

  const images = listing.media_urls?.length
    ? listing.media_urls.slice(0, 1)
    : listing.image_url
    ? [listing.image_url]
    : [];

  const canonicalUrl = `${BASE}/listings/${listing.id}`;

  return {
    title,
    description: desc,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title,
      description: desc,
      siteName: 'Velontri',
      locale: 'en_NG',
      images: images.map(img => ({ url: img, alt: listing.title })),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: images.slice(0, 1),
    },
    robots: listing.status === 'active'
      ? { index: true, follow: true, 'max-image-preview': 'large' }
      : { index: false, follow: false },
  };
}

/* ── JSON-LD structured data ─────────────────────────────────────────────── */
function ListingStructuredData({ listing }: { listing: ListingData }) {
  const canonicalUrl = `${BASE}/listings/${listing.id}`;
  const priceStr = listing.price?.toString() ?? '0';
  const images = listing.media_urls?.length
    ? listing.media_urls
    : listing.image_url
    ? [listing.image_url]
    : [];

  // Condition map → Schema.org
  const conditionMap: Record<string, string> = {
    new: 'https://schema.org/NewCondition',
    used: 'https://schema.org/UsedCondition',
    refurbished: 'https://schema.org/RefurbishedCondition',
    'fairly used': 'https://schema.org/UsedCondition',
  };
  const itemCondition = listing.condition
    ? (conditionMap[listing.condition.toLowerCase()] ?? 'https://schema.org/UsedCondition')
    : undefined;

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description ?? listing.title,
    url: canonicalUrl,
    ...(images.length > 0 ? { image: images } : {}),
    ...(listing.category ? { category: listing.category } : {}),
    ...(itemCondition ? { itemCondition } : {}),
    offers: {
      '@type': 'Offer',
      price: priceStr,
      priceCurrency: listing.currency ?? 'NGN',
      availability: listing.status === 'active'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
      ...(listing.city ? { areaServed: listing.city } : {}),
    },
    ...(listing.avg_rating && listing.avg_rating > 0 && listing.review_count && listing.review_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: listing.avg_rating.toFixed(1),
            reviewCount: listing.review_count,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  };

  const location = [listing.city, listing.state, 'Nigeria'].filter(Boolean).join(' › ');
  const category = listing.category ?? listing.listing_type ?? 'Listings';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'House',     item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Listings', item: `${BASE}/listings` },
      { '@type': 'ListItem', position: 3, name: category,   item: `${BASE}/categories/${category.toLowerCase().replace(/\s+/g, '-')}` },
      { '@type': 'ListItem', position: 4, name: listing.title, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
  );
}

/* ── SSR content shell ────────────────────────────────────────────────────── */
function ListingSeoShell({ listing }: { listing: ListingData }) {
  const priceStr = listing.price
    ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: listing.currency ?? 'NGN', maximumFractionDigits: 0 }).format(listing.price)
    : '';
  const location = [listing.city, listing.state].filter(Boolean).join(', ') || listing.country || '';
  const canonicalUrl = `${BASE}/listings/${listing.id}`;

  return (
    /* Visually hidden — Google reads it, users see the hydrated client UI */
    <div className="sr-only" aria-hidden="true">
      <h1>{listing.title}</h1>
      {priceStr && <p>Price: {priceStr}</p>}
      {listing.description && <p>{listing.description}</p>}
      {listing.category && <p>Category: {listing.category}</p>}
      {listing.condition && <p>Condition: {listing.condition}</p>}
      {location && <p>Location: {location}</p>}
      {listing.seller_name && <p>Seller: {listing.seller_name}</p>}
      {listing.seller_verified && <p>Verified seller</p>}
      <p>Listed on Velontri Nigeria marketplace</p>
      <link rel="canonical" href={canonicalUrl} />
    </div>
  );
}

/* ── Page component ───────────────────────────────────────────────────────── */
export default async function ListingDetailPage(
  { params }: { params: { id: string } }
) {
  // Fetch server-side for SSR shell + structured data
  const listing = await fetchListing(params.id);

  return (
    <>
      {/* Structured data injected into <head> region */}
      {listing && <ListingStructuredData listing={listing} />}

      {/* Crawlable text shell (hidden visually, readable by Google) */}
      {listing && <ListingSeoShell listing={listing} />}

      {/* Full interactive client component */}
      <Suspense fallback={null}>
        <ListingClientPage />
      </Suspense>
    </>
  );
}
