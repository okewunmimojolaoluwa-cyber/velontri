'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Search } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminProductsPage() {
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', committed],
    queryFn: () => apiClient.get<ApiResponse<Listing[]>>('/listings/admin/list', { params: { type: 'product', search: committed || undefined, page_size: 30 } }).then(r => r.data),
  });

  const listings = data?.data ?? [];

  return <AdminListingsTable title="Products" icon={<Package className="h-6 w-6 text-indigo-600" />} listings={listings} isLoading={isLoading} search={search} setSearch={setSearch} onSearch={() => setCommitted(search)} />;
}

export function AdminListingsTable({ title, icon, listings, isLoading, search, setSearch, onSearch }: any) {
  return (
    
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">{icon} {title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">All {title.toLowerCase()} listings on the platform</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); onSearch(); }} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input placeholder={`Search ${title.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)}
                className="h-10 w-60 rounded-xl border border-slate-200 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none" />
            </div>
            <button type="submit" className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700">Search</button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-900">No {title.toLowerCase()} found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Listing', 'Seller', 'Price', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.map((l: any) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {l.image_url && <img src={l.image_url} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />}
                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{l.title}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{l.seller_name}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: l.currency || 'NGN', maximumFractionDigits: 0 }).format(l.price)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold capitalize ${
                        l.status === 'active'  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        l.status === 'pending' ? 'bg-amber-50  text-amber-700  border-amber-100'  :
                                                 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>{l.status}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    
  );
}

interface Listing { id: string; title: string; seller_name: string; price: number; currency: string; image_url?: string; status: string; created_at: string; }

// Alias for backwards compatibility with pages that import ListingsPage
export { AdminListingsTable as ListingsPage };
