'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, CheckCircle, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Dispute {
  id: string;
  listing_id: string | null;
  listing_title: string;
  reason: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  resolution_note: string;
  created_at: string;
}

const STATUS_CLS: Record<string, string> = {
  open:         'bg-red-50 text-red-700 border-red-100',
  under_review: 'bg-amber-50 text-amber-700 border-amber-100',
  resolved:     'bg-emerald-50 text-emerald-700 border-emerald-100',
  dismissed:    'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABEL: Record<string, string> = {
  open:         'Open',
  under_review: 'Under Review',
  resolved:     'Resolved',
  dismissed:    'Dismissed',
};

const REASONS = [
  'Item not as described',
  'Item not received',
  'Seller unresponsive',
  'Fraudulent listing',
  'Payment issue',
  'Safety concern',
  'Other',
];

export default function UserDisputesPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    reason: '',
    description: '',
    listing_title: '',
    listing_id: '',
  });
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['user', 'disputes'],
    queryFn: () =>
      apiClient.get<ApiResponse<Dispute[]>>('/disputes/mine').then(r => r.data),
    enabled: session.isAuthenticated,
    staleTime: 30_000,
  });

  const { mutate: submit, isPending: submitting } = useMutation({
    mutationFn: () =>
      apiClient.post('/disputes', {
        reason: form.reason,
        description: form.description.trim() || undefined,
        listing_title: form.listing_title.trim() || undefined,
        listing_id: form.listing_id.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'disputes'] });
      setForm({ reason: '', description: '', listing_title: '', listing_id: '' });
      setShowForm(false);
      setFormOk(true);
      setTimeout(() => setFormOk(false), 5000);
    },
    onError: (e: any) => {
      setFormErr(e?.response?.data?.error?.message || e?.message || 'Failed to submit dispute.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr('');
    if (!form.reason) { setFormErr('Please select a reason.'); return; }
    submit();
  }

  const disputes: Dispute[] = Array.isArray(data?.data) ? data.data : [];
  const inputCls = 'w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white transition-all';

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">My Disputes</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Report issues with listings, sellers or transactions
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormErr(''); }}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-5 text-[13px] font-bold text-white hover:bg-red-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Raise Dispute
        </button>
      </div>

      {/* Success banner */}
      {formOk && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-emerald-800">Dispute submitted</p>
            <p className="text-[12px] text-emerald-600">Our team will review it within 24 hours.</p>
          </div>
        </div>
      )}

      {/* Raise dispute form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-red-50/50 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-900">Raise a Dispute</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={form.reason}
                onChange={e => { setForm(f => ({ ...f, reason: e.target.value })); setFormErr(''); }}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] text-slate-700 outline-none focus:border-indigo-400 transition-all"
                required
              >
                <option value="">Select a reason…</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Listing title <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                value={form.listing_title}
                onChange={e => setForm(f => ({ ...f, listing_title: e.target.value }))}
                placeholder="e.g. 2020 Toyota Camry"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Description <span className="text-slate-400 font-normal">(optional but helpful)</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe what happened in detail…"
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all"
              />
            </div>

            {formErr && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <p className="text-[12px] font-medium text-red-600">{formErr}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !form.reason}
                className="h-10 rounded-xl bg-red-600 px-5 text-[13px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Dispute'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormErr(''); }}
                className="h-10 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Disputes list */}
      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load disputes</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">No disputes yet</p>
          <p className="text-[13px] text-slate-400">
            If you have an issue with a listing or seller, use the button above to raise a dispute.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map(d => (
            <div key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLS[d.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">
                      {d.reason}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {d.listing_title && `${d.listing_title} · `}
                      {new Date(d.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.status === 'open' && <Clock className="h-4 w-4 text-amber-500" />}
                  {d.status === 'resolved' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                  {expanded === d.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>

              {expanded === d.id && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                  {d.description && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Description</p>
                      <p className="text-[13px] text-slate-700">{d.description}</p>
                    </div>
                  )}
                  {d.status === 'resolved' && d.resolution_note && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 mb-1">Resolution</p>
                      <p className="text-[13px] text-emerald-800">{d.resolution_note}</p>
                    </div>
                  )}
                  {d.status === 'open' && (
                    <p className="text-[12px] text-slate-500 italic">
                      Your dispute is being reviewed. Our team will respond within 24 hours.
                    </p>
                  )}
                  {d.status === 'under_review' && (
                    <p className="text-[12px] text-amber-700 font-semibold">
                      This dispute has been escalated to an admin for review.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
