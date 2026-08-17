'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Users, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

export default function AdminVerificationPage() {
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const { data: statsData } = useQuery({
    queryKey: ['admin', 'verification', 'stats'],
    queryFn: () => apiClient.get('/verification/admin/stats').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: appsData, isLoading } = useQuery({
    queryKey: ['admin', 'verification', 'apps', filter],
    queryFn: () => apiClient.get('/verification/admin/applications', {
      params: { status: filter || undefined, page_size: 50 },
    }).then(r => r.data),
    staleTime: 30_000,
  });

  const stats = statsData?.data;
  const apps = Array.isArray(appsData?.data) ? appsData.data : [];

  const KPI = [
    { label: 'Total',      value: stats?.total ?? 0,                color: '#4F46E5', bg: '#eef2ff', icon: Users },
    { label: 'Pending',    value: stats?.pending ?? 0,              color: '#D97706', bg: '#fffbeb', icon: Clock },
    { label: 'Approved',   value: stats?.approved ?? 0,             color: '#059669', bg: '#ecfdf5', icon: CheckCircle },
    { label: 'Rejected',   value: stats?.rejected ?? 0,             color: '#DC2626', bg: '#fef2f2', icon: XCircle },
    { label: 'More Info',  value: stats?.more_info_required ?? 0,   color: '#B45309', bg: '#fffbeb', icon: AlertCircle },
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
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <BadgeCheck className="h-6 w-6 text-indigo-600" /> Seller Verification
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Overview of all seller verification applications</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPI.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
              onClick={() => setFilter(k.label === 'Total' ? undefined : k.label.toLowerCase().replace(' ', '_'))}>
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
      {stats?.recent_approvals?.length > 0 && (
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
                  <p className="text-[11px] font-semibold text-slate-600">
                    {a.reviewer_name ? `by ${a.reviewer_name}` : 'Approved'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All applications table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap p-4 border-b border-slate-100 bg-slate-50">
          {STATUS_FILTERS.map(f => (
            <button key={f.label} onClick={() => setFilter(f.value as any)}
              className={`h-7 rounded-lg px-3 text-[11px] font-semibold capitalize transition-all ${
                filter === f.value
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : apps.length === 0 ? (
          <div className="py-16 text-center">
            <BadgeCheck className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-slate-900">No applications found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Applicant', 'Type', 'Location', 'Status', 'Submitted', 'Reviewed by', 'Date'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apps.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-[14px] font-semibold text-slate-900">{a.full_name || a.user_name}</p>
                        <p className="text-[11px] text-slate-400">{a.user_email}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 capitalize">{a.seller_type || '—'}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{[a.city, a.country].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs rounded-full border px-2.5 py-1 font-semibold capitalize ${
                          a.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : a.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100'
                            : a.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : a.status === 'under_review' ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {(a.status || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        {a.reviewer_full_name || a.reviewer_name ? (
                          <div>
                            <p className="text-[13px] font-semibold text-slate-700">{a.reviewer_full_name || a.reviewer_name}</p>
                            {a.reviewer_email && <p className="text-[11px] text-slate-400">{a.reviewer_email}</p>}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {apps.map((a: any) => (
                <div key={a.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-slate-900">{a.full_name || a.user_name}</p>
                      <p className="text-[11px] text-slate-400">{a.user_email}</p>
                    </div>
                    <span className={`text-[10px] rounded-full border px-2 py-0.5 font-semibold capitalize ${
                      a.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : a.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>{(a.status || '').replace(/_/g, ' ')}</span>
                  </div>
                  {(a.reviewer_full_name || a.reviewer_name) && (
                    <p className="text-[11px] text-slate-500">
                      Reviewed by <strong>{a.reviewer_full_name || a.reviewer_name}</strong>
                      {a.reviewed_at ? ` · ${new Date(a.reviewed_at).toLocaleDateString('en-NG')}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
