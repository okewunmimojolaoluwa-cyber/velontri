'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatSquare, CheckCircle } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Ticket {
  id: string;
  subject?: string;
  status: string;
  created_at: string;
}

export default function AdminTicketsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'tickets', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<Ticket[]>>('/mod/tickets', { params: { status: filter, page_size: 50 } })
        .then(r => r.data),
    staleTime: 30_000,
  });

  const { mutate: closeTicket } = useMutation({
    mutationFn: (id: string) =>
      apiClient.put(`/mod/tickets/${id}`, { status: 'resolved' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  });

  const tickets: Ticket[] = Array.isArray(data?.data) ? data.data : [];
  const meta = (data as any)?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ChatSquare className="h-6 w-6 text-indigo-600" /> Support Tickets
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {meta?.total != null ? `${meta.total} ticket(s)` : 'Manage user support requests'}
        </p>
      </div>

      <div className="flex gap-2">
        {(['open', 'resolved', 'all'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`h-9 rounded-xl border px-4 text-sm font-medium capitalize transition-colors ${
              filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load tickets</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <CheckCircle className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-900">No {filter !== 'all' ? filter : ''} tickets</p>
          <p className="text-xs text-slate-400 mt-1">Tickets will appear here when users raise support requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-slate-900 truncate">
                  {t.subject || `Ticket #${t.id.slice(0, 8)}`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {new Date(t.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs rounded-full border px-2.5 py-1 font-semibold capitalize ${
                  t.status === 'open'     ? 'bg-red-50 text-red-700 border-red-100' :
                  t.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            'bg-slate-100 text-slate-500 border-slate-200'
                }`}>{t.status}</span>
                {t.status === 'open' && (
                  <button
                    onClick={() => closeTicket(t.id)}
                    className="h-8 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}