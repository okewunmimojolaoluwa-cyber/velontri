'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminWithdrawalsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'withdrawals'],
    queryFn: () => apiClient.get<ApiResponse<Withdrawal[]>>('/wallet/admin/withdrawals', { params: { page_size: 50 } }).then(r => r.data),
  });

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/wallet/admin/withdrawals/${id}/approve`, {}),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'withdrawals'] }),
  });

  const { mutate: reject } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/wallet/admin/withdrawals/${id}/reject`, {}),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'withdrawals'] }),
  });

  const withdrawals = data?.data ?? [];
  const pending = withdrawals.filter(w => w.status === 'pending');
  const others  = withdrawals.filter(w => w.status !== 'pending');

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowDown className="h-6 w-6 text-indigo-600" /> Withdrawal Requests
          </h1>
          {pending.length > 0 && (
            <p className="text-sm font-medium text-red-600 mt-0.5">{pending.length} pending request{pending.length !== 1 ? 's' : ''} need approval</p>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
        ) : withdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <ArrowDown className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-900">No withdrawal requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...pending, ...others].map(w => (
              <div key={w.id} className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold ${
                      w.status === 'pending'  ? 'bg-amber-50  text-amber-700  border-amber-100'  :
                      w.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                               'bg-red-50    text-red-700    border-red-100'
                    }`}>{w.status}</span>
                    <p className="text-sm font-semibold text-slate-900">{w.user_name}</p>
                    <p className="text-xs text-slate-500">{w.user_email}</p>
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <p className="text-lg font-black text-slate-900">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: w.currency, maximumFractionDigits: 0 }).format(w.amount)}
                    </p>
                    <p className="text-xs text-slate-500">via {w.method} · {new Date(w.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {w.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => approve(w.id)}
                      className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
                      Approve
                    </button>
                    <button onClick={() => reject(w.id)}
                      className="h-9 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors">
                      Reject
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

interface Withdrawal { id: string; user_name: string; user_email: string; amount: number; currency: string; method: string; status: 'pending' | 'approved' | 'rejected'; created_at: string; }
