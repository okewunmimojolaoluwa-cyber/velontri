'use client';

import { useState } from 'react';
import { ChatTeardrop } from '@phosphor-icons/react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  user_name: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
}

export default function ModTicketsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('open');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mod-tickets', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<SupportTicket[]>>(`/mod/tickets?status=${filter}`)
        .then((r) => r.data),
    enabled: session.isAuthenticated,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.put(`/mod/tickets/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-tickets'] }),
    onError: (err: any) => alert(err?.message || 'Failed to update ticket.'),
  });

  const tickets: SupportTicket[] = Array.isArray(data?.data) ? data.data as SupportTicket[] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ChatTeardrop className="h-5 w-5 text-amber-500" /> Support Tickets
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Manage user support requests</p>
      </div>

      <div className="flex gap-1.5">
        {(['all', 'open', 'in_progress', 'resolved'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
              filter === s ? 'bg-amber-500 text-white' : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
            }`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-[14px] font-semibold text-amber-700 mb-1">Feature under development</p>
          <p className="text-[13px] text-amber-600">Support ticket system will be available in a future update.</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 && !isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <ChatTeardrop className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">No tickets</p>
          <p className="text-[12px] text-slate-400">
            {filter !== 'all' ? `No ${filter.replace('_', ' ')} tickets.` : 'No support tickets filed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <p className="text-[14px] font-bold text-slate-900">{ticket.subject}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    {ticket.user_name} · {new Date(ticket.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                    ticket.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100'
                      : ticket.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {ticket.priority}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : ticket.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : 'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 text-[12px] text-slate-400 mb-3">
                <span>Category: <strong className="text-slate-600 capitalize">{ticket.category}</strong></span>
                <span>Updated: <strong className="text-slate-600">{new Date(ticket.updated_at).toLocaleDateString()}</strong></span>
              </div>

              <p className="text-[13px] text-slate-600 mb-3 line-clamp-2">{ticket.message}</p>

              <div className="flex gap-2">
                {ticket.status === 'open' && (
                  <button
                    onClick={() => updateMutation.mutate({ id: ticket.id, status: 'in_progress' })}
                    disabled={updateMutation.isPending}
                    className="h-8 rounded-lg bg-blue-600 px-3 text-[12px] font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Start Working
                  </button>
                )}
                {ticket.status === 'in_progress' && (
                  <button
                    onClick={() => updateMutation.mutate({ id: ticket.id, status: 'resolved' })}
                    disabled={updateMutation.isPending}
                    className="h-8 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Mark Resolved
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