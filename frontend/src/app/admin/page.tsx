'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign, Users, Package, AlertTriangle,
  FileCheck, TrendingUp, TrendingDown,
  BarChart3, ShieldCheck, Crown, Zap, Activity,
  ChevronRight, Store, BarChart2, CreditCard,
} from 'lucide-react';
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ROUTES } from '@/config/routes';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

/* ── Types ─────────────────────────────────────── */
interface PlatformOverview {
  today_revenue: number;
  monthly_revenue: number;
  active_users: number;
  new_users_today: number;
  pending_listings: number;
  open_disputes: number;
  pending_kyc: number;
  escrow_held: number;
  active_listings?: number;
  total_listings?: number;
  total_messages?: number;
  currency: string;
}

interface RevenuePoint {
  date: string;
  revenue: number;
}

interface UserPoint {
  day: string;
  new_users: number;
}

interface LiveEvent {
  message: string;
  time_ago: string;
  event_type: string;
}

/* ── Skeleton card ──────────────────────────────── */
function KpiSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-slate-100" />
      <div className="flex items-start justify-between mb-3">
        <div className="h-3 w-28 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-8 w-8 rounded-xl bg-slate-100 animate-pulse" />
      </div>
      <div className="h-8 w-24 rounded-lg bg-slate-100 animate-pulse mb-1.5" />
      <div className="h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
    </div>
  );
}

/* ── Currency formatter ─────────────────────────── */
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

/* ── KPI card ───────────────────────────────────── */
function KpiCard({
  label, value, change, icon: Icon, color, bg, href,
}: {
  label: string; value: string; change?: number;
  icon: typeof DollarSign; color: string; bg: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm
        no-underline transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 leading-tight">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0" style={{ background: bg }}>
          <Icon className="h-4 w-4" style={{ color }} strokeWidth={2} />
        </div>
      </div>
      <p className="text-[1.4rem] font-black text-slate-900 tracking-tight leading-none">{value}</p>
      {change !== undefined && change !== 0 && (
        <div className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {change > 0 ? '+' : ''}{change}%
        </div>
      )}
    </Link>
  );
}

const QUICK_LINKS = [
  { icon: Users,         label: 'Manage Users',    href: ROUTES.admin.users,        color: '#4F46E5' },
  { icon: Store,         label: 'Manage Stores',   href: ROUTES.admin.stores,        color: '#7C3AED' },
  { icon: Package,       label: 'Review Listings', href: ROUTES.admin.listings,      color: '#D97706' },
  { icon: CreditCard,    label: 'Payments',        href: ROUTES.admin.payments,      color: '#059669' },
  { icon: Crown,         label: 'Subscriptions',   href: ROUTES.admin.subscriptions, color: '#7C3AED' },
  { icon: BarChart3,     label: 'View Reports',    href: ROUTES.admin.reports,       color: '#0369A1' },
];

const EVENT_DOT: Record<string, string> = {
  registration: 'bg-emerald-500',
  listing:      'bg-indigo-500',
  transaction:  'bg-amber-500',
  kyc:          'bg-sky-500',
  dispute:      'bg-red-500',
  subscription: 'bg-violet-500',
};

