'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store, Package, Search, Star } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface AdminSeller {
  id: string; name: string; email: string; store_name: string;
  status: string; kyc_verified: boolean; total_sales: number;
  currency: string; total_listings: number; active_listings: number;
  rating: number;
}

function fmt(n: number) {
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n); }
  catch { return `₦${n.toLocaleString()}`; }
}

export default function AdminSellersPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stores', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<AdminSeller[]>>(`/admin/stores?status=${filter}`).then(r => r.data),
    staleTime: 60_000,
  });

  const sellers = Array.isArray(data?.data) ? data.data : [];
  const filtered = search
    ? sellers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.store_name.toLowerCase().includes(search.toLowerCase()))
    : sellers;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Seller Management</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {data?.meta?.total != null ? `${data.meta.total} seller${data.meta.total !== 1 ? 's' : ''} with listings` : 'Manage all seller accounts'}
          </p>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(['all', 'active', 'suspended', 'pending'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-xl px-3.5 py-2 text-[12px] font-semibold capitalize transition-all ${
                filter === s ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-500 hover:border-indigo-300'
              }`}>
              {s}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sellers…"
            className="h-10 w-56 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px]
              text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 transition-all" />
        </div>
      </div>

      {/* States */}
      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load sellers</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 animate-pulse">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded-lg bg-slate-100" />
                <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Store className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">
            {search ? `No results for "${search}"` : 'No sellers found'}
          </p>
          <p className="text-[13px] text-slate-400">
            {search ? 'Try different search terms.' : 'Sellers appear here once they post a listing.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden lg:grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            {['Seller', 'Store', 'Listings', 'Active', 'Rating', 'Status'].map(h => (
              <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
            ))}
          </div>
          <ul className="divide-y divide-slate-100">
            {filtered.map(seller => (
              <li key={seller.id}
                className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-3 lg:gap-4
                  px-5 py-4 items-center hover:bg-slate-50 transition-colors">

                {/* Seller */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full
                    bg-indigo-100 text-[13px] font-bold text-indigo-700 uppercase">
                    {seller.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-900">{seller.name}</p>
                    <p className="text-[11px] text-slate-400">{seller.email}</p>
                  </div>
                </div>

                {/* Store */}
                <p className="text-[13px] text-slate-600">{seller.store_name}</p>

                {/* Total listings */}
                <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
                  <Package className="h-3.5 w-3.5 text-slate-400" />
                  {seller.total_listings}
                </div>

                {/* Active */}
                <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5
                  text-[11px] font-semibold text-emerald-700">
                  {seller.active_listings} active
                </span>

                {/* Rating */}
                <span className="flex items-center gap-1 text-[13px] text-amber-600 font-semibold">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {seller.rating?.toFixed(1) ?? '—'}
                </span>

                {/* Status */}
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${
                  seller.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : seller.status === 'suspended'
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {seller.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
