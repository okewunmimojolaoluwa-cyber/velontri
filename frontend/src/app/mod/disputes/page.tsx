'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Dispute {
  id: string;
  listing_title: string;
  amount: number;
  currency: string;
  buyer_name: string;
  seller_name: string;
  reason: string;
  description: string;
  status: 'open' | 'resolved' | 'escalated';
  created_at: string;
}

export default function ModDisputesPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'escalated'>('open');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mod-disputes', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Dispute[]>>(`/mod/disputes?status=${filter}`)
        .then((r) => r.data),
    enabled: session.isAuthenticated,
    retry: false,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/disputes/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-disputes'] }),
    onError: (err: any) => alert(err?.message || 'Failed to resolve dispute.'),
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/disputes/${id}/escalate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-disputes'] }),
    onError: (err: any) => alert(err?.message || 'Failed to escalate dispute.'),
  });

  const disputes: Dispute[] = Array.isArray(data?.data) ? data.data as Dispute[] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" /> Disputes
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Manage transaction disputes</p>
      </div>

      <div className="flex gap-1.5">
        {(['all', 'open', 'resolved', 'escalated'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
              filter === s ? 'bg-amber-500 text-white' : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-[14px] font-semibold text-amber-700 mb-1">Feature under development</p>
          <p className="text-[13px] text-amber-600">Dispute resolution system will be available in a future update.</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : disputes.length === 0 && !isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <AlertCircle className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">No disputes</p>
          <p className="text-[12px] text-slate-400">
            {filter !== 'all' ? `No ${filter} disputes.` : 'No disputes have been filed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <p className="text-[14px] font-bold text-slate-900">{dispute.listing_title}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    {dispute.currency} {dispute.amount?.toLocaleString()} · {new Date(dispute.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
                  dispute.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : dispute.status === 'open' ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-red-50 text-red-600 border-red-100'
                }`}>
                  {dispute.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3 text-[12px]">
                <div><span className="text-slate-400">Buyer: </span><span className="font-semibold text-slate-700">{dispute.buyer_name}</span></div>
                <div><span className="text-slate-400">Seller: </span><span className="font-semibold text-slate-700">{dispute.seller_name}</span></div>
                <div><span className="text-slate-400">Reason: </span><span className="font-semibold text-slate-700">{dispute.reason}</span></div>
              </div>
              {dispute.description && (
                <p className="text-[13px] text-slate-600 mb-3 line-clamp-2">{dispute.description}</p>
              )}
              {dispute.status === 'open' && (
                <div className="flex gap-2">
                  <button onClick={() => resolveMutation.mutate(dispute.id)} disabled={resolveMutation.isPending}
                    className="h-8 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    Resolve
                  </button>
                  <button onClick={() => escalateMutation.mutate(dispute.id)} disabled={escalateMutation.isPending}
                    className="h-8 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Escalate to Admin
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
