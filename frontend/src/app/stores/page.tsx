'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store, Star, BadgeCheck, Search } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import Link from 'next/link';

interface StoreItem {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  listings_count: number;
  rating?: number;
  verified?: boolean;
  owner_id?: string;
}

function fmt(n: number) {
  return n.toLocaleString();
}

export default function StoresPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public', 'stores', search],
    queryFn: () =>
      apiClient
        .get<ApiResponse<StoreItem[]>>('/stores', { params: { search: search || undefined, page_size: 50 } })
        .then(r => r.data)
        .catch(() => ({ data: [] as StoreItem[], meta: null, success: true, message: '' })),
    staleTime: 60_000,
  });

  const stores: StoreItem[] = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Navbar />

      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-[2rem] font-black text-slate-900 tracking-tight mb-1">Browse Stores</h1>
          <p className="text-[14px] text-slate-500">Discover trusted sellers and their collections</p>

          {/* Search */}
          <div className="relative mt-5 max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search stores…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[14px]
                text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400
                focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse">
                <div className="h-16 w-16 rounded-full bg-slate-100 mb-4" />
                <div className="h-5 w-2/3 rounded-lg bg-slate-100 mb-2" />
                <div className="h-4 w-full rounded-lg bg-slate-100 mb-4" />
                <div className="h-10 w-full rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <Store className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-[15px] font-semibold text-slate-900 mb-1">
              {search ? `No results for "${search}"` : 'No stores yet'}
            </p>
            <p className="text-[13px] text-slate-400">
              {search ? (
                <button onClick={() => setSearch('')} className="text-indigo-600 hover:underline font-semibold">
                  Clear search
                </button>
              ) : 'Stores will appear here once sellers create them.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map(store => (
              <div key={store.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm
                  transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-slate-100
                      flex items-center justify-center text-xl font-black text-slate-400">
                      {store.logo_url
                        ? <img src={store.logo_url} alt={store.name} className="h-full w-full object-cover" />
                        : store.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-bold text-slate-900 truncate">{store.name}</p>
                        {store.verified && <BadgeCheck className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
                      </div>
                      <p className="text-[12px] text-slate-400">{fmt(store.listings_count)} listings</p>
                    </div>
                  </div>

                  {store.description && (
                    <p className="text-[13px] text-slate-600 line-clamp-2 mb-4">{store.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    {store.rating ? (
                      <span className="flex items-center gap-1 text-[12px] text-slate-500">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {store.rating.toFixed(1)}
                      </span>
                    ) : <span />}
                    <Link
                      href={`/listings?seller_id=${store.owner_id ?? store.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4
                        text-[12px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
                      <Store className="h-3.5 w-3.5" /> Visit Store
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
