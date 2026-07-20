'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff, Package, CheckCircle, XCircle, MapPin } from 'lucide-react';
import { RoleGate } from '@/components/rbac/role-gate';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface PendingListing {
  id: string; title: string; description: string;
  price: number; currency: string; category: string;
  listing_type: string; seller_id: string; seller_name: string;
  image_url?: string; created_at: string;
}

function fmt(n: number, currency: string) {
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${currency} ${n.toLocaleString()}`; }
}

const TYPE_COLOR: Record<string, string> = {
  product: '#4F46E5', service: '#7C3AED', job: '#059669', property: '#0369A1', vehicle: '#D97706',
};

export default function ModerationPage() {
  const qc = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'moderation'],
    queryFn: () => apiClient.get<ApiResponse<PendingListing[]>>('/listings/admin/pending').then(r => r.data),  });

  const { mutate: moderate } = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      apiClient.post(`/listings/admin/${id}/${action}`, {}),
    onMutate: ({ id }) => setActionId(id),
    onSettled: () => {
      setActionId(null);
      // Refresh moderation queue
      qc.invalidateQueries({ queryKey: ['admin', 'moderation'] });
      // Refresh public listing feeds so approved listings appear immediately everywhere
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  const listings = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;

  return (
    <RoleGate roles={['enterprise_admin', 'moderator', 'super_admin']}
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
          <div className="text-center space-y-2">
            <ShieldOff className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-[15px] font-semibold text-slate-900">Access Denied</p>
          </div>
        </div>
      }>
      
        <div className="space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Listing Moderation</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">
              {meta?.total != null
                ? `${meta.total} listing${meta.total !== 1 ? 's' : ''} pending review`
                : 'Review and approve or reject new listings'}
            </p>
          </div>

          {/* States */}
          {isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load listings</p>
              <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-5">
                  <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-slate-100 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded-lg bg-slate-100 animate-pulse" />
                    <div className="h-3 w-1/3 rounded-lg bg-slate-100 animate-pulse" />
                    <div className="h-3 w-1/2 rounded-lg bg-slate-100 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 mb-4">
                <ShieldCheck className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-[15px] font-semibold text-slate-900 mb-1">All clear!</p>
              <p className="text-[13px] text-slate-400">No listings are pending review right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map(listing => (
                <div key={listing.id}
                  className="flex items-start gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">

                  {/* Thumbnail */}
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {listing.image_url ? (
                      <img src={listing.image_url} alt={listing.title}
                        className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                    {/* Type dot */}
                    <span className="absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                      style={{ background: TYPE_COLOR[listing.listing_type] ?? '#4F46E5' }}>
                      {listing.listing_type}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[15px] font-bold text-slate-900 leading-tight">{listing.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[12px] text-slate-400 flex-wrap">
                          <span className="capitalize">{listing.listing_type}</span>
                          <span>·</span>
                          <span>{listing.category}</span>
                          <span>·</span>
                          <span>by <span className="font-medium text-slate-600">{listing.seller_name}</span></span>
                          <span>·</span>
                          <span>{new Date(listing.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-1.5 text-[15px] font-black text-indigo-600">{fmt(listing.price, listing.currency)}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          disabled={actionId === listing.id}
                          onClick={() => moderate({ id: listing.id, action: 'approve' })}
                          className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[12px]
                            font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-40 active:scale-95">
                          {actionId === listing.id ? (
                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                            </svg>
                          ) : <CheckCircle className="h-3.5 w-3.5" />}
                          Approve
                        </button>
                        <button
                          disabled={actionId === listing.id}
                          onClick={() => moderate({ id: listing.id, action: 'reject' })}
                          className="flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 text-[12px]
                            font-bold text-red-600 transition-all hover:bg-red-100 disabled:opacity-40 active:scale-95">
                          {actionId === listing.id ? (
                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                            </svg>
                          ) : <XCircle className="h-3.5 w-3.5" />}
                          Reject
                        </button>
                      </div>
                    </div>

                    {listing.description && (
                      <p className="mt-2 text-[13px] leading-relaxed text-slate-500 line-clamp-2">
                        {listing.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      
    </RoleGate>
  );
}
