'use client';

import { useState } from 'react';
import { MagnifyingGlass, Storefront, Package, ShieldSlash, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import Link from 'next/link';

interface SellerRow {
  id: string;
  name: string;
  email: string;
  store_name: string;
  status: string;
  total_listings: number;
  active_listings: number;
  is_active?: boolean;
}

export default function ModStoresPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mod', 'stores'],
    queryFn: async (): Promise<SellerRow[]> => {
      // Fetch all sellers from the admin stores endpoint
      const res = await apiClient.get<ApiResponse<any[]>>('/admin/stores', {
        params: { page_size: 100 },
      });
      const stores = Array.isArray(res.data?.data) ? res.data.data : [];
      return stores.map((s: any) => ({
        id: String(s.id || s.seller_id || ''),
        name: s.name || s.full_name || 'Seller',
        email: s.email || '',
        store_name: s.store_name || `${s.name || 'Seller'}'s Storefront`,
        status: s.status || (s.is_active === false ? 'suspended' : 'active'),
        is_active: s.status !== 'suspended' && s.is_active !== false,
        total_listings: s.total_listings || 0,
        active_listings: s.active_listings || 0,
      }));
    },
    enabled: session.isAuthenticated,
    staleTime: 30_000,
    retry: false,
  });

  const suspendMutation = useMutation({
    mutationFn: (sellerId: string) =>
      apiClient.patch(`/users/admin/${sellerId}`, { is_active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mod', 'stores'] });
      setActionError('');
    },
    onError: (err: any) => setActionError(err?.message || 'Failed to suspend seller.'),
  });

  const restoreMutation = useMutation({
    mutationFn: (sellerId: string) =>
      apiClient.patch(`/users/admin/${sellerId}`, { is_active: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mod', 'stores'] });
      setActionError('');
    },
    onError: (err: any) => setActionError(err?.message || 'Failed to restore seller.'),
  });

  const sellers: SellerRow[] = data ?? [];

  const filtered = sellers.filter((s) => {
    if (filter === 'active' && s.status !== 'active') return false;
    if (filter === 'suspended' && s.status !== 'suspended') return false;
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

  const counts = {
    all: sellers.length,
    active: sellers.filter((s) => s.status === 'active').length,
    suspended: sellers.filter((s) => s.status === 'suspended').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Storefront Management</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {isLoading ? 'Loading…' : `${sellers.length} seller${sellers.length !== 1 ? 's' : ''} registered`}
        </p>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <WarningCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-[13px] font-medium text-red-600">{actionError}</p>
          <button onClick={() => setActionError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(['all', 'active', 'suspended'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
                filter === s
                  ? 'bg-amber-500 text-white'
                  : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              {s}
              {s !== 'all' && counts[s] > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === s ? 'bg-white/20' : 'bg-slate-100'
                }`}>{counts[s]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sellers…"
            className="h-9 w-52 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-amber-400 transition-all"
          />
        </div>
      </div>

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
            <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Storefront className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">
            {search ? `No results for "${search}"` : filter !== 'all' ? `No ${filter} sellers` : 'No sellers yet'}
          </p>
          <p className="text-[13px] text-slate-400">
            {search || filter !== 'all' ? 'Try a different filter.' : 'Sellers appear here once they post a listing.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {filtered.map((seller) => {
            const isSuspended = seller.status === 'suspended';
            const isPending = suspendMutation.isPending || restoreMutation.isPending;
            return (
              <div
                key={seller.id}
                className="flex flex-wrap lg:flex-nowrap items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[13px] font-bold text-amber-700 uppercase">
                  {seller.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-900 truncate">{seller.name}</p>
                  {seller.email && (
                    <p className="text-[11px] text-slate-400 truncate">{seller.email}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-1.5 text-[12px] text-slate-500 shrink-0">
                  <Package className="h-3.5 w-3.5 text-slate-400" />
                  <span>{seller.total_listings} total</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-emerald-600 font-semibold">{seller.active_listings} active</span>
                </div>

                {/* Status badge */}
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize shrink-0 ${
                  isSuspended
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                  {isSuspended ? 'Suspended' : 'Active'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/listings?seller_id=${seller.id}`}
                    className="h-7 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors no-underline flex items-center"
                  >
                    View
                  </Link>
                  <button
                    onClick={() =>
                      isSuspended
                        ? restoreMutation.mutate(seller.id)
                        : suspendMutation.mutate(seller.id)
                    }
                    disabled={isPending}
                    className={`flex items-center gap-1 h-7 rounded-lg border px-2 text-[11px] font-semibold transition-all disabled:opacity-40 ${
                      isSuspended
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    {isSuspended ? (
                      <><ShieldCheck className="h-3 w-3" /> Restore</>
                    ) : (
                      <><ShieldSlash className="h-3 w-3" /> Suspend</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}