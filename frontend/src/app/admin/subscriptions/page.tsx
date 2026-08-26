'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Plus, Trash, WarningCircle, CheckCircle } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  features: string[];
  is_popular: boolean;
}

export default function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', duration_days: '30', features: '' });
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'subscriptions'],
    queryFn: () =>
      apiClient.get<ApiResponse<SubscriptionTier[]>>('/admin/subscriptions').then(r => r.data),
    staleTime: 30_000,
  });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/subscriptions', {
        name: form.name.trim(),
        price: parseFloat(form.price) || 0,
        duration_days: parseInt(form.duration_days) || 30,
        features: form.features.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      setForm({ name: '', price: '', duration_days: '30', features: '' });
      setShowForm(false);
      setFormOk(true);
      setTimeout(() => setFormOk(false), 3000);
    },
    onError: (e: any) => {
      setFormErr(e?.response?.data?.error?.message || e?.message || 'Failed to create tier.');
    },
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/subscriptions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }),
  });

  const tiers: SubscriptionTier[] = Array.isArray(data?.data) ? data.data : [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr('');
    if (!form.name.trim()) { setFormErr('Name is required.'); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { setFormErr('Enter a valid price.'); return; }
    create();
  }

  const inputCls = 'w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white transition-all';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Crown className="h-6 w-6 text-violet-600" /> Subscription Tiers
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Manage subscription plans and pricing</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormErr(''); }}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Tier
        </button>
      </div>

      {formOk && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-emerald-700">Subscription tier created.</p>
        </div>
      )}

      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-violet-50/50 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-900">New Subscription Tier</h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Business" required className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Price (₦) <span className="text-red-500">*</span></label>
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="5000" required min="0" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Duration (days)</label>
                <input type="number" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                  placeholder="30" min="1" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Features (comma-separated)</label>
              <textarea value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))}
                placeholder="Unlimited listings, Priority support, Analytics"
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all"
              />
            </div>
            {formErr && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <WarningCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-[12px] font-medium text-red-600">{formErr}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={creating}
                className="h-10 rounded-xl bg-violet-600 px-5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Tier'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormErr(''); }}
                className="h-10 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load subscription tiers</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : tiers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Crown className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">No subscription tiers</p>
          <p className="text-[13px] text-slate-400">Create tiers to offer sellers subscription plans.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiers.map(tier => (
            <div key={tier.id} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {tier.is_popular && (
                <span className="absolute top-3 right-3 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                  Popular
                </span>
              )}
              <h3 className="text-[17px] font-black text-slate-900 mb-1">{tier.name}</h3>
              <p className="text-[24px] font-black text-violet-600 mb-0.5">
                ₦{tier.price.toLocaleString()}
                <span className="text-[13px] font-normal text-slate-400">/{tier.duration_days}d</span>
              </p>
              <ul className="mt-3 mb-4 space-y-1.5">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px] text-slate-600">
                    <span className="text-emerald-500 font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => remove(tier.id)}
                className="flex w-full items-center justify-center gap-1.5 h-8 rounded-xl border border-red-200 bg-red-50 text-[12px] font-semibold text-red-600 hover:bg-red-100 transition-colors"
              >
                <Trash className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}