'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ApiResponse } from '@/types/api';

export default function CouponsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', discount_percent: '', max_uses: '', expires_at: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: () => apiClient.get<ApiResponse<Coupon[]>>('/admin/coupons').then(r => r.data),
  });

  const { mutate: create, isPending } = useMutation({
    mutationFn: (d: typeof form) => apiClient.post('/admin/coupons', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }); setCreating(false); setForm({ code: '', discount_percent: '', max_uses: '', expires_at: '' }); },
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/coupons/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });

  const coupons = data?.data ?? [];

  return (
    
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Tag className="h-6 w-6 text-indigo-600" /> Coupons
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage discount coupons</p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Coupon
          </Button>
        </div>

        {creating && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Create Coupon</h3>
            <form onSubmit={e => { e.preventDefault(); create(form); }} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Code</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SAVE20" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Discount (%)</label>
                <Input type="number" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} placeholder="20" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Max Uses</label>
                <Input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} placeholder="100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Expires At</label>
                <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} required />
              </div>
              <div className="col-span-2 flex gap-2">
                <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create'}</Button>
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : coupons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Tag className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-900">No coupons yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Code', 'Discount', 'Used / Max', 'Expires', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3"><code className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700">{c.code}</code></td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900">{c.discount_percent}%</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{c.usage_count} / {c.max_uses ?? '∞'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{new Date(c.expires_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold ${
                        c.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>{c.is_active ? 'Active' : 'Expired'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => remove(c.id)} className="h-7 w-7 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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

interface Coupon { id: string; code: string; discount_percent: number; usage_count: number; max_uses?: number; expires_at: string; is_active: boolean; }
