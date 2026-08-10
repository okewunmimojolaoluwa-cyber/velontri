'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Dispute {
  id: string;
  listing_id?: string;
  listing_title?: string;
  reporter_id?: string;
  reporter_name?: string;
  reason?: string;
  status: string;
  created_at: string;
}

const STATUS_CLS: Record<string, string> = {
  open:         'bg-red-50 text-red-700 border-red-100',
  under_review: 'bg-amber-50 text-amber-700 border-amber-100',
  resolved:     'bg-emerald-50 text-emerald-700 border-emerald-100',
  dismissed:    'bg-slate-100 text-slate-500 border-slate-200',
};

export default function DisputesPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'disputes', statusFilter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Dispute[]>>('/mod/disputes', { params: { status: statusFilter } })
        .then(r => r.data),
    staleTime: 30_000,
  });

  const { mutate: resolve } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/disputes/${id}/resolve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }),
  });

  const { mutate: escalate } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/disputes/${id}/escalate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }),
  });

  const disputes = Array.isArray(data?.data) ? data.data : [];
  const meta = (data as any)?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-red-500" /> Disputes
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {meta?.total != null ? `${meta.total} dispute(s)` : 'Manage buyer-seller disputes'}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['open', 'resolved', 'all'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`h-9 rounded-xl border px-4 text-[13px] font-semibold capitalize transition-colors ${
              statusFilter === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load disputes</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <CheckCircle className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">No {statusFilter !== 'all' ? statusFilter : ''} disputes</p>
          <p className="text-[13px] text-slate-400">Disputes will appear here when users raise them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map(d => (
            <div key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${STATUS_CLS[d.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {d.status.replace(/_/g, ' ')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">
                      {d.listing_title || `Dispute #${d.id.slice(0, 8)}`}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {d.reporter_name || 'User'} · {new Date(d.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {expanded === d.id
                  ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}
              </button>

              {expanded === d.id && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                  {d.reason && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Reason</p>
                      <p className="text-[13px] text-slate-700">{d.reason}</p>
                    </div>
                  )}
                  {d.listing_id && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Listing ID</p>
                      <p className="text-[12px] text-slate-500 font-mono">{d.listing_id}</p>
                    </div>
                  )}
                  {(d.status === 'open' || d.status === 'under_review') && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => resolve(d.id)}
                        className="h-9 rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700 transition-colors"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => escalate(d.id)}
                        className="h-9 rounded-xl border border-amber-200 bg-amber-50 px-4 text-[13px] font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        Escalate
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
