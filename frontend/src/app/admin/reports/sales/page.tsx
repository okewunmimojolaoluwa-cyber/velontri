'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, BarChart2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface MonthlySales {
  month: string;          // "Jan", "Feb", …
  volume: number;         // raw amount in currency
}

interface CategorySales {
  category: string;
  amount: number;
  percentage: number;
  color_class: string;
}

interface SalesReportData {
  currency: string;
  monthly: MonthlySales[];
  by_category: CategorySales[];
}

function fmt(n: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency, maximumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);
  } catch { return `₦${n.toLocaleString()}`; }
}

export default function SalesReportsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'reports-sales'],
    queryFn: () =>
      apiClient.get<ApiResponse<SalesReportData>>('/analytics/reports/sales').then((r) => r.data),
    staleTime: 300_000,
  });

  const report   = data?.data;
  const monthly  = report?.monthly ?? [];
  const byCategory = report?.by_category ?? [];
  const currency = report?.currency ?? 'NGN';
  const maxVol   = monthly.length ? Math.max(...monthly.map((m) => m.volume)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" /> Sales Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Monthly sales breakdown across all categories</p>
        </div>
        <button className="flex items-center gap-2 h-10 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">Failed to load sales report</p>
          <button onClick={() => refetch()} className="text-sm font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      )}

      {/* Monthly bar chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-6">
          Sales Volume — This Year ({currency})
        </h3>
        {isLoading ? (
          <div className="h-48 flex items-end gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-slate-100 animate-pulse" style={{ height: `${40 + Math.floor(i * 4)}%` }} />
                <div className="h-2 w-5 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : monthly.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2">
            <BarChart2 className="h-10 w-10 text-slate-200" />
            <p className="text-sm text-slate-400">No sales data available yet</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {monthly.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-slate-600">{fmt(m.volume, currency)}</span>
                <div
                  className="w-full rounded-t-lg bg-indigo-500 hover:bg-indigo-600 transition-colors"
                  style={{ height: `${(m.volume / maxVol) * 100}%`, minHeight: 4 }}
                />
                <span className="text-[10px] text-slate-500">{m.month}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
          Sales by Category (Last 30 days)
        </h3>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-28 h-4 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 h-3 rounded-full bg-slate-100 animate-pulse" />
                <div className="w-20 h-4 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : byCategory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <BarChart2 className="h-10 w-10 text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">No category sales data yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {byCategory.map(({ category, amount, percentage, color_class }) => (
              <div key={category} className="flex items-center gap-4">
                <div className="w-28">
                  <p className="text-sm font-semibold text-slate-900">{category}</p>
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
