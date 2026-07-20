'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store, Package, Search, Star, ShieldOff, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface SellerRow {
  id: string;
  name: string;
  email: string;
  store_name: string;
  status: string;
  kyc_verified: boolean;
  total_sales: number;
  currency: string;
  total_listings: number;
  active_listings: number;
  rating: number;
}

export default function AdminStoresPage() {
  const [filter, setFilter]   = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [search, setSearch]   = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'sellers-from-listings'],
    queryFn: async (): Promise<SellerRow[]> => {
      // Use public browse endpoint (always live)
      const listingsRes = await apiClient.get<ApiResponse<any[]>>('/listings', {
        params: { page_size: 50 },
      });
      const listings = Array.isArray(listingsRes.data?.data) ? listingsRes.data.data : [];
      if (listings.length === 0) return [];

      // Try to enrich with real user names
      const userNameMap = new Map<string, { name: string; email: string }>();
      try {
        const usersRes = await apiClient.get<ApiResponse<any[]>>('/users/admin/list', {
          params: { page_size: 50 },
        });
        const users = Array.isArray(usersRes.data?.data) ? usersRes.data.data : [];
        for (const u of users) {
          userNameMap.set(String(u.id), {
            name: u.full_name || u.email || 'Seller',
            email: u.email || '',
          });
        }
      } catch { /* users/admin/list may 401 — proceed with IDs */ }

      // Group by seller
      const sellerMap = new Map<string, SellerRow>();
      for (const l of listings) {
        const sid = String(l.seller_id);
        if (!sellerMap.has(sid)) {
          const info = userNameMap.get(sid) ?? { name: 'Seller', email: '' };
          sellerMap.set(sid, {
            id: sid,
            name: info.name,
            email: info.email,
            store_name: `${info.name}'s Store`,
            status: 'active',
            kyc_verified: true,
            total_sales: 0,
            currency: 'NGN',
            total_listings: 0,
            active_listings: 0,
            rating: 0,
          });
        }
        const s = sellerMap.get(sid)!;
        s.total_listings += 1;
        if (l.status === 'active') s.active_listings += 1;
      }
      return Array.from(sellerMap.values());
    },
    staleTime: 30_000,
    retry: 1,
  });

  const sellers = data ?? [];

  // Apply status overrides (local suspend/restore)
  const withStatus = sellers.map(s => ({
    ...s,
    status: overrides[s.id] ?? s.status,
  }));

  // Filter by status + search
  const filtered = withStatus.filter(s => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.store_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function toggleStatus(id: string, current: string) {
    setOverrides(prev => ({ ...prev, [id]: current === 'active' ? 'suspended' : 'active' }));
  }

  // Count by status for filter badges
  const counts = {
    all: withStatus.length,
    active: withStatus.filter(s => s.status === 'active').length,
    suspended: withStatus.filter(s => s.status === 'suspended').length,
    pending: withStatus.filter(s => s.status === 'pending').length,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Store Management</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {isLoading ? 'Loading…' : `${sellers.length} seller${sellers.length !== 1 ? 's' : ''} with active listings`}
        </p>
      </div>

      {/* Filter + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(['all', 'active', 'suspended', 'pending'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-xl px-3.5 py-2 text-[12px] font-semibold capitalize transition-all ${
                filter === s
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              {s}
              {counts[s] > 0 && s !== 'all' && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === s ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {counts[s]}
                </span>
              )}
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

      {/* Table / States */}
      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load stores</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
            {search
              ? `No results for "${search}"`
              : filter !== 'all'
              ? `No ${filter} sellers`
              : 'No sellers found'}
          </p>
          <p className="text-[13px] text-slate-400">
            {search || filter !== 'all'
              ? 'Try a different filter or search term.'
              : 'Sellers appear here once they post a listing.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden lg:grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            {['Seller', 'Store', 'Total', 'Active', 'Rating', 'Status', 'Action'].map(h => (
              <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
            ))}
          </div>
          <ul className="divide-y divide-slate-100">
            {filtered.map(seller => (
              <li key={seller.id}
                className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 lg:gap-4
                  px-5 py-4 items-center hover:bg-slate-50 transition-colors">

                {/* Seller */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full
                    bg-indigo-100 text-[13px] font-bold text-indigo-700 uppercase">
                    {seller.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-slate-900 truncate">{seller.name}</p>
                    {seller.email && (
                      <p className="text-[11px] text-slate-400 truncate">{seller.email}</p>
                    )}
                  </div>
                </div>

                {/* Store */}
                <p className="text-[13px] text-slate-600 truncate">{seller.store_name}</p>

                {/* Total */}
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
                <span className="flex items-center gap-1 text-[13px] text-slate-400 font-semibold">
                  <Star className="h-3.5 w-3.5 text-slate-300" /> —
                </span>

                {/* Status badge */}
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize shrink-0 ${
                  seller.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : seller.status === 'suspended'
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {seller.status}
                </span>

                {/* Action */}
                <button
                  onClick={() => toggleStatus(seller.id, seller.status)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold
                    transition-all shrink-0 ${
                      seller.status === 'active'
                        ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                >
                  {seller.status === 'active'
                    ? <><ShieldOff className="h-3 w-3" /> Suspend</>
                    : <><ShieldCheck className="h-3 w-3" /> Restore</>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
