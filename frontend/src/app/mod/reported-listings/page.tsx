'use client';

import { useState } from 'react';
import { Flag, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface ReportedListing {
  id: string;
  title: string;
  reason: string;
  reporter_name: string;
  seller_name: string;
  report_count: number;
  status: 'open' | 'resolved' | 'dismissed';
  reported_at: string;
}

export default function ModReportedListingsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('open');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mod-reported-listings', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<ReportedListing[]>>(`/mod/reported-listings?status=${filter}`)
        .then((r) => r.data),
    enabled: session.isAuthenticated,
    retry: false,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reported-listings/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-reported-listings'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reported-listings/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-reported-listings'] }),
  });

  const listings: ReportedListing[] = Array.isArray(data?.data) ? data.data as ReportedListing[] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Flag className="h-5 w-5 text-amber-500" /> Reported Listings
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Review listings reported by users</p>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['all', 'open', 'resolved', 'dismissed'] as const).map((s) => (
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
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-[14px] font-semibold text-amber-700 mb-1">Feature under development</p>
          <p className="text-[13px] text-amber-600">Reported listings tracking will be available in a future update.</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : listings.length === 0 && !isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Flag className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">No reported listings</p>
          <p className="text-[12px] text-slate-400">
            {filter !== 'all' ? `No ${filter} reports found.` : 'No listings have been reported.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-slate-900 truncate">{listing.title}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    Reported by {listing.reporter_name} · {new Date(listing.reported_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
                  listing.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : listing.status === 'open' ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {listing.status}
                </span>
              </div>
              <p className="text-[13px] text-slate-600 mb-3">
                <strong>Reason:</strong> {listing.reason}
              </p>
              <p className="text-[12px] text-slate-400 mb-3">
                Seller: {listing.seller_name} · {listing.report_count} report(s)
              </p>
              {listing.status === 'open' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveMutation.mutate(listing.id)}
                    disabled={resolveMutation.isPending}
                    className="flex items-center gap-1.5 h-8 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Resolve
                  </button>
                  <button
                    onClick={() => dismissMutation.mutate(listing.id)}
                    disabled={dismissMutation.isPending}
                    className="flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
