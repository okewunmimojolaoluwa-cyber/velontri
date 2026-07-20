'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminRefundsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'refunds'],
    queryFn: () => apiClient.get<ApiResponse<Refund[]>>('/payments/admin/refunds', { params: { page_size: 50 } }).then(r => r.data),
  });

  const { mutate: processRefund } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/payments/admin/refunds/${id}/process`, {}),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'refunds'] }),
  });

  const refunds = data?.data ?? [];
  const pending = refunds.filter(r => r.status === 'pending');

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-indigo-600" /> Refunds
          </h1>
          {pending.length > 0 && (
            <p className="text-sm font-medium text-amber-600 mt-0.5">{pending.length} pending refund{pending.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : refunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RefreshCw className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-900">No refunds</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Order', 'Customer', 'Amount', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refunds.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-sm text-slate-500">#{r.order_id.slice(0,8)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{r.customer_name}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: r.currency, maximumFractionDigits: 0 }).format(r.amount)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 max-w-xs truncate">{r.reason}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${
                        r.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        r.status === 'pending'   ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                   'bg-red-50 text-red-700 border-red-100'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      {r.status === 'pending' && (
                        <button onClick={() => processRefund(r.id)}
                          className="h-8 rounded-lg bg-indigo-50 border border-indigo-100 px-3 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors">
                          Process
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    
  );
}

interface Refund { id: string; order_id: string; customer_name: string; amount: number; currency: string; reason: string; status: 'pending' | 'completed' | 'rejected'; created_at: string; }
