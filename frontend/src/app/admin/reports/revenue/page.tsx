'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign, Download, BarChart2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface RevenueStream {
  name: string;
  amount: number;
  percentage: number;
  color_class: string;
}

interface RevenueReportData {
  currency: string;
  total_ytd: number;
  monthly_recurring: number;
  commission_revenue: number;
  streams: RevenueStream[];
}

function fmt(n: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency, maximumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);
  } catch { return `₦${n.toLocaleString()}`; }
}

export default function RevenueReportsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'reports-revenue'],
    queryFn: () =>
      apiClient.get<ApiResponse<RevenueReportData>>('/analytics/reports/revenue').then((r) => r.data),
    staleTime: 300_000,
  });

  const report   = data?.data;
  const currency = report?.currency ?? 'NGN';
  const streams  = report?.streams ?? [];

  const SUMMARY_CARDS = report
    ? [
        { label: 'Total Revenue (YTD)',  value: fmt(report.total_ytd, currency),          sub: 'Year to date' },
        { label: 'Monthly Recurring',    value: fmt(report.monthly_recurring, currency),   sub: 'Subscriptions' },
        { label: 'Commission Revenue',   value: fmt(report.commission_revenue, currency),  sub: 'Transaction fees' },
      ]
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600" /> Revenue Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Revenue breakdown by stream</p>
        </div>
        <button className="flex items-center gap-2 h-10 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">Failed to load revenue report</p>
          <button onClick={() => refetch()} className="text-sm font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading || !SUMMARY_CARDS
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="h-3 w-32 rounded-full bg-slate-100 animate-pulse" />
                <div className="h-8 w-24 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-3 w-20 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))
          : SUMMARY_CARDS.map(({ label, value, sub }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
                <p className="text-3xl font-black text-slate-900">{value}</p>
                <p className="text-xs text-emerald-600 font-semibold mt-1">{sub}</p>
              </div>
            ))}
      </div>

      {/* Revenue streams breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Revenue Streams</h3>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-48 h-4 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 h-3 rounded-full bg-slate-100 animate-pulse" />
                <div className="w-20 h-4 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart2 className="h-10 w-10 text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">No revenue streams data yet</p>
            <p className="text-xs text-slate-400 mt-1">Revenue will appear here after your first successful transactions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {streams.map(({ name, amount, percentage, color_class }) => (
              <div key={name} className="flex items-center gap-4">
                <div className="w-48">
                  <p className="text-sm font-semibold text-slate-900">{name}</p>
                </div>
                <div className="flex-1 h-3 rounded-full bg-slate-100">
                  <div className={`h-3 rounded-full ${color_class}`} style={{ width: `${percentage}%` }} />
                </div>
                <span className="w-20 text-right text-sm font-bold text-slate-900">
                  {fmt(amount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
