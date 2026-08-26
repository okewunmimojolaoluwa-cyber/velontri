'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, X, CaretLeft, CaretRight, SlidersHorizontal, Clock, TrendUp, MapPin, Tag, Lightning } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import { listingKeys } from '@/lib/api/endpoints/listings';
import { ListingCard, ListingCardSkeleton } from '@/components/marketplace/listing-card';
import { Navbar } from '@/components/layout/navbar';
import { cn } from '@/lib/utils/cn';
import type { ApiResponse } from '@/types/api';

/* ─── Types ──────────────────────────────────────────────── */
interface SearchResult {
  id: string; title: string; price: number; currency: string;
  category: string; listing_type: string; condition?: string;
  city?: string; country?: string; image_url?: string; media_urls?: string[];
  avg_rating?: number; review_count?: number; seller_id?: string; status?: string;
  seller_verified?: boolean;
}

type SortValue = 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'newest',     label: 'Newest' },
  { value: 'price_asc',  label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
];

const CATEGORIES = [
  'Electronics', 'Fashion', 'Vehicles', 'Property', 'Furniture',
  'Agriculture', 'Services', 'Jobs', 'Sports', 'Other',
];

const CONDITIONS = ['new', 'fairly used', 'used', 'refurbished'];

const TRENDING = [
  'iPhone 15', 'Toyota Camry', '3-bedroom Lagos',
  'MacBook Pro', 'Ankara fabric', 'Generator',
];

const RECENT_KEY = 'velontri_recent_searches';
const MAX_RECENT = 6;

