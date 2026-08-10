'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Dispute {
  id: string;
  raised_by: string;
  reporter_name: string;
  reporter_email: string;
  listing_id: string | null;
  listing_title: string;
  reason: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  resolution_note: string;
  created_at: string;
}

const STATUS_CLS: Record<string, string> = {
  open:         'bg-red-50 text-red-700 border-red-100',
  under_review: 'bg-amber-50 text-amber-700 border-amber-100',
  resolved:     'bg-emerald-50 text-emerald-700 border-emerald-100',
  dismissed:    'bg-slate-100 text-slate-500 border-slate-200',
};

export default function ModDisputesPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'under_review' | 'resolved' | 'all'>('open');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mod-disputes', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Dispute[]>>('/mod/disputes', { params: { status: filter, page_size: 50 } })
        .then(r => r.data),
    enabled: session.isAuthenticated,
    staleTime: 30_000,
  });

  const { mutate: resolveDispute, isPending: resolving } = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/mod/disputes/${id}/resolve`, { resolution_note: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mod-disputes'] });
      setExpanded(null);
    },
  });

  const { mutate: escalateDispute, isPending: escalating } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/disputes/${id}/escalate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-disputes'] }),
  });

  const disputes: Dispute[] = Array.isArray(data?.data) ? data.data : [];
  const meta = (data as any)?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" /> Disputes
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {meta?.total != null ? `${meta.total} dispute(s)` : 'Manage user disputes'}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(['open', 'under_review', 'resolved', 'all'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
              filter === s
                ? 'bg-amber-500 text-white'
                : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
            }`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load disputes</p>
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
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <CheckCircle className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">
            No {filter !== 'all' ? filter.replace('_', ' ') : ''} disputes
          </p>
          <p className="text-[12px] text-slate-400">
            Disputes raised by users will appear here.
          </p>
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
                    {d.status.replace('_', ' ')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">{d.reason}</p>
                    <p className="text-[11px] text-slate-400">
                      {d.reporter_name} · {d.listing_title && `${d.listing_title} · `}
                      {new Date(d.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {expanded === d.id
                  ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}
              </button>

              {expanded === d.id && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                  {/* Reporter info */}
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <p className="font-bold uppercase tracking-wide text-slate-400 mb-0.5">Reporter</p>
                      <p className="text-slate-700">{d.reporter_name}</p>
                      {d.reporter_email && <p className="text-slate-400">{d.reporter_email}</p>}
                    </div>
                    {d.listing_title && (
                      <div>
                        <p className="font-bold uppercase tracking-wide text-slate-400 mb-0.5">Listing</p>
                        <p className="text-slate-700">{d.listing_title}</p>
                      </div>
                    )}
                  </div>

                  {d.description && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Description</p>
                      <p className="text-[13px] text-slate-700">{d.description}</p>
                    </div>
                  )}

                  {d.resolution_note && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 mb-1">Resolution</p>
                      <p className="text-[13px] text-emerald-800">{d.resolution_note}</p>
                    </div>
                  )}

                  {/* Actions for open/under_review disputes */}
                  {(d.status === 'open' || d.status === 'under_review') && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                          Resolution note (optional)
                        </label>
                        <textarea
                          value={noteMap[d.id] || ''}
                          onChange={e => setNoteMap(m => ({ ...m, [d.id]: e.target.value }))}
                          placeholder="Describe how the dispute was resolved…"
                          rows={2}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 resize-none transition-all"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolveDispute({ id: d.id, note: noteMap[d.id] || '' })}
                          disabled={resolving}
                          className="h-9 rounded-xl bg-emerald-600 px-4 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {resolving ? 'Resolving…' : 'Mark Resolved'}
                        </button>
                        {d.status === 'open' && (
                          <button
                            onClick={() => escalateDispute(d.id)}
                            disabled={escalating}
                            className="h-9 rounded-xl border border-amber-200 bg-amber-50 px-4 text-[12px] font-bold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            Escalate to Admin
                          </button>
                        )}
                      </div>
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
