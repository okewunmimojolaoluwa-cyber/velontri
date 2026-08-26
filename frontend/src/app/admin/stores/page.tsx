'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Storefront, Package, MagnifyingGlass, ShieldSlash, ShieldCheck } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface SellerRow {
  id: string;
  name: string;
  email: string;
  store_name: string;
  status: string;
  kyc_verified: boolean;
  total_listings: number;
  active_listings: number;
  currency: string;
}

export default function AdminStoresPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stores'],
    queryFn: () =>
      apiClient.get<ApiResponse<SellerRow[]>>('/admin/stores', { params: { page_size: 100 } })
        .then(r => r.data),
    staleTime: 30_000,
  });

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/users/admin/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'stores'] }),
    onError: (e: any) => {
      alert(e?.response?.data?.error?.message || e?.message || 'Failed to update status.');
    },
  });

  const allSellers: SellerRow[] = Array.isArray(data?.data) ? data.data : [];

  const filtered = allSellers.filter(s => {
    if (filter === 'active' && s.status !== 'active') return false;
    if (filter === 'suspended' && s.status === 'active') return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.store_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: allSellers.length,
    active: allSellers.filter(s => s.status === 'active').length,
    suspended: allSellers.filter(s => s.status !== 'active').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Storefront Management</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {isLoading ? 'Loading…' : `${allSellers.length} seller${allSellers.length !== 1 ? 's' : ''} with listings`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(['all', 'active', 'suspended'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-xl px-3.5 py-2 text-[12px] font-semibold capitalize transition-all ${
                filter === s
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              {s}
              {counts[s] > 0 && s !== 'all' && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === s ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="MagnifyingGlass sellers…"
            className="h-10 w-56 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px]
              text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 transition-all"
          />
        </div>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load stores</p>
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
          <Storefront className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">
            {search ? `No results for "${search}"` : filter !== 'all' ? `No ${filter} sellers` : 'No sellers yet'}
          </p>
          <p className="text-[13px] text-slate-400">Sellers appear here once they post a listing.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden lg:grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            {['Seller', 'Storefront', 'Total', 'Active', 'Status', 'Action'].map(h => (
              <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
            ))}
          </div>
          <ul className="divide-y divide-slate-100">
            {filtered.map(seller => (
              <li key={seller.id}
                className="hover:bg-slate-50 transition-colors">

                {/* ── Mobile card ── */}
                <div className="lg:hidden p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[14px] font-bold text-indigo-700 uppercase">
                      {seller.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-bold text-slate-900 truncate">{seller.name}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          seller.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-red-50 text-red-600 border-red-100'
                        }`}>
                          {seller.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                      {seller.email && <p className="text-[12px] text-slate-400 truncate mt-0.5">{seller.email}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                    <div>
                      <p className="font-bold uppercase tracking-wide text-slate-400 text-[10px] mb-0.5">Storefront</p>
                      <p className="text-slate-700 truncate">{seller.store_name}</p>
                    </div>
                    <div>
                      <p className="font-bold uppercase tracking-wide text-slate-400 text-[10px] mb-0.5">Total listings</p>
                      <p className="text-slate-700">{seller.total_listings}</p>
                    </div>
                    <div>
                      <p className="font-bold uppercase tracking-wide text-slate-400 text-[10px] mb-0.5">Active listings</p>
                      <p className="text-emerald-600 font-semibold">{seller.active_listings}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggle({ id: seller.id, active: seller.status !== 'active' })}
                    className={`w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border text-[12px] font-semibold transition-all ${
                      seller.status === 'active'
                        ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}>
                    {seller.status === 'active'
                      ? <><ShieldSlash className="h-3.5 w-3.5" /> Suspend Seller</>
                      : <><ShieldCheck className="h-3.5 w-3.5" /> Restore Seller</>}
                  </button>
                </div>

                {/* ── Desktop row ── */}
                <div className="hidden lg:grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-4 items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[13px] font-bold text-indigo-700 uppercase">
                      {seller.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 truncate">{seller.name}</p>
                      {seller.email && <p className="text-[11px] text-slate-400 truncate">{seller.email}</p>}
                    </div>
                  </div>
                  <p className="text-[13px] text-slate-600 truncate">{seller.store_name}</p>
                  <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
                    <Package className="h-3.5 w-3.5 text-slate-400" />
                    {seller.total_listings}
                  </div>
                  <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {seller.active_listings} active
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize shrink-0 ${
                    seller.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    {seller.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                  <button
                    onClick={() => toggle({ id: seller.id, active: seller.status !== 'active' })}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 ${
                      seller.status === 'active'
                        ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}>
                    {seller.status === 'active'
                      ? <><ShieldSlash className="h-3 w-3" /> Suspend</>
                      : <><ShieldCheck className="h-3 w-3" /> Restore</>}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}