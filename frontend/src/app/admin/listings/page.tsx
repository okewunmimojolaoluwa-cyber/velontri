'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Search, CheckCircle, XCircle, Eye } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

const STATUS_CLS: Record<string, string> = {
  active:         'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending_review: 'bg-amber-50  text-amber-700  border-amber-100',
  pending:        'bg-amber-50  text-amber-700  border-amber-100',
  rejected:       'bg-red-50    text-red-700    border-red-100',
  draft:          'bg-slate-100 text-slate-500  border-slate-200',
  archived:       'bg-slate-100 text-slate-400  border-slate-200',
  expired:        'bg-slate-100 text-slate-500  border-slate-200',
};

export default function AdminListingsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'active' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'listings', filter, committed],
    queryFn: () => apiClient.get<ApiResponse<Listing[]>>('/listings/admin/list', {
      params: { status: filter === 'all' ? undefined : filter, search: committed || undefined, page_size: 50 },
    }).then(r => r.data),
  });

  const { mutate: moderate } = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      apiClient.post(`/listings/admin/${id}/${action}`, {}),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'listings'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  const listings = Array.isArray(data?.data) ? data.data : [];
  const pendingCount = listings.filter(l => l.status === 'pending_review').length;

  return (
    
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-indigo-600" /> Listings
            </h1>
            {filter === 'pending_review' && pendingCount > 0 && (
              <p className="text-sm font-medium text-amber-600 mt-0.5">
                {pendingCount} listing{pendingCount !== 1 ? 's' : ''} pending approval
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending_review', 'active', 'rejected'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`h-9 rounded-xl border px-4 text-sm font-medium capitalize transition-colors ${
                  filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                {s === 'pending_review' ? 'Pending' : s}
              </button>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); setCommitted(search); }} className="flex gap-2 sm:ml-auto w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input placeholder="Search listings…" value={search} onChange={e => setSearch(e.target.value)}
                className="h-9 w-full sm:w-56 rounded-xl border border-slate-200 pl-9 pr-4 text-sm text-slate-800
                  placeholder-slate-400 focus:border-indigo-400 focus:outline-none" />
            </div>
            <button type="submit" className="h-9 rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
              Search
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-900">No listings found</p>
            </div>
          ) : (
            <>
              {/* ── Mobile: card list ─────────────────────── */}
              <ul className="divide-y divide-slate-100 lg:hidden">
                {listings.map(l => (
                  <li key={l.id} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      {l.image_url && (
                        <img src={l.image_url} alt="" className="h-12 w-12 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-slate-900 line-clamp-2 leading-snug">{l.title}</p>
                        <p className="text-[11px] text-slate-400 capitalize mt-0.5">{l.listing_type} · {l.category}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[10px] rounded-full border px-2 py-0.5 font-semibold capitalize ${STATUS_CLS[l.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {l.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-black text-slate-900">
                          {new Intl.NumberFormat('en-NG', { style: 'currency', currency: l.currency || 'NGN', maximumFractionDigits: 0 }).format(l.price)}
                        </p>
                        <p className="text-[11px] text-slate-400">{l.seller_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/listings/${l.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all no-underline">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        {(l.status === 'pending_review' || l.status === 'pending') && (
                          <>
                            <button onClick={() => moderate({ id: l.id, action: 'approve' })}
                              className="h-8 rounded-lg bg-emerald-50 border border-emerald-200 px-3 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">
                              ✓
                            </button>
                            <button onClick={() => moderate({ id: l.id, action: 'reject' })}
                              className="h-8 rounded-lg bg-red-50 border border-red-200 px-3 text-[11px] font-bold text-red-600 hover:bg-red-100 transition-colors">
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* ── Desktop: table ─────────────────────────── */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Listing', 'Seller', 'Price', 'Category', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listings.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {l.image_url && (
                              <img src={l.image_url} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 line-clamp-1">{l.title}</p>
                              <p className="text-xs text-slate-400 capitalize">{l.listing_type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{l.seller_name}</td>
                        <td className="px-5 py-3 text-sm font-bold text-slate-900">
                          {new Intl.NumberFormat('en-NG', { style: 'currency', currency: l.currency || 'NGN', maximumFractionDigits: 0 }).format(l.price)}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">{l.category}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold capitalize ${STATUS_CLS[l.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/listings/${l.id}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400
                                hover:border-indigo-300 hover:text-indigo-600 transition-all no-underline">
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                            {(l.status === 'pending_review' || l.status === 'pending') && (
                              <>
                                <button onClick={() => moderate({ id: l.id, action: 'approve' })}
                                  className="flex h-8 items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">
                                  <CheckCircle className="h-3 w-3" /> Approve
                                </button>
                                <button onClick={() => moderate({ id: l.id, action: 'reject' })}
                                  className="flex h-8 items-center gap-1 rounded-lg bg-red-50 border border-red-100 px-2.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors">
                                  <XCircle className="h-3 w-3" /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    
  );
}

interface Listing { id: string; title: string; listing_type: string; seller_name: string; price: number; currency: string; category: string; image_url?: string; status: string; created_at: string; }
