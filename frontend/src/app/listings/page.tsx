'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  SlidersHorizontal, X, Search, MapPin, Car, Home,
  Smartphone, Shirt, Briefcase, ShoppingBag, Zap,
  ChevronRight, Package,
} from 'lucide-react';
import { useListings } from '@/features/listings/hooks/use-listings';
import { Navbar } from '@/components/layout/navbar';
import { cn } from '@/lib/utils/cn';
import { AutoScrollRow } from '@/components/marketplace/auto-scroll-row';
import type { ListingFilters } from '@/lib/api/endpoints/listings';

/* ── Config ───────────────────────────────────────────────── */
const CATEGORIES = [
  { label: 'All',         value: '',             icon: ShoppingBag,  color: '#4F46E5', bg: '#eef2ff' },
  { label: 'Vehicles',    value: 'vehicle',      icon: Car,          color: '#0369A1', bg: '#e0f2fe' },
  { label: 'Property',    value: 'property',     icon: Home,         color: '#059669', bg: '#ecfdf5' },
  { label: 'Electronics', value: 'Electronics',  icon: Smartphone,   color: '#7C3AED', bg: '#f5f3ff' },
  { label: 'Fashion',     value: 'Fashion',      icon: Shirt,        color: '#DB2777', bg: '#fce7f3' },
  { label: 'Jobs',        value: 'job',          icon: Briefcase,    color: '#D97706', bg: '#fffbeb' },
  { label: 'Services',    value: 'service',      icon: Zap,          color: '#DC2626', bg: '#fef2f2' },
] as const;

const COUNTRIES = [
  { value: '', label: '🌍 All countries' },
  { value: 'NG', label: '🇳🇬 Nigeria' },
  { value: 'GH', label: '🇬🇭 Ghana' },
  { value: 'KE', label: '🇰🇪 Kenya' },
  { value: 'ZA', label: '🇿🇦 South Africa' },
  { value: 'TZ', label: '🇹🇿 Tanzania' },
  { value: 'UG', label: '🇺🇬 Uganda' },
];

const SORT_OPTIONS = [
  { value: '',        label: 'Latest first' },
  { value: 'price_asc',  label: 'Price: low → high' },
  { value: 'price_desc', label: 'Price: high → low' },
];

/* ── Helpers ──────────────────────────────────────────────── */
function fmtPrice(price: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency, maximumFractionDigits: 0,
      notation: price >= 1_000_000 ? 'compact' : 'standard',
    }).format(price);
  } catch { return `₦${price.toLocaleString()}`; }
}

const COND_LABEL: Record<string, string> = {
  new: 'Brand New', used: 'Used', refurbished: 'Refurbished',
};

