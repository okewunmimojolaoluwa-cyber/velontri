'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Search, Eye } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

const STATUS_CLS: Record<string, string> = {
  active:         'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-100',
  pending:        'bg-amber-50 text-amber-700 border-amber-100',
  rejected:       'bg-red-50 text-red-700 border-red-100',
  draft:          'bg-slate-100 text-slate-500 border-slate-200',
  archived:       'bg-slate-100 text-slate-400 border-slate-200',
};

export function AdminListingsTable({
  title,
  icon,
  listings,
  isLoading,
  search,
  setSearch,
  onSearch,
}: {
  title: string;
  icon: React.ReactNode;
  listings: Listing[];
  isLoading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            {icon} {title}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">All {title.toLowerCase()} listings on the platform</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSearch(); }} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              placeholder={`Search ${title.toLowerCase()}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 w-full sm:w-60 rounded-xl border border-slate-200 pl-9 pr-4 text-sm
                text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <button type="submit"
            className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
            Search
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Package className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-900">No {title.toLowerCase()} found</p>
        </div>
      ) : (
        <>
          {/* ── Mobile: card list ── */}
          <div className="space-y-3 lg:hidden">
            {listings.map(l => (
              <div key={l.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  {l.image_url ? (
                    <img src={l.image_url} alt="" className="h-14 w-14 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-bold text-slate-900 line-clamp-2 leading-snug">{l.title}</p>
                      <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_CLS[l.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {l.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-500 mt-1">{l.seller_name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[13px] font-black text-slate-900">
                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: l.currency || 'NGN', maximumFractionDigits: 0 }).format(l.price)}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-slate-400">
                          {new Date(l.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                        </p>
                        <Link href={`/listings/${l.id}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all no-underline">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop: table ── */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Listing', 'Seller', 'Price', 'Status', 'Date', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {l.image_url ? (
                          <img src={l.image_url} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-slate-300" />
                          </div>
                        )}
                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{l.title}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{l.seller_name}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: l.currency || 'NGN', maximumFractionDigits: 0 }).format(l.price)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold capitalize ${STATUS_CLS[l.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {new Date(l.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/listings/${l.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all no-underline">
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Alias for backwards compat
export { AdminListingsTable as ListingsPage };

export default function AdminProductsPage() {
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', committed],
    queryFn: () =>
      apiClient.get<ApiResponse<Listing[]>>('/listings/admin/list', {
        params: { type: 'product', search: committed || undefined, page_size: 30 },
      }).then(r => r.data),
  });

  return (
    <AdminListingsTable
      title="Products"
      icon={<Package className="h-6 w-6 text-indigo-600" />}
      listings={data?.data ?? []}
      isLoading={isLoading}
      search={search}
      setSearch={setSearch}
      onSearch={() => setCommitted(search)}
    />
  );
}

interface Listing {
  id: string;
  title: string;
  seller_name: string;
  price: number;
  currency: string;
  image_url?: string;
  status: string;
  created_at: string;
}