/* ─── Hooks ──────────────────────────────────────────────── */
function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      setRecent(Array.isArray(stored) ? stored.slice(0, MAX_RECENT) : []);
    } catch { setRecent([]); }
  }, []);

  const add = useCallback((term: string) => {
    if (!term.trim()) return;
    setRecent(prev => {
      const next = [term, ...prev.filter(r => r.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const remove = useCallback((term: string) => {
    setRecent(prev => {
      const next = prev.filter(r => r !== term);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { recent, add, remove };
}

/* ─── Autocomplete dropdown ──────────────────────────────── */
function AutocompleteDropdown({
  prefix, onSelect, recent, onRemoveRecent, visible,
}: {
  prefix: string;
  onSelect: (q: string) => void;
  recent: string[];
  onRemoveRecent: (q: string) => void;
  visible: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['search-autocomplete', prefix],
    queryFn: async () => {
      if (prefix.length < 2) return [];
      try {
        const res = await apiClient.get<ApiResponse<{ suggestions: string[] }>>(
          `/search/autocomplete`, { params: { q: prefix } }
        );
        return res.data?.data?.suggestions ?? [];
      } catch { return []; }
    },
    enabled: prefix.length >= 2,
    staleTime: 10_000,
  });

  const suggestions: string[] = data ?? [];
  const showRecent  = prefix.length < 2 && recent.length > 0;
  const showSuggest = prefix.length >= 2 && suggestions.length > 0;

  if (!visible || (!showRecent && !showSuggest)) return null;

  return (
    <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-slate-200
      bg-white shadow-xl overflow-hidden dark:bg-[#1c1c1c] dark:border-[#2a2a2a]">
      {showRecent && (
        <div className="p-2">
          <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Recent
          </p>
          {recent.map(r => (
            <div key={r} className="flex items-center group">
              <button onClick={() => onSelect(r)}
                className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left
                  text-[13px] text-slate-700 hover:bg-slate-50 transition-colors
                  dark:text-slate-300 dark:hover:bg-[#242424]">
                <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                {r}
              </button>
              <button onClick={e => { e.stopPropagation(); onRemoveRecent(r); }}
                className="p-2 mr-1 text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-all">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {showSuggest && (
        <div className="p-2">
          <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
            <Lightning className="h-3 w-3" /> Suggestions
          </p>
          {suggestions.slice(0, 8).map(s => (
            <button key={s} onClick={() => onSelect(s)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left
                text-[13px] text-slate-700 hover:bg-slate-50 transition-colors
                dark:text-slate-300 dark:hover:bg-[#242424]">
              <MagnifyingGlass className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span dangerouslySetInnerHTML={{
                __html: s.replace(
                  new RegExp(`(${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                  '<strong>$1</strong>'
                )
              }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Funnel bar ─────────────────────────────────────────── */
function FilterBar({
  category, condition, minPrice, maxPrice,
  onChange, open, onToggle,
}: {
  category: string; condition: string; minPrice: string; maxPrice: string;
  onChange: (k: string, v: string) => void;
  open: boolean; onToggle: () => void;
}) {
  const hasFilters = !!(category || condition || minPrice || maxPrice);

  return (
    <div className="border-b border-slate-100 bg-white dark:bg-[#1c1c1c] dark:border-[#222]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Toggle row */}
        <div className="flex items-center gap-3 py-2.5">
          <button onClick={onToggle}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition-all',
              open || hasFilters
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-[#2a2a2a] dark:text-slate-400'
            )}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {hasFilters && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/30 text-[10px] font-black">
                {[category, condition, minPrice, maxPrice].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Active filter chips */}
          {category && (
            <button onClick={() => onChange('category', '')}
              className="flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1
                text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors
                dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-400">
              <Tag className="h-3 w-3" /> {category} <X className="h-2.5 w-2.5 ml-0.5" />
            </button>
          )}
          {condition && (
            <button onClick={() => onChange('condition', '')}
              className="flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1
                text-[11px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors
                dark:bg-[#242424] dark:border-[#333] dark:text-slate-400">
              {condition} <X className="h-2.5 w-2.5 ml-0.5" />
            </button>
          )}
          {(minPrice || maxPrice) && (
            <button onClick={() => { onChange('minPrice', ''); onChange('maxPrice', ''); }}
              className="flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1
                text-[11px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors
                dark:bg-[#242424] dark:border-[#333] dark:text-slate-400">
              ₦{minPrice||'0'} – {maxPrice ? `₦${maxPrice}` : '∞'} <X className="h-2.5 w-2.5 ml-0.5" />
            </button>
          )}
          {hasFilters && (
            <button onClick={() => { onChange('category',''); onChange('condition',''); onChange('minPrice',''); onChange('maxPrice',''); }}
              className="ml-auto text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors">
              Clear all
            </button>
          )}
        </div>

        {/* Expanded panel */}
        {open && (
          <div className="pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Category</label>
              <select value={category} onChange={e => onChange('category', e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px]
                  text-slate-700 focus:border-indigo-400 focus:outline-none
                  dark:bg-[#1c1c1c] dark:border-[#333] dark:text-slate-300">
                <option value="">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Condition</label>
              <select value={condition} onChange={e => onChange('condition', e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px]
                  text-slate-700 focus:border-indigo-400 focus:outline-none
                  dark:bg-[#1c1c1c] dark:border-[#333] dark:text-slate-300">
                <option value="">Any condition</option>
                {CONDITIONS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Min price (₦)</label>
              <input type="number" min="0" value={minPrice} onChange={e => onChange('minPrice', e.target.value)}
                placeholder="0"
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px]
                  text-slate-700 focus:border-indigo-400 focus:outline-none
                  dark:bg-[#1c1c1c] dark:border-[#333] dark:text-slate-300" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Max price (₦)</label>
              <input type="number" min="0" value={maxPrice} onChange={e => onChange('maxPrice', e.target.value)}
                placeholder="Any"
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px]
                  text-slate-700 focus:border-indigo-400 focus:outline-none
                  dark:bg-[#1c1c1c] dark:border-[#333] dark:text-slate-300" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main search logic ──────────────────────────────────── */
function SearchInner() {
  const sp     = useSearchParams();
  const router = useRouter();

  const [query,      setQuery]      = useState(sp.get('q') ?? '');
  const [committed,  setCommitted]  = useState(sp.get('q') ?? '');
  const cityParam = sp.get('city') ?? '';
  const [page,       setPage]       = useState(1);
  const [sort,       setSort]       = useState<SortValue>('newest');
  const [dropOpen,   setDropOpen]   = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [category,   setCategory]   = useState('');
  const [condition,  setCondition]  = useState('');
  const [minPrice,   setMinPrice]   = useState('');
  const [maxPrice,   setMaxPrice]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const { recent, add: addRecent, remove: removeRecent } = useRecentSearches();

  // Debounce for instant-search
  const debouncedQuery = useDebounce(query, 320);

  // Auto-commit as user types (instant search)
  useEffect(() => {
    const t = debouncedQuery.trim();
    if (t && t !== committed) {
      setCommitted(t);
      setPage(1);
    }
  }, [debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Funnel change handler
  function handleFilterChange(k: string, v: string) {
    if (k === 'category') setCategory(v);
    else if (k === 'condition') setCondition(v);
    else if (k === 'minPrice') setMinPrice(v);
    else if (k === 'maxPrice') setMaxPrice(v);
    setPage(1);
  }

  // Build search params
  const searchParams = {
    q: committed,
    page,
    page_size: 24,
    sort_by: sort,
    ...(category   ? { category }   : {}),
    ...(condition  ? { condition }  : {}),
    ...(minPrice   ? { price_min: Number(minPrice) } : {}),
    ...(maxPrice   ? { price_max: Number(maxPrice) } : {}),
    ...(cityParam  ? { city: cityParam } : {}),
  };

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['smart-search', searchParams],
    queryFn: async () => {
      // Try the dedicated smart search endpoint first
      try {
        const res = await apiClient.get<ApiResponse<SearchResult[]>>(
          '/search', { params: searchParams }
        );
        if (res.data?.data) return res.data;
      } catch {}
      // Fallback to listings browse
      try {
        const res = await apiClient.get<ApiResponse<SearchResult[]>>(
          '/listings', { params: { q: committed, page, page_size: 24 } }
        );
        return res.data;
      } catch {}
      return { data: [], meta: null, message: '' };
    },
    enabled: committed.trim().length > 0,
    staleTime: 20_000,
    placeholderData: (prev: any) => prev,  // keep previous results while refetching
  });

  // Client-side sort
  const raw = Array.isArray(data?.data) ? [...data.data] : [];
  const listings = sort === 'price_asc'
    ? raw.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    : sort === 'price_desc'
    ? raw.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    : raw;

  const meta = (data as any)?.meta;

  function commit(q: string) {
    const t = q.trim();
    setQuery(t);
    setCommitted(t);
    setPage(1);
    setDropOpen(false);
    if (t) {
      addRecent(t);
      router.replace(`/search?q=${encodeURIComponent(t)}`);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')   { commit(query); }
    if (e.key === 'Escape')  { setDropOpen(false); inputRef.current?.blur(); }
  }

  const isTyping = query !== committed && query.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Navbar />

      {/* ── MagnifyingGlass header ──────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white dark:bg-[#1c1c1c] dark:border-[#2a2a2a]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6">

          {/* Bar */}
          <div ref={wrapRef} className="relative">
            <div className={cn(
              'flex items-center gap-2 rounded-2xl border-2 bg-white px-4 py-3',
              'shadow-sm transition-all duration-200',
              dropOpen
                ? 'border-indigo-500 shadow-indigo-100/60 shadow-lg'
                : 'border-slate-200 focus-within:border-indigo-400',
              'dark:bg-[#1c1c1c] dark:border-[#333] dark:focus-within:border-indigo-500',
            )}>
              {isLoading || isFetching
                ? <svg className="h-5 w-5 text-indigo-500 flex-shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"
                      strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                  </svg>
                : <MagnifyingGlass className="h-5 w-5 text-slate-400 flex-shrink-0" />
              }
              <input
                ref={inputRef}
                type="text"
                value={query}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
                onFocus={() => setDropOpen(true)}
                onKeyDown={handleKey}
                placeholder="MagnifyingGlass for anything — phones, cars, property, fashion…"
                className="flex-1 bg-transparent text-[15px] text-slate-800 placeholder-slate-400
                  focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
              />
              {query && (
                <button type="button"
                  onClick={() => { setQuery(''); setCommitted(''); setDropOpen(false); router.replace('/search'); }}
                  className="text-slate-300 hover:text-slate-600 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => commit(query)}
                className="flex-shrink-0 rounded-xl bg-indigo-600 px-5 py-2.5
                  text-[13px] font-bold text-white hover:bg-indigo-700 active:scale-[0.98]
                  transition-all">
                MagnifyingGlass
              </button>
            </div>

            {/* Autocomplete dropdown */}
            <AutocompleteDropdown
              prefix={query}
              onSelect={commit}
              recent={recent}
              onRemoveRecent={removeRecent}
              visible={dropOpen}
            />
          </div>

          {/* Trending chips */}
          {!committed && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                <TrendUp className="h-3 w-3" /> Trending
              </p>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map(t => (
                  <button key={t} onClick={() => commit(t)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5
                      text-[12px] font-medium text-slate-500
                      hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50
                      transition-all dark:bg-[#1c1c1c] dark:border-[#333] dark:text-slate-400
                      dark:hover:border-indigo-500 dark:hover:text-indigo-400">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Funnel bar ─────────────────────────────────────── */}
      {committed && (
        <FilterBar
          category={category} condition={condition}
          minPrice={minPrice} maxPrice={maxPrice}
          onChange={handleFilterChange}
          open={filterOpen} onToggle={() => setFilterOpen(f => !f)}
        />
      )}

      {/* ── Results ────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-7">

        {/* Count + sort */}
        {committed && (
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              {isLoading ? (
                <div className="h-5 w-40 rounded-full bg-slate-200 animate-pulse dark:bg-[#242424]" />
              ) : (
                <p className="text-[14px] text-slate-500">
                  <span className="font-black text-slate-900 dark:text-slate-100">
                    {(meta?.total ?? listings.length).toLocaleString()}
                  </span>
                  {' '}result{(meta?.total ?? listings.length) !== 1 ? 's' : ''} for{' '}
                  <span className="font-semibold text-indigo-600">&ldquo;{committed}&rdquo;</span>
                  {isFetching && !isLoading && (
                    <span className="ml-2 text-[11px] text-slate-400 animate-pulse">updating…</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-1.5">
              {SORT_OPTIONS.map(({ value, label }) => (
                <button key={value} onClick={() => setSort(value)}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all',
                    sort === value
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-[#2a2a2a] dark:text-slate-400',
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty start state */}
        {!committed && (
          <div className="py-20 text-center space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 mx-auto dark:bg-indigo-950/40">
              <MagnifyingGlass className="h-8 w-8 text-indigo-400" />
            </div>
            <p className="text-[16px] font-bold text-slate-800 dark:text-slate-200">MagnifyingGlass Velontri</p>
            <p className="text-[13px] text-slate-400 max-w-xs mx-auto">
              Find listings across Africa — type anything and results appear instantly.
            </p>
          </div>
        )}

        {/* Error */}
        {committed && isError && (
          <div className="py-16 text-center space-y-2">
            <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-300">MagnifyingGlass failed</p>
            <p className="text-[13px] text-slate-400">Please check your connection and try again.</p>
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
          <div className="py-16 text-center space-y-5">
            {/* Icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mx-auto dark:bg-[#242424]">
              <MagnifyingGlass className="h-8 w-8 text-slate-300" />
            </div>

            <div>
              <p className="text-[20px] font-black text-slate-900 dark:text-slate-100 mb-1">
                No results for &ldquo;{committed}&rdquo;
              </p>
              <p className="text-[13px] text-slate-400 max-w-sm mx-auto">
                We searched across listings, categories and synonyms — nothing matched exactly.
              </p>
            </div>

            {/* Smart suggestions from backend */}
            {(meta?.suggestions ?? []).length > 0 && (
              <div className="max-w-lg mx-auto">
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-center gap-1.5">
                  <Lightning className="h-3 w-3 text-indigo-500" />
                  Did you mean one of these?
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {(meta.suggestions as string[]).map((s: string) => (
                    <button key={s} onClick={() => commit(s)}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2
                        text-[13px] font-semibold text-indigo-700
                        hover:bg-indigo-100 hover:border-indigo-300 transition-all
                        dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Browse by category */}
            <div className="max-w-lg mx-auto">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Or browse by category
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  { label: 'Vehicles 🚗',     q: 'vehicle' },
                  { label: 'Property 🏠',     q: 'property' },
                  { label: 'Electronics 📱',  q: 'phone' },
                  { label: 'Fashion 👗',      q: 'fashion' },
                  { label: 'Jobs 💼',         q: 'jobs' },
                  { label: 'Services 🔧',     q: 'services' },
                ].map(({ label, q: cq }) => (
                  <button key={label} onClick={() => commit(cq)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5
                      text-[12px] font-medium text-slate-500
                      hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50
                      transition-all dark:bg-[#1c1c1c] dark:border-[#333] dark:text-slate-400">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trending fallback */}
            <div className="max-w-lg mx-auto pt-2 border-t border-slate-100 dark:border-[#2a2a2a]">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-center gap-1.5">
                <TrendUp className="h-3 w-3" /> Trending right now
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {TRENDING.map(t => (
                  <button key={t} onClick={() => commit(t)}
                    className="rounded-full border border-slate-200 px-3.5 py-1.5 text-[12px]
                      font-medium text-slate-500 hover:text-indigo-600 hover:border-indigo-300
                      hover:bg-indigo-50 transition-all
                      dark:border-[#333] dark:text-slate-400 dark:hover:text-indigo-400">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results grid */}
        {committed && !isLoading && listings.length > 0 && (
          <>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {listings.map((l: any) => <ListingCard key={l.id} listing={l} />)}
            </div>

            {meta && meta.total_pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button disabled={!meta.has_prev} onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200
                    px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:text-slate-800
                    disabled:opacity-35 disabled:cursor-not-allowed transition-all
                    dark:border-[#2a2a2a] dark:text-slate-400">
                  <CaretLeft className="h-4 w-4" /> Previous
                </button>
                <span className="px-4 text-[13px] text-slate-400">
                  {meta.page} / {meta.total_pages}
                </span>
                <button disabled={!meta.has_next} onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200
                    px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:text-slate-800
                    disabled:opacity-35 disabled:cursor-not-allowed transition-all
                    dark:border-[#2a2a2a] dark:text-slate-400">
                  Next <CaretRight className="h-4 w-4" />
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
        <svg className="h-8 w-8 text-indigo-600 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor"
            strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
        </svg>
      </div>
    }>
      <SearchInner />
    </Suspense>
  );
}