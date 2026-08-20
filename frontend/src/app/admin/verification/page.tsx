'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck, Users, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Check, X,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

/* ── Reject modal ───────────────────────────────────────── */
function RejectModal({
  app,
  onClose,
  onDone,
}: { app: any; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [cat, setCat] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const qc = useQueryClient();

  const { mutate: reject, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post(`/verification/applications/${app.id}/reject`, {
        rejection_category: cat,
        rejection_reason: reason,
        additional_notes: notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'verification'] });
      onDone();
    },
    onError: (e: any) => setErr(e?.message || 'Failed to reject.'),
  });

  function submit() {
    if (!reason.trim() && !cat.trim()) { setErr('Please provide a rejection reason.'); return; }
    setErr('');
    reject();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-black text-slate-900">Reject Application</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-[13px] text-slate-500">
          Rejecting <strong>{app.full_name || app.user_name}</strong>'s verification application.
        </p>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Category</label>
          <select value={cat} onChange={e => setCat(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none focus:border-red-400 transition-all">
            <option value="">Select a category…</option>
            {['Incomplete documents', 'Blurry / unreadable ID', 'Name mismatch', 'Duplicate account', 'Suspicious activity', 'Other'].map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Reason *</label>
          <textarea value={reason} onChange={e => { setReason(e.target.value); setErr(''); }} rows={3} placeholder="Explain why this application is being rejected…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-red-400 resize-none transition-all" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Additional notes (optional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any further guidance for the applicant…"
            className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none focus:border-red-400 transition-all" />
        </div>
        {err && <p className="text-[12px] font-medium text-red-600">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={submit} disabled={isPending}
            className="flex-1 h-10 rounded-xl bg-red-600 text-[13px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50">
            {isPending ? 'Rejecting…' : 'Reject Application'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Application row with expand + actions ──────────────── */
function AppRow({ app, onApprove, onReject }: { app: any; onApprove: () => void; onReject: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = ['submitted', 'under_review', 'more_info_required'].includes(app.status);

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
              {(app.full_name || app.user_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate">{app.full_name || app.user_name || '—'}</p>
              <p className="text-[11px] text-slate-400 truncate">{app.user_email}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 text-[13px] text-slate-600 capitalize">{app.seller_type || '—'}</td>
        <td className="px-5 py-3.5 text-[13px] text-slate-500">{[app.city, app.country].filter(Boolean).join(', ') || '—'}</td>
        <td className="px-5 py-3.5">
          <span className={`text-[11px] rounded-full border px-2.5 py-1 font-semibold capitalize whitespace-nowrap ${
            app.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : app.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100'
              : app.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-100'
              : app.status === 'under_review' ? 'bg-amber-50 text-amber-700 border-amber-100'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {(app.status || '').replace(/_/g, ' ')}
          </span>
        </td>
        <td className="px-5 py-3.5 text-[12px] text-slate-500">
          {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : '—'}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1.5">
            {/* Expand details */}
            <button onClick={() => setExpanded(v => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors"
              title="View details">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {isPending && (
              <>
                <button onClick={onApprove}
                  className="flex items-center gap-1 h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors"
                  title="Approve">
                  <Check className="h-3 w-3" /> Approve
                </button>
                <button onClick={onReject}
                  className="flex items-center gap-1 h-8 rounded-lg bg-red-100 px-3 text-[11px] font-bold text-red-700 hover:bg-red-200 transition-colors"
                  title="Reject">
                  <X className="h-3 w-3" /> Reject
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12px]">
              {[
                { label: 'ID Type', value: app.business_name || app.display_name || '—' },
                { label: 'Business', value: app.business_name || '—' },
                { label: 'Reviewed by', value: app.reviewer_full_name || app.reviewer_name || '—' },
                { label: 'Review date', value: app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString('en-NG') : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
                  <p className="font-semibold text-slate-700">{value}</p>
                </div>
              ))}
              {app.rejection_reason && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-400 mb-0.5">Rejection reason</p>
                  <p className="font-semibold text-red-700">{app.rejection_category ? `${app.rejection_category}: ` : ''}{app.rejection_reason}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Mobile card with actions ───────────────────────────── */
function AppCard({ app, onApprove, onReject }: { app: any; onApprove: () => void; onReject: () => void }) {
  const isPending = ['submitted', 'under_review', 'more_info_required'].includes(app.status);
  return (
    <div className="p-4 space-y-3 border-b border-slate-100 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[12px] font-bold text-indigo-700">
            {(app.full_name || app.user_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-slate-900 truncate">{app.full_name || app.user_name || '—'}</p>
            <p className="text-[11px] text-slate-400 truncate">{app.user_email}</p>
          </div>
        </div>
        <span className={`text-[10px] rounded-full border px-2 py-0.5 font-semibold capitalize flex-shrink-0 ${
          app.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : app.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100'
            : 'bg-amber-50 text-amber-700 border-amber-100'
        }`}>{(app.status || '').replace(/_/g, ' ')}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
        {app.seller_type && <span className="capitalize font-medium">{app.seller_type}</span>}
        {[app.city, app.country].filter(Boolean).length > 0 && <span>{[app.city, app.country].filter(Boolean).join(', ')}</span>}
        {app.submitted_at && <span>{new Date(app.submitted_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
      </div>
      {app.rejection_reason && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2">
          <p className="text-[11px] font-bold text-red-600 mb-0.5">{app.rejection_category || 'Rejection reason'}</p>
          <p className="text-[12px] text-red-700">{app.rejection_reason}</p>
        </div>
      )}
      {isPending && (
        <div className="flex gap-2">
          <button onClick={onApprove}
            className="flex flex-1 items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors">
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
          <button onClick={onReject}
            className="flex flex-1 items-center justify-center gap-1.5 h-9 rounded-xl border border-red-200 bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100 transition-colors">
            <X className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */
export default function AdminVerificationPage() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [rejectApp, setRejectApp] = useState<any | null>(null);
  const qc = useQueryClient();

  const { data: statsData } = useQuery({
    queryKey: ['admin', 'verification', 'stats'],
    queryFn: () => apiClient.get('/verification/admin/stats').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: appsData, isLoading } = useQuery({
    queryKey: ['admin', 'verification', 'apps', filter],
    queryFn: () => apiClient.get('/verification/admin/applications', {
      params: { status: filter || undefined, page_size: 100 },
    }).then(r => r.data),
    staleTime: 20_000,
  });

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/verification/applications/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'verification'] }),
  });

  const stats = statsData?.data;
  const apps = Array.isArray(appsData?.data) ? appsData.data : [];

  const KPI = [
    { label: 'Total',     value: stats?.total ?? 0,              color: '#4F46E5', bg: '#eef2ff', icon: Users,        filterVal: undefined },
    { label: 'Pending',   value: stats?.pending ?? 0,            color: '#D97706', bg: '#fffbeb', icon: Clock,        filterVal: 'submitted' },
    { label: 'Approved',  value: stats?.approved ?? 0,           color: '#059669', bg: '#ecfdf5', icon: CheckCircle,  filterVal: 'approved' },
    { label: 'Rejected',  value: stats?.rejected ?? 0,           color: '#DC2626', bg: '#fef2f2', icon: XCircle,      filterVal: 'rejected' },
    { label: 'More Info', value: stats?.more_info_required ?? 0, color: '#B45309', bg: '#fffbeb', icon: AlertCircle,  filterVal: 'more_info_required' },
  ];

  const STATUS_FILTERS = [
    { value: undefined, label: 'All' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'more_info_required', label: 'More Info' },
  ];

  return (
    <div className="space-y-6">
      {rejectApp && (
        <RejectModal
          app={rejectApp}
          onClose={() => setRejectApp(null)}
          onDone={() => setRejectApp(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <BadgeCheck className="h-6 w-6 text-indigo-600" /> Seller Verification
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Review and action all seller verification applications</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPI.map(k => {
          const Icon = k.icon;
          const isActive = filter === k.filterVal;
          return (
            <div key={k.label}
              onClick={() => setFilter(k.filterVal)}
              className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all ${isActive ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'}`}>
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: k.color }} />
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0" style={{ background: k.bg }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: k.color }} />
                </div>
              </div>
              <p className="text-[1.8rem] font-black text-slate-900 leading-none">{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Recent approvals */}
      {stats?.recent_approvals?.length > 0 && !filter && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-[14px] font-bold text-slate-900 mb-4">Recently Verified Sellers</h2>
          <div className="space-y-3">
            {stats.recent_approvals.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 text-[13px]">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                  {(a.full_name || a.user_email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{a.full_name || a.user_email}</p>
                  <p className="text-[11px] text-slate-400">{a.seller_type || 'individual'}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[11px] font-semibold text-slate-600">{a.reviewer_name ? `by ${a.reviewer_name}` : 'Approved'}</p>
                  <p className="text-[10px] text-slate-400">{a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All applications */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex gap-1.5 flex-wrap p-4 border-b border-slate-100 bg-slate-50">
          {STATUS_FILTERS.map(f => (
            <button key={f.label} onClick={() => setFilter(f.value as any)}
              className={`h-7 rounded-lg px-3 text-[11px] font-semibold capitalize transition-all ${
                filter === f.value ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : apps.length === 0 ? (
          <div className="py-16 text-center">
            <BadgeCheck className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-slate-900">No applications found</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Applicant', 'Type', 'Location', 'Status', 'Submitted', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apps.map((a: any) => (
                    <AppRow
                      key={a.id}
                      app={a}
                      onApprove={() => approve(a.id)}
                      onReject={() => setRejectApp(a)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="lg:hidden">
              {apps.map((a: any) => (
                <AppCard
                  key={a.id}
                  app={a}
                  onApprove={() => approve(a.id)}
                  onReject={() => setRejectApp(a)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
