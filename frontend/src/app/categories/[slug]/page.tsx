/**
 * Category landing page — server-rendered, fully indexable.
 * /categories/vehicles, /categories/electronics, etc.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/marketplace/listing-card';
import { Navbar } from '@/components/layout/navbar';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://velontri.onrender.com/api/v1';
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://velontri.pxxl.click';

/* ── Category config ─────────────────────────────────────────────────────── */
const CATEGORY_MAP: Record<string, {
 title: string;
 description: string;
 listingType?: string;
 category?: string;
 emoji: string;
 keywords: string[];
}> = {
 vehicles: {
 title: 'Vehicles for Sale in Nigeria',
 description: 'Browse cars, trucks, motorcycles and other vehicles for sale across Nigeria. Find tokunbo and Nigerian-used vehicles from verified sellers. No agent fees contact sellers directly on WhatsApp.',
 listingType: 'vehicle',
 emoji: '🚗',
 keywords: ['cars for sale Nigeria', 'vehicles Nigeria', 'tokunbo cars', 'buy car Nigeria', 'used cars Lagos'],
 },
 property: {
 title: 'Property for Sale & Rent in Nigeria',
 description: 'Browse houses, flats, land and commercial property for sale or rent across Nigeria. Find property in Lagos, Abuja, Port Harcourt, Ibadan and more directly from landlords and agents.',
 listingType: 'property',
 emoji: '🏠',
 keywords: ['property Nigeria', 'houses for sale Lagos', 'land for sale Abuja', 'rent apartment Nigeria', 'buy house Nigeria'],
 },
 electronics: {
 title: 'Electronics for Sale in Nigeria',
 description: 'Buy and sell phones, laptops, TVs, generators and electronic gadgets across Nigeria. Find the latest iPhones, Samsung, Tecno and more at the best prices.',
 category: 'Electronics',
 emoji: '📱',
 keywords: ['phones for sale Nigeria', 'laptops Nigeria', 'buy iPhone Nigeria', 'electronics Lagos', 'generators for sale Nigeria'],
 },
 fashion: {
 title: 'Fashion & Clothing for Sale in Nigeria',
 description: 'Browse fashion, clothing, shoes, bags and accessories from Nigerian sellers. Find Ankara, lace, casual wear, designer items and more.',
 category: 'Fashion',
 emoji: '👗',
 keywords: ['fashion Nigeria', 'clothes for sale Nigeria', 'Ankara fabric Nigeria', 'shoes Nigeria', 'bags Nigeria'],
 },
 furniture: {
 title: 'Furniture for Sale in Nigeria',
 description: 'Buy and sell new and used furniture across Nigeria. Find sofas, beds, dining sets, office furniture and more.',
 category: 'Furniture',
 emoji: '🛋️',
 keywords: ['furniture Nigeria', 'sofa for sale Nigeria', 'beds Nigeria', 'office furniture Lagos', 'used furniture Abuja'],
 },
 jobs: {
 title: 'Jobs & Employment in Nigeria',
 description: 'Find job vacancies and employment opportunities across Nigeria. Browse full-time, part-time, contract and remote jobs in Lagos, Abuja, Port Harcourt and beyond.',
 listingType: 'job',
 emoji: '💼',
 keywords: ['jobs Nigeria', 'vacancies Nigeria', 'employment Lagos', 'work Nigeria', 'job listings Abuja'],
 },
 services: {
 title: 'Services in Nigeria',
 description: 'Find skilled service providers across Nigeria plumbers, electricians, cleaners, tutors, graphic designers and more. Contact service providers directly.',
 listingType: 'service',
 emoji: '🔧',
 keywords: ['services Nigeria', 'plumber Lagos', 'electrician Nigeria', 'cleaning services Abuja', 'tutors Nigeria'],
 },
 agriculture: {
 title: 'Agriculture & Farm Produce in Nigeria',
 description: 'Buy and sell farm produce, livestock, equipment and agricultural products across Nigeria.',
 category: 'Agriculture',
 emoji: '🌾',
 keywords: ['farm produce Nigeria', 'livestock Nigeria', 'agricultural products', 'cattle for sale Nigeria'],
 },
 'health-beauty': {
 title: 'Health & Beauty Products in Nigeria',
 description: 'Browse health, beauty and personal care products from Nigerian sellers.',
 category: 'Health & Beauty',
 emoji: '💅',
 keywords: ['beauty products Nigeria', 'health products Nigeria', 'skincare Nigeria'],
 },
 sports: {
 title: 'Sports & Fitness in Nigeria',
 description: 'Buy and sell sports equipment, fitness gear and outdoor products across Nigeria.',
 category: 'Sports',
 emoji: '⚽',
 keywords: ['sports equipment Nigeria', 'gym equipment Lagos', 'football gear Nigeria'],
 },
 books: {
 title: 'Books & Education in Nigeria',
 description: 'Buy and sell textbooks, novels, educational materials and more across Nigeria.',
 category: 'Books',
 emoji: '📚',
 keywords: ['books Nigeria', 'textbooks Lagos', 'novels Nigeria', 'educational materials'],
 },
};

/* ── Fetch listings for this category ────────────────────────────────────── */
async function fetchCategoryListings(config: typeof CATEGORY_MAP[string]) {
 try {
 const params = new URLSearchParams({ page: '1', page_size: '24', status: 'active' });
 if (config.listingType) params.set('listing_type', config.listingType);
 if (config.category) params.set('category', config.category);

 const res = await fetch(`${API}/listings?${params}`, {
 next: { revalidate: 1800 },
 });
 if (!res.ok) return [];
 const json = await res.json();
 return Array.isArray(json?.data) ? json.data : [];
 } catch {
 return [];
 }
}

