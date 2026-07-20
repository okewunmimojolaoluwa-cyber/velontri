'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { List } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

const TYPE_CLS: Record<string, string> = {
  credit:   'bg-emerald-50 text-emerald-700',
  debit:    'bg-red-50    text-red-700',
  transfer: 'bg-blue-50   text-blue-700',
  escrow:   'bg-violet-50 text-violet-700',
  refund:   'bg-amber-50  text-amber-700',
};

export default function AdminTransactionsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'transactions', page],
    queryFn: () => apiClient.get<ApiResponse<Transaction[]>>('/wallet/admin/transactions', { params: { page, page_size: 20 } }).then(r => r.data),
  });

  const txns = data?.data ?? [];
  const meta = data?.meta;

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <List className="h-6 w-6 text-indigo-600" /> All Transactions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Complete transaction ledger across the platform</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(10)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : txns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <List className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-900">No transactions yet</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['ID', 'User', 'Type', 'Amount', 'Description', 'Date'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txns.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{t.id.slice(0, 8)}…</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{t.user_email}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TYPE_CLS[t.type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-slate-900">
                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: t.currency, maximumFractionDigits: 0 }).format(t.amount)}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500 max-w-xs truncate">{t.description}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {meta && meta.total_pages > 1 && (
                <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-slate-100">
                  <button disabled={!meta.has_prev} onClick={() => setPage(p => p - 1)}
                    className="h-9 rounded-xl border px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    Prev
                  </button>
                  <span className="text-sm text-slate-500">{meta.page} / {meta.total_pages}</span>
                  <button disabled={!meta.has_next} onClick={() => setPage(p => p + 1)}
                    className="h-9 rounded-xl border px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    
  );
}

interface Transaction { id: string; user_email: string; type: string; amount: number; currency: string; description: string; created_at: string; }
