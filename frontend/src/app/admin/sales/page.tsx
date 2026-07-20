'use client';

import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, TrendingUp, Package, Users, BarChart2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

/* ── Types ─────────────────────────────────────── */
interface SalesData {
  today_sales: number;
  week_sales: number;
  total_orders: number;
  avg_order: number;
  currency: string;
}

interface CategorySales {
  category: string;
  total_amount: number;
  order_count: number;
  percentage: number;
}

function fmt(n: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);
  } catch {
    return `₦${n.toLocaleString()}`;
  }
}

export default function AdminSalesPage() {
  /* Core KPIs */
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['admin', 'sales'],
    queryFn: () =>
      apiClient.get<ApiResponse<SalesData>>('/analytics/sales').then((r) => r.data),
    staleTime: 60_000,
  });

  /* Category breakdown — separate query so the chart doesn't show loading
     just because the KPIs are stale */
  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: ['admin', 'sales-by-category'],
    queryFn: () =>
      apiClient.get<ApiResponse<CategorySales[]>>('/analytics/sales/by-category').then((r) => r.data),
    staleTime: 60_000,
  });

  const stats     = salesData?.data;
  const categories = catData?.data ?? [];
  const currency   = stats?.currency ?? 'NGN';

  const KPI_CARDS = stats
    ? [
        { label: "Today's Sales", value: fmt(stats.today_sales, currency), icon: ShoppingCart, color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
        { label: 'Weekly Sales',  value: fmt(stats.week_sales, currency),  icon: TrendingUp,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Total Orders',  value: stats.total_orders.toLocaleString(),                  icon: Package,      color: 'text-violet-600', bg: 'bg-violet-50' },
        { label: 'Avg. Order',    value: fmt(stats.avg_order, currency),    icon: Users,        color: 'text-amber-600',  bg: 'bg-amber-50'   },
      ]
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track sales performance across the platform</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {salesLoading || !KPI_CARDS
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse mb-3" />
                <div className="h-7 w-20 rounded-lg bg-slate-100 animate-pulse mb-1" />
                <div className="h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))
          : KPI_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg} mb-3`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className="text-2xl font-black text-slate-900">{value}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-6">Sales by Category</h3>
        {catLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-28 space-y-1 flex-shrink-0">
                  <div className="h-4 w-20 rounded-full bg-slate-100 animate-pulse" />
                  <div className="h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
                </div>
                <div className="flex-1 h-3 rounded-full bg-slate-100 animate-pulse" />
                <div className="w-20 h-4 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <BarChart2 className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-900">No sales data yet</p>
            <p className="text-xs text-slate-400 mt-1">Sales by category will appear after your first successful orders</p>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map(({ category, total_amount, order_count, percentage }) => (
              <div key={category} className="flex items-center gap-4">
                <div className="w-28 flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{category}</p>
                  <p className="text-xs text-slate-500">{order_count.toLocaleString()} orders</p>
                </div>
                <div className="flex-1 h-3 rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-indigo-500 transition-all duration-700"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-20 text-right text-sm font-bold text-slate-900">
                  {fmt(total_amount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
