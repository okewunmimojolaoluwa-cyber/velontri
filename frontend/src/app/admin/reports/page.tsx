'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart2, Users, Package, CreditCard, Download, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Overview {
  active_users: number;
  new_users_today: number;
  active_listings: number;
  total_listings: number;
  pending_listings: number;
  monthly_revenue: number;
  today_revenue: number;
  total_sub_payments: number;
  currency: string;
}
interface SalesData { today_sales: number; week_sales: number; total_orders: number; avg_order: number; currency: string; }

function fmt(n: number) {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0, notation: n >= 1_000_000 ? 'compact' : 'standard' }).format(n);
  } catch { return `₦${n.toLocaleString()}`; }
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: typeof Users; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${color}18` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-[1.6rem] font-black text-slate-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminReportsPage() {
  const { data: ovData, isLoading: ovLoading, isError: ovError, refetch } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => apiClient.get<ApiResponse<Overview>>('/analytics/admin/overview').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['admin', 'sales-report'],
    queryFn: () => apiClient.get<ApiResponse<SalesData>>('/analytics/sales').then(r => r.data),
    staleTime: 60_000,
  });

  const ov = ovData?.data;
  const sales = salesData?.data;
  const loading = ovLoading || salesLoading;

  if (ovError) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Business Reports</h1></div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load report data</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      </div>
    );
  }

  const STATS = ov && sales ? [
    { label: 'Registered Users',  value: ov.active_users.toLocaleString(),               sub: `+${ov.new_users_today} today`,                                icon: Users,       color: '#4F46E5' },
    { label: 'Active Listings',   value: ov.active_listings.toLocaleString(),             sub: `${ov.pending_listings} pending review`,                      icon: Package,     color: '#059669' },
    { label: 'Monthly Revenue',   value: fmt(ov.monthly_revenue),                        sub: `${fmt(ov.today_revenue)} today`,                             icon: CreditCard,  color: '#7C3AED' },
    { label: 'Total Payments',    value: ov.total_sub_payments.toLocaleString(),          sub: `${ov.total_listings} total listings`,                        icon: TrendingUp,  color: '#D97706' },
    { label: "Today's Sales",     value: fmt(sales.today_sales),                         sub: `${fmt(sales.week_sales)} this week`,                         icon: BarChart2,   color: '#0369A1' },
    { label: 'Total Orders',      value: sales.total_orders.toLocaleString(),             sub: `Avg ₦${Math.round(sales.avg_order).toLocaleString()} each`,  icon: TrendingUp,  color: '#059669' },
  ] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Business Reports</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Platform-wide metrics and analytics</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/revenue"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 no-underline hover:bg-slate-50 transition-colors">
            <BarChart2 className="h-4 w-4" /> Revenue Details
          </a>
          <a href="/admin/sales"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            <TrendingUp className="h-4 w-4" /> Sales Report
          </a>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {loading || !STATS
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
                <div className="h-3 w-28 rounded-full bg-slate-100 mb-3" />
                <div className="h-8 w-24 rounded-lg bg-slate-100 mb-1" />
                <div className="h-3 w-20 rounded-full bg-slate-100" />
              </div>
            ))
          : STATS.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Report sections */}
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { title: 'Sales Report',    href: '/admin/sales',    desc: 'Revenue by category, order volume, avg. order value' },
          { title: 'Revenue Report',  href: '/admin/revenue',  desc: 'Subscription revenue, payment history, plan breakdown' },
          { title: 'User Report',     href: '/admin/users',    desc: 'New registrations, active users, suspended accounts' },
          { title: 'Listings Report', href: '/admin/listings', desc: 'Active, pending, rejected listings by category' },
        ].map(({ title, href, desc }) => (
          <a key={title} href={href}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm no-underline hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
            <div>
              <p className="text-[15px] font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{title}</p>
              <p className="text-[12px] text-slate-400 mt-0.5">{desc}</p>
            </div>
            <Download className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />
          </a>
        ))}
      </div>

      <p className="text-center text-[12px] text-slate-400">
        Reports are generated from live database data. All figures are real-time.
      </p>
    </div>
  );
}
