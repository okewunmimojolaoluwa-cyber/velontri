'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Plus, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
}

export default function AdminCurrenciesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', symbol: '' });
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'currencies'],
    queryFn: () => apiClient.get<ApiResponse<Currency[]>>('/admin/currencies').then(r => r.data),
    staleTime: 60_000,
  });

  const { mutate: add, isPending: adding } = useMutation({
    mutationFn: () => apiClient.post('/admin/currencies', { code: form.code.trim().toUpperCase(), name: form.name.trim(), symbol: form.symbol.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'currencies'] });
      setForm({ code: '', name: '', symbol: '' });
      setShowForm(false);
      setFormOk(true);
      setTimeout(() => setFormOk(false), 3000);
    },
    onError: (e: any) => setFormErr(e?.response?.data?.error?.message || e?.message || 'Failed to add currency.'),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (code: string) => apiClient.delete(`/admin/currencies/${code}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'currencies'] }),
  });

  const currencies: Currency[] = Array.isArray(data?.data) ? data.data : [];

  const inputCls = 'w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white transition-all';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600" /> Currencies
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Manage supported listing currencies</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setFormErr(''); }}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-[13px] font-bold text-white hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Currency
        </button>
      </div>

      {formOk && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-emerald-700">Currency added.</p>
        </div>
      )}

      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-emerald-50/50 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-900">New Currency</h2>
          </div>
          <form onSubmit={e => { e.preventDefault(); setFormErr(''); if (!form.code || !form.name || !form.symbol) { setFormErr('All fields are required.'); return; } add(); }} className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Code (e.g. USD) <span className="text-red-500">*</span></label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="USD" maxLength={3} required className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="US Dollar" required className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Symbol <span className="text-red-500">*</span></label>
                <input value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
                  placeholder="$" maxLength={5} required className={inputCls} />
              </div>
            </div>
            {formErr && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-[12px] font-medium text-red-600">{formErr}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={adding}
                className="h-10 rounded-xl bg-emerald-600 px-5 text-[13px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {adding ? 'Adding…' : 'Add Currency'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="h-10 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load currencies</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
      ) : currencies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <DollarSign className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900">No currencies configured</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden lg:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            {['Symbol', 'Currency', 'Code', 'Status', 'Action'].map(h => (
              <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
            ))}
          </div>
          <ul className="divide-y divide-slate-100">
            {currencies.map(c => (
              <li key={c.code} className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto_auto_auto] gap-3 lg:gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[16px] font-black text-emerald-700">
                  {c.symbol}
                </div>
                <p className="text-[14px] font-semibold text-slate-900">{c.name}</p>
                <code className="text-[12px] bg-slate-100 rounded-lg px-2 py-0.5 text-slate-600 font-mono">{c.code}</code>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  c.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => remove(c.code)}
                  className="h-8 rounded-lg border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition-colors">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