/* ── Listing card ─────────────────────────────────────────── */
function BrowseCard({ listing }: { listing: any }) {
  const cat = CATEGORIES.find(c => c.value === listing.listing_type || c.value === listing.category);
  const Icon = cat?.icon ?? Package;
  const accent = cat?.color ?? '#4F46E5';
  const bgLight = cat?.bg ?? '#eef2ff';

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex-shrink-0 w-[200px] block overflow-hidden rounded-2xl
        border border-slate-200 bg-white shadow-sm no-underline
        transition-all duration-200 hover:-translate-y-1
        hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.13)]"
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-slate-100" style={{ height: 140 }}>
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ background: bgLight }}>
            <Icon className="h-10 w-10" style={{ color: accent }} strokeWidth={1.5} />
          </div>
        )}
        {/* Category badge */}
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full px-2.5 py-1
          text-[10px] font-black uppercase tracking-wide text-white backdrop-blur-sm z-10"
          style={{ background: accent }}>
          <Icon className="h-2.5 w-2.5" />
          {cat?.label ?? listing.category ?? listing.listing_type}
        </span>
        {listing.condition && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-white/90 backdrop-blur-sm
            px-2 py-0.5 text-[9px] font-bold text-slate-700 z-10">
            {COND_LABEL[listing.condition] ?? listing.condition}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <p className="text-[12px] font-bold leading-snug text-slate-900 line-clamp-2 mb-1.5 min-h-[2.2rem]">
          {listing.title}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-black tracking-tight" style={{ color: accent }}>
            {fmtPrice(listing.price, listing.currency)}
          </p>
          {listing.city && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <MapPin className="h-2.5 w-2.5" />{listing.city}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Skeleton card ────────────────────────────────────────── */
function BrowseSkeleton() {
  return (
    <div className="flex-shrink-0 w-[200px] overflow-hidden rounded-2xl border border-slate-200 bg-white animate-pulse">
      <div className="bg-slate-100" style={{ height: 140 }} />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded-lg bg-slate-100" />
        <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
        <div className="h-4 w-1/3 rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function ListingsPage() {
  const [filters, setFilters] = useState<ListingFilters>({ page: 1, page_size: 24 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch]       = useState('');
  const [activeCat, setActiveCat] = useState('');

  const { data, isLoading, isError, refetch } = useListings(filters);
  const listings = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;

  const activeFilterCount = [filters.category, filters.listing_type, filters.country].filter(Boolean).length;

  function set(key: keyof ListingFilters, value: string) {
    setFilters(p => ({ ...p, [key]: value || undefined, page: 1 }));
  }

  function clear() {
    setFilters({ page: 1, page_size: 24 });
    setActiveCat('');
    setSearch('');
  }

  function handleCategoryClick(cat: typeof CATEGORIES[number]) {
    setActiveCat(cat.value);
    if (cat.value === '') {
      setFilters(p => ({ ...p, category: undefined, listing_type: undefined, page: 1 }));
    } else if (['vehicle', 'property', 'service', 'job'].includes(cat.value)) {
      setFilters(p => ({ ...p, listing_type: cat.value as any, category: undefined, page: 1 }));
    } else {
      setFilters(p => ({ ...p, category: cat.value, listing_type: undefined, page: 1 }));
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters(p => ({ ...p, search: search || undefined, page: 1 }));
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Navbar />

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] py-14 sm:py-20">
        {/* Decorative blur blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h1 className="mb-3 font-black text-white"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Browse listings
          </h1>
          <p className="mb-8 text-[15px] text-white/60 max-w-md mx-auto">
            Vehicles, property, electronics, fashion and more — direct from sellers via WhatsApp.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch}
            className="mx-auto flex max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/30">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search listings…"
                className="h-14 w-full bg-transparent pl-11 pr-4 text-[15px] text-slate-800
                  placeholder-slate-400 outline-none"
              />
            </div>
            <button type="submit"
              className="flex items-center gap-2 bg-indigo-600 px-6 text-[14px] font-bold
                text-white transition-colors hover:bg-indigo-700 flex-shrink-0">
              <Search className="h-4 w-4" /> Search
            </button>
          </form>
        </div>
      </div>

      {/* ── Category pills ───────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-3 overflow-x-auto py-3"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCat === cat.value;
              return (
                <button
                  key={cat.label}
                  onClick={() => handleCategoryClick(cat)}
                  className="flex-shrink-0 flex items-center gap-2 rounded-full px-4 py-2
                    text-[13px] font-semibold transition-all border"
                  style={isActive ? {
                    background: cat.color,
                    borderColor: cat.color,
                    color: '#fff',
                  } : {
                    background: '#fff',
                    borderColor: '#e2e8f0',
                    color: '#475569',
                  }}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {cat.label}
                </button>
              );
            })}

            {/* Spacer + filter button */}
            <div className="ml-auto flex-shrink-0">
              <button
                onClick={() => setFilterOpen(v => !v)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all',
                  activeFilterCount > 0
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full
                    bg-indigo-600 text-[10px] font-black text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Expanded filter panel */}
          {filterOpen && (
            <div className="border-t border-slate-100 py-4 space-y-4 animate-fade-up">
              <div className="flex flex-wrap gap-6">
                {/* Country */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Country</p>
                  <div className="flex flex-wrap gap-2">
                    {COUNTRIES.map(({ value, label }) => (
                      <button key={label} onClick={() => set('country', value)}
                        className={cn(
                          'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all',
                          filters.country === value || (!filters.country && !value)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600',
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Sort by</p>
                  <div className="flex flex-wrap gap-2">
                    {SORT_OPTIONS.map(({ value, label }) => (
                      <button key={label} onClick={() => set('sort' as any, value)}
                        className={cn(
                          'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all',
                          (filters as any).sort === value || (!(filters as any).sort && !value)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600',
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button onClick={clear}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-red-500 hover:text-red-600 transition-colors">
                  <X className="h-3.5 w-3.5" /> Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterCount > 0 && !filterOpen && (
            <div className="flex flex-wrap gap-2 pb-3">
              {[
                filters.category && { key: 'category', label: filters.category },
                filters.listing_type && { key: 'listing_type', label: filters.listing_type },
                filters.country && { key: 'country', label: COUNTRIES.find(c => c.value === filters.country)?.label },
              ].filter(Boolean).map((chip: any) => (
                <span key={chip.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border
                    border-indigo-200 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                  {chip.label}
                  <button onClick={() => set(chip.key, '')} className="hover:text-indigo-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Listings ────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">

        {isError && (
          <div className="py-24 text-center">
            <p className="text-slate-400 mb-4 text-[14px]">Failed to load listings.</p>
            <button onClick={() => refetch()}
              className="text-[13px] font-bold text-indigo-600 hover:underline">
              Try again
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <>
            {/* Desktop: single skeleton row */}
            <div className="hidden md:flex gap-4 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => <BrowseSkeleton key={i} />)}
            </div>
            {/* Mobile: grid */}
            <div className="grid grid-cols-2 gap-3 md:hidden">
              {Array.from({ length: 8 }).map((_, i) => <BrowseSkeleton key={i} />)}
            </div>
          </>
        )}

        {/* Empty */}
        {!isLoading && !isError && listings.length === 0 && (
          <div className="py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-5">
              <Search className="h-10 w-10 text-slate-300" />
            </div>
            <p className="text-[18px] font-black text-slate-900 mb-2">No listings found</p>
            <p className="text-[14px] text-slate-400 mb-5">Try adjusting your filters or search.</p>
            <button onClick={clear}
              className="inline-flex items-center gap-2 h-10 rounded-xl bg-indigo-600 px-6
                text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors">
              Clear filters
            </button>
          </div>
        )}

        {/* Results */}
        {!isLoading && !isError && listings.length > 0 && (
          <>
            {/* Result count */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-[13px] text-slate-500">
                <span className="font-bold text-slate-900">{(meta?.total ?? listings.length).toLocaleString()}</span>
                {' '}listing{(meta?.total ?? listings.length) !== 1 ? 's' : ''} found
              </p>
              <Link href="/listings"
                className="flex items-center gap-1 text-[12px] font-semibold text-indigo-600 no-underline hover:underline">
                See all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Desktop: single continuous auto-scroll row with all listings */}
            <div className="hidden md:block">
              <AutoScrollRow speed={42}>
                {listings.map(l => (
                  <BrowseCard key={l.id} listing={l} />
                ))}
              </AutoScrollRow>
            </div>

            {/* Mobile: responsive grid */}
            <div className="grid grid-cols-2 gap-3 md:hidden">
              {listings.map(l => (
                <BrowseCard key={l.id} listing={l} />
              ))}
            </div>
          </>
        )}

        {/* Pagination (mobile-friendly, only if not using marquee on desktop) */}
        {meta && meta.total_pages > 1 && !isLoading && (
          <div className="mt-12 flex items-center justify-center gap-2 flex-wrap">
            <button
              disabled={!meta.has_prev}
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="flex items-center gap-1.5 h-10 rounded-xl border border-slate-200 px-4
                text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40
                disabled:cursor-not-allowed transition-all"
            >
              ← Prev
            </button>
            <span className="text-[13px] text-slate-500 px-2">
              Page {meta.page} of {meta.total_pages}
            </span>
            <button
              disabled={!meta.has_next}
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="flex items-center gap-1.5 h-10 rounded-xl border border-slate-200 px-4
                text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40
                disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
