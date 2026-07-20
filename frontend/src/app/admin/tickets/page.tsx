'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

const PRIORITY_CLS: Record<string, string> = {
  high:   'bg-red-50    text-red-700    border-red-100',
  medium: 'bg-amber-50  text-amber-700  border-amber-100',
  low:    'bg-slate-100 text-slate-600  border-slate-200',
};

export default function AdminTicketsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'closed'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tickets', filter],
    queryFn: () => apiClient.get<ApiResponse<Ticket[]>>('/crm/admin/tickets', { params: { status: filter, page_size: 50 } }).then(r => r.data),
  });

  const { mutate: closeTicket } = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/crm/admin/tickets/${id}`, { status: 'closed' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  });

  const tickets = data?.data ?? [];
  const openCount = tickets.filter(t => t.status === 'open').length;

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-indigo-600" /> Support Tickets
          </h1>
          {openCount > 0 && (
            <p className="text-sm font-medium text-red-600 mt-0.5">{openCount} open ticket{openCount !== 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="flex gap-2">
          {(['all', 'open', 'in_progress', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`h-9 rounded-xl border px-4 text-sm font-medium capitalize transition-colors ${
                filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <MessageSquare className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-900">No tickets found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold capitalize ${PRIORITY_CLS[t.priority] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {t.priority}
                    </span>
                    <p className="text-sm font-bold text-slate-900 truncate">{t.subject}</p>
                  </div>
                  <p className="text-xs text-slate-500">by {t.user_name} · {new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold ${
                    t.status === 'open'        ? 'bg-red-50 text-red-700 border-red-100' :
                    t.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>{t.status.replace('_', ' ')}</span>
                  {t.status !== 'closed' && (
                    <button onClick={() => closeTicket(t.id)}
                      className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                      Close
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

interface Ticket { id: string; subject: string; user_name: string; priority: 'high' | 'medium' | 'low'; status: 'open' | 'in_progress' | 'closed'; created_at: string; }