export default function AdminOverviewPage() {
  /* Platform overview KPIs */
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () =>
      apiClient
        .get<ApiResponse<PlatformOverview>>('/analytics/admin/overview')
        .then((r) => r.data),
    staleTime: 60_000,
  });

  /* Revenue chart — last 14 days */
  const { data: revenueChartData, isLoading: revenueChartLoading } = useQuery({
    queryKey: ['admin', 'revenue-chart'],
    queryFn: () =>
      apiClient
        .get<ApiResponse<RevenuePoint[]>>('/analytics/revenue/daily?days=14')
        .then((r) => r.data),
    staleTime: 60_000,
  });

  /* New-users chart — last 7 days */
  const { data: userChartData, isLoading: userChartLoading } = useQuery({
    queryKey: ['admin', 'user-chart'],
    queryFn: () =>
      apiClient
        .get<ApiResponse<UserPoint[]>>('/analytics/users/daily?days=7')
        .then((r) => r.data),
    staleTime: 60_000,
  });

  /* Live activity feed */
  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ['admin', 'live-activity'],
    queryFn: () =>
      apiClient
        .get<ApiResponse<LiveEvent[]>>('/analytics/activity/recent?limit=8')
        .then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  const ov = overviewData?.data;
  const revenueChart = revenueChartData?.data ?? [];
  const userChart    = userChartData?.data ?? [];
  const liveEvents   = liveData?.data ?? [];
  const currency     = ov?.currency ?? 'NGN';

  /* Build KPI config from real data */
  const KPI = ov
    ? [
        { label: 'Registered Users',  value: ov.active_users.toLocaleString(),         change: undefined, icon: Users,         color: '#4F46E5', bg: '#eef2ff', href: ROUTES.admin.users },
        { label: 'New Users Today',   value: (ov.new_users_today ?? 0).toLocaleString(), change: undefined, icon: Zap,           color: '#7C3AED', bg: '#f5f3ff', href: ROUTES.admin.users },
        { label: 'Active Listings',   value: (ov.active_listings ?? 0).toLocaleString(), change: undefined, icon: Package,       color: '#059669', bg: '#ecfdf5', href: ROUTES.admin.listings },
        { label: 'Pending Review',    value: ov.pending_listings.toLocaleString(),       change: undefined, icon: FileCheck,     color: '#D97706', bg: '#fffbeb', href: ROUTES.admin.listings },
        { label: 'Open Disputes',     value: ov.open_disputes.toLocaleString(),          change: undefined, icon: AlertTriangle, color: '#DC2626', bg: '#fef2f2', href: ROUTES.admin.disputes },
        { label: 'Pending KYC',       value: ov.pending_kyc.toLocaleString(),            change: undefined, icon: ShieldCheck,   color: '#0369A1', bg: '#e0f2fe', href: ROUTES.admin.kyc },
        { label: 'Messages Sent',     value: (ov.total_messages ?? 0).toLocaleString(),  change: undefined, icon: Crown,         color: '#059669', bg: '#ecfdf5', href: ROUTES.admin.users },
        { label: 'Revenue (30d)',      value: ov.monthly_revenue > 0 ? fmt(ov.monthly_revenue, currency) : '₦0', change: undefined, icon: DollarSign, color: '#059669', bg: '#ecfdf5', href: '/admin/payments' },
      ]
    : null;

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Business Overview</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[12px] font-semibold text-emerald-700">Platform live</span>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {overviewLoading || !KPI
          ? Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)
          : KPI.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Revenue 14d */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Revenue — Last 14 Days</h2>
              <p className="text-[12px] text-slate-400 mt-0.5">Total platform GMV</p>
            </div>
            <Link href={ROUTES.admin.revenue} className="text-[12px] font-semibold text-indigo-600 no-underline hover:underline">
              Full report →
            </Link>
          </div>
          <div className="h-52">
            {revenueChartLoading ? (
              <div className="h-full rounded-xl bg-slate-50 animate-pulse flex items-center justify-center">
                <p className="text-[12px] text-slate-400">Loading chart…</p>
              </div>
            ) : revenueChart.length === 0 || revenueChart.every(p => p.revenue === 0) ? (
              <div className="h-full rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                <BarChart2 className="h-8 w-8 text-slate-200" />
                <p className="text-[12px] text-slate-400">No revenue yet</p>
                <p className="text-[11px] text-slate-300">Revenue will appear here once transactions are processed</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }}
                    formatter={(v: number) => fmt(v, currency)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Live activity */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Activity className="h-4 w-4 text-indigo-600" />
            <h2 className="text-[14px] font-bold text-slate-900">Live Activity</h2>
            <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real-time
            </span>
          </div>
          {liveLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-full rounded-full bg-slate-100 animate-pulse" />
                    <div className="h-2 w-16 rounded-full bg-slate-100 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : liveEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <Activity className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-[12px] text-slate-400">No recent activity</p>
              <p className="text-[11px] text-slate-300 mt-1">Events will appear here as they happen</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {liveEvents.map((ev, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3">
                  <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${EVENT_DOT[ev.event_type] ?? 'bg-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-slate-700 leading-snug">{ev.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{ev.time_ago}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* New-users bar chart + quick links */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* User growth chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">New Users This Week</h2>
              <p className="text-[12px] text-slate-400 mt-0.5">Daily registrations</p>
            </div>
          </div>
          <div className="h-44">
            {userChartLoading ? (
              <div className="h-full rounded-xl bg-slate-50 animate-pulse flex items-center justify-center">
                <p className="text-[12px] text-slate-400">Loading chart…</p>
              </div>
            ) : userChart.length === 0 || userChart.every(p => p.new_users === 0) ? (
              <div className="h-full rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                <BarChart2 className="h-8 w-8 text-slate-200" />
                <p className="text-[12px] text-slate-400">No daily registration tracking yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userChart} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="new_users" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick management links */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-[14px] font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {QUICK_LINKS.map(({ icon: Icon, label, href, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl p-3 no-underline hover:bg-slate-50 transition-colors group"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} strokeWidth={2} />
                </div>
                <span className="flex-1 text-[13px] font-medium text-slate-700 group-hover:text-slate-900">
                  {label}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
