'use client';

import { Suspense } from 'react';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { listingsApi, listingKeys } from '@/lib/api/endpoints/listings';
import { ListingCard, ListingCardSkeleton } from '@/components/marketplace/listing-card';
import { Navbar } from '@/components/layout/navbar';
import { cn } from '@/lib/utils/cn';

const SORT_OPTIONS = [
  { value: 'newest'    as const, label: 'Newest' },
  { value: 'price_asc' as const, label: 'Price: Low → High' },
  { value: 'price_desc'as const, label: 'Price: High → Low' },
];

const POPULAR = [
  'iPhone', 'Toyota Camry', '3-bedroom Lagos',
  'MacBook', 'Laptop', 'Fashion',
];

type SortValue = 'newest' | 'price_asc' | 'price_desc';

function SearchInner() {
  const sp     = useSearchParams();
  const router = useRouter();

  const [query,     setQuery]     = useState(sp.get('q') ?? '');
  const [committed, setCommitted] = useState(sp.get('q') ?? '');
  const [page,      setPage]      = useState(1);
  const [sort,      setSort]      = useState<SortValue>('newest');

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: listingKeys.list({ q: committed, page, page_size: 24 }),
    queryFn:  () => listingsApi.browse({ q: committed, page, page_size: 24 }),
    enabled:  committed.trim().length > 0,
    staleTime: 30_000,
  });

  // Apply client-side sort (browse returns by created_at desc)
  const raw = Array.isArray(data?.data) ? [...data.data] : [];
  const listings = sort === 'price_asc'
    ? raw.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    : sort === 'price_desc'
    ? raw.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    : raw;

  const meta = data?.meta;

  function submit(q = query) {
    const trimmed = q.trim();
    setCommitted(trimmed);
    setPage(1);
    if (trimmed) router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Navbar />

      {/* ── Search bar ─────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-200
              bg-white px-5 py-3.5 shadow-sm focus-within:border-indigo-400 transition-all">
              <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="Search for anything — cars, phones, property…"
                autoFocus
                className="flex-1 bg-transparent text-[15px] text-slate-800
                  placeholder-slate-400 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setCommitted(''); router.replace('/search'); }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                className="flex-shrink-0 rounded-xl bg-indigo-600 px-5 py-2
                  text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Popular chips — only when no active query */}
          {!committed && (
            <div className="mt-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Popular searches
              </p>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((p) => (
                  <button key={p} onClick={() => submit(p)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-1.5
                      text-[13px] text-slate-500 hover:border-indigo-300 hover:text-indigo-600
                      transition-all">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Count + sort bar */}
        {committed && (
          <div className="flex items-center justify-between flex-wrap gap-4 mb-7">
            <p className="text-[14px] text-slate-500">
              {isLoading || isFetching ? (
                <span className="text-slate-400">Searching…</span>
              ) : (
                <>
                  <span className="font-black text-slate-900">
                    {(meta?.total ?? listings.length).toLocaleString()}
                  </span>
                  {' '}result{(meta?.total ?? listings.length) !== 1 ? 's' : ''} for{' '}
                  <span className="font-semibold text-indigo-600">&ldquo;{committed}&rdquo;</span>
                </>
              )}
            </p>
            <div className="flex gap-2">
              {SORT_OPTIONS.map(({ value, label }) => (
                <button key={value} onClick={() => setSort(value)}
                  className={cn(
                    'rounded-xl px-3.5 py-2 text-[12px] font-semibold transition-all',
                    sort === value
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600',
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty start state */}
        {!committed && (
          <div className="py-24 text-center space-y-3">
            <Search className="h-14 w-14 text-slate-200 mx-auto" />
            <p className="text-[16px] font-semibold text-slate-500">Start typing to search</p>
            <p className="text-[13px] text-slate-400">Listings across Africa</p>
          </div>
        )}

        {/* Error */}
        {committed && isError && (
          <div className="py-24 text-center">
            <p className="text-[14px] text-slate-500">Search failed. Please try again.</p>
          </div>
        )}

        {/* Loading skeleton */}
        {committed && isLoading && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        )}

        {/* No results */}
        {committed && !isLoading && !isError && listings.length === 0 && (
          <div className="py-24 text-center space-y-3">
            <p className="text-[18px] font-bold text-slate-900">
              No results for &ldquo;{committed}&rdquo;
            </p>
            <p className="text-[13px] text-slate-400">
              Try different keywords or browse all listings.
            </p>
          </div>
        )}

        {/* Results grid */}
        {committed && !isLoading && listings.length > 0 && (
          <>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>

            {meta && meta.total_pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button disabled={!meta.has_prev} onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200
                    px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:text-slate-800
                    disabled:opacity-35 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="px-4 text-[13px] text-slate-400">
                  {meta.page} / {meta.total_pages}
                </span>
                <button disabled={!meta.has_next} onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200
                    px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:text-slate-800
                    disabled:opacity-35 disabled:cursor-not-allowed transition-all">
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    }>
      <SearchInner />
    </Suspense>
  );
}
