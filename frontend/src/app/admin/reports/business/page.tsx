'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Download, BarChart2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface BusinessMetric {
  title: string;
  value: string;
  period: string;
  growth: string;
  growth_positive: boolean;
}

interface BusinessReportData {
  period: string;
  metrics: BusinessMetric[];
}

export default function BusinessReportsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'reports-business'],
    queryFn: () =>
      apiClient.get<ApiResponse<BusinessReportData>>('/analytics/reports/business').then((r) => r.data),
    staleTime: 300_000,
  });

  const report  = data?.data;
  const metrics = report?.metrics ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-600" /> Business Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Comprehensive business performance reports</p>
        </div>
        <button className="flex items-center gap-2 h-10 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
          <Download className="h-4 w-4" /> Export PDF
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">Failed to load business report</p>
          <button onClick={() => refetch()} className="text-sm font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      )}

      {/* Metric cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="h-3 w-28 rounded-full bg-slate-100 animate-pulse" />
              <div className="h-8 w-24 rounded-lg bg-slate-100 animate-pulse" />
              <div className="flex justify-between">
                <div className="h-3 w-20 rounded-full bg-slate-100 animate-pulse" />
                <div className="h-5 w-14 rounded-full bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : metrics.length === 0 && !isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <BarChart2 className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-900">No business report data yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Business metrics will appear here after your platform has processed activity
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map(({ title, period, value, growth, growth_positive }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">{title}</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-500">{period}</p>
                <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                  growth_positive
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-red-600 bg-red-50'
                }`}>
                  {growth}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
