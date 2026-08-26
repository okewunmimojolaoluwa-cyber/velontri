'use client';

import { useState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Report {
  id: string;
  type: string;
  description: string;
  reporter_name: string;
  target_type: string;
  target_id: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
}

export default function ModReportsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('open');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mod-reports', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Report[]>>(`/mod/reports?status=${filter}`)
        .then((r) => r.data),
    enabled: session.isAuthenticated,
    retry: false,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reports/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-reports'] }),
    onError: (err: any) => alert(err?.message || 'Failed to resolve report.'),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reports/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-reports'] }),
    onError: (err: any) => alert(err?.message || 'Failed to dismiss report.'),
  });

  const reports: Report[] = Array.isArray(data?.data) ? data.data as Report[] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Warning className="h-5 w-5 text-amber-500" /> Reports
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Review user reports and violations</p>
      </div>

      <div className="flex gap-1.5">
        {(['all', 'open', 'resolved', 'dismissed'] as const).map((s) => (
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
          <p className="text-[13px] text-amber-600">User reporting system will be available in a future update.</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 && !isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Warning className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">No reports</p>
          <p className="text-[12px] text-slate-400">
            {filter !== 'all' ? `No ${filter} reports.` : 'No reports have been filed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <p className="text-[14px] font-bold text-slate-900">{report.type}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    Reported by {report.reporter_name} · {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                    report.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100'
                      : report.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {report.priority}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
                    report.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : report.status === 'open' ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {report.status}
                  </span>
                </div>
              </div>
              <p className="text-[13px] text-slate-600 mb-3">{report.description}</p>
              <p className="text-[12px] text-slate-400 mb-3">
                Target: {report.target_type} · ID: {report.target_id}
              </p>
              {report.status === 'open' && (
                <div className="flex gap-2">
                  <button onClick={() => resolveMutation.mutate(report.id)} disabled={resolveMutation.isPending}
                    className="h-8 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    Resolve
                  </button>
                  <button onClick={() => dismissMutation.mutate(report.id)} disabled={dismissMutation.isPending}
                    className="h-8 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Dismiss
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