/* ── generateMetadata ─────────────────────────────────────────────────────── */
export async function generateMetadata(
 { params }: { params: { slug: string } }
): Promise<Metadata> {
 const config = CATEGORY_MAP[params.slug];
 if (!config) return { title: 'Category Not Found | Velontri', robots: { index: false, follow: false } };

 const canonicalUrl = `${BASE}/categories/${params.slug}`;
 return {
 title: `${config.title} | Velontri`,
 description: config.description,
 keywords: config.keywords,
 alternates: { canonical: canonicalUrl },
 openGraph: {
 type: 'website',
 url: canonicalUrl,
 title: `${config.title} | Velontri`,
 description: config.description,
 siteName: 'Velontri',
 locale: 'en_NG',
 },
 twitter: {
 card: 'summary_large_image',
 title: `${config.title} | Velontri`,
 description: config.description,
 },
 robots: { index: true, follow: true },
 };
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default async function CategoryPage(
 { params }: { params: { slug: string } }
) {
 const config = CATEGORY_MAP[params.slug];
 if (!config) notFound();

 const listings = await fetchCategoryListings(config);
 const canonicalUrl = `${BASE}/categories/${params.slug}`;

 const breadcrumbJsonLd = {
 '@context': 'https://schema.org',
 '@type': 'BreadcrumbList',
 itemListElement: [
 { '@type': 'ListItem', position: 1, name: 'House', item: BASE },
 { '@type': 'ListItem', position: 2, name: 'Categories', item: `${BASE}/categories` },
 { '@type': 'ListItem', position: 3, name: config.title, item: canonicalUrl },
 ],
 };

 const collectionJsonLd = {
 '@context': 'https://schema.org',
 '@type': 'CollectionPage',
 name: config.title,
 description: config.description,
 url: canonicalUrl,
 };

 return (
 <>
 <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
 <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />

 <div className="min-h-screen bg-[#F8F9FA]">
 <Navbar />

        {/* Hero */}
 <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 py-10 sm:py-14">
 <div className="mx-auto max-w-4xl px-4 sm:px-6">
            {/* Breadcrumb */}
 <nav className="flex items-center gap-1.5 text-[12px] text-indigo-300 mb-4" aria-label="Breadcrumb">
 <Link href="/" className="hover:text-white transition-colors">House</Link>
 <span aria-hidden="true">›</span>
 <Link href="/listings" className="hover:text-white transition-colors">Listings</Link>
 <span aria-hidden="true">›</span>
 <span className="text-white">{config.title.split(' for ')[0].split(' in ')[0]}</span>
 </nav>

 <div className="flex items-center gap-4">
 <span className="text-5xl" aria-hidden="true">{config.emoji}</span>
 <div>
 <h1 className="text-white font-black text-[1.8rem] leading-tight tracking-tight">
 {config.title}
 </h1>
 <p className="text-indigo-200 text-[14px] mt-1 max-w-xl">
 {config.description.split('.')[0]}.
 </p>
 </div>
 </div>
 </div>
 </div>

        {/* Intro text — crawlable by Google */}
 <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
 <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
 <p className="text-[14px] text-slate-600 leading-relaxed">
 {config.description}
 </p>
            {/* Category links */}
 <div className="mt-4 flex flex-wrap gap-2">
 {Object.entries(CATEGORY_MAP)
 .filter(([slug]) => slug !== params.slug)
 .slice(0, 6)
 .map(([slug, cat]) => (
 <Link
 key={slug}
 href={`/categories/${slug}`}
 className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50
 px-3 py-1 text-[12px] font-medium text-slate-500
 hover:border-indigo-300 hover:text-indigo-600 no-underline transition-all"
 >
 {cat.emoji} {cat.title.split(' for ')[0].split(' in ')[0]}
 </Link>
 ))}
 </div>
 </div>

          {/* Listings count */}
 <p className="text-[13px] text-slate-500 mb-5">
 <span className="font-bold text-slate-900">{listings.length}</span> listings found
 </p>

          {/* Listings grid */}
 {listings.length > 0 ? (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
 {listings.map((listing: any) => (
 <ListingCard key={listing.id} listing={listing} />
 ))}
 </div>
 ) : (
 <div className="py-20 text-center">
 <p className="text-[18px] font-bold text-slate-900 mb-2">No listings yet</p>
 <p className="text-[14px] text-slate-400 mb-5">
 Be the first to post in this category.
 </p>
 <Link
 href="/dashboard/listings/create"
 className="inline-flex items-center gap-2 h-11 rounded-xl bg-indigo-600 px-6
 text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors"
 >
 Post a Listing Free
 </Link>
 </div>
 )}

          {/* See all link */}
 {listings.length >= 24 && (
 <div className="mt-8 text-center">
 <Link
 href={config.listingType
 ? `/listings?listing_type=${config.listingType}`
 : `/listings?category=${encodeURIComponent(config.category ?? '')}`}
 className="inline-flex items-center gap-2 h-11 rounded-xl border-2 border-indigo-200
 bg-indigo-50 px-8 text-[14px] font-bold text-indigo-600 no-underline
 hover:bg-indigo-100 transition-all"
 >
 View all {config.title.split(' for ')[0]} listings →
 </Link>
 </div>
 )}
 </div>
 </div>
 </>
 );
}
