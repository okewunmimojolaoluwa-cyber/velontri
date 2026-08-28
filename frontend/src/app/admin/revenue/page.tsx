'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CurrencyDollar, TrendUp, CreditCard, Crown, ChartBar } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import {
 AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface RevenueSummary {
 today: number;
 monthly: number;
 all_time: number;
 total_payments: number;
 plan_breakdown: { plan: string; count: number; revenue: number }[];
 currency: string;
}

interface RevenuePoint {
 date: string;
 revenue: number;
}

function fmt(n: number) {
 try {
 return new Intl.NumberFormat('en-NG', {
 style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
 notation: n >= 1_000_000 ? 'compact' : 'standard',
 }).format(n);
 } catch {
 return `₦${n.toLocaleString()}`;
 }
}

const PERIODS = ['7d', '30d', '90d', '1y'] as const;
type Period = typeof PERIODS[number];

export default function AdminRevenuePage() {
 const [period, setPeriod] = useState<Period>('30d');

 const { data: summaryData, isLoading: sumLoading, isError: sumError, refetch: refetchSum } = useQuery({
 queryKey: ['admin', 'revenue-summary'],
 queryFn: () =>
 apiClient.get<ApiResponse<RevenueSummary>>('/admin/revenue/summary').then(r => r.data),
 staleTime: 60_000,
 });

 const days = period === '7d' ? 7 : period === '30d' ? 14 : period === '90d' ? 30 : 60;
 const { data: chartData, isLoading: chartLoading } = useQuery({
 queryKey: ['admin', 'revenue-chart', period],
 queryFn: () =>
 apiClient.get<ApiResponse<RevenuePoint[]>>(`/analytics/revenue/daily?days=${days}`).then(r => r.data),
 staleTime: 60_000,
 });

 const summary = summaryData?.data;
 const chart = Array.isArray(chartData?.data) ? chartData.data : [];
 const hasRevenue = chart.some(p => p.revenue > 0);

 const KPIs = summary ? [
 { label: "Today's Revenue", value: fmt(summary.today), icon: CurrencyDollar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
 { label: 'Monthly Revenue', value: fmt(summary.monthly), icon: TrendUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
 { label: 'All-time Revenue', value: fmt(summary.all_time), icon: Crown, color: 'text-violet-600', bg: 'bg-violet-50' },
 { label: 'Total Payments', value: summary.total_payments.toLocaleString(), icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
 ] : null;

 if (sumError) {
 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Revenue Dashboard</h1>
 </div>
 <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
 <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load revenue data</p>
 <button onClick={() => refetchSum()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex items-start justify-between flex-wrap gap-4">
 <div>
 <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Revenue Dashboard</h1>
 <p className="text-[13px] text-slate-400 mt-0.5">Platform subscription revenue from Paystack</p>
 </div>
 <div className="flex gap-1.5">
 {PERIODS.map(p => (
 <button key={p} onClick={() => setPeriod(p)}
 className={`h-9 rounded-xl border px-4 text-[13px] font-semibold transition-colors ${
 period === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
 }`}>
 {p}
 </button>
 ))}
 </div>
 </div>

      {/* KPI cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {sumLoading || !KPIs
 ? Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
 <div className="h-10 w-10 rounded-xl bg-slate-100 mb-3" />
 <div className="h-7 w-24 rounded-lg bg-slate-100 mb-1" />
 <div className="h-3 w-20 rounded-full bg-slate-100" />
 </div>
 ))
 : KPIs.map(({ label, value, icon: Icon, color, bg }) => (
 <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
 <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg} mb-3`}>
 <Icon className={`h-5 w-5 ${color}`} />
 </div>
 <p className="text-[22px] font-black text-slate-900">{value}</p>
 <p className="text-[11px] font-medium text-slate-500 mt-0.5">{label}</p>
 </div>
 ))}
 </div>

      {/* Revenue chart */}
 <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
 <h2 className="text-[15px] font-bold text-slate-900 mb-5">Revenue Chart</h2>
 <div className="h-56">
 {chartLoading ? (
 <div className="h-full rounded-xl bg-slate-50 animate-pulse flex items-center justify-center">
 <p className="text-[12px] text-slate-400">Loading chart…</p>
 </div>
 ) : !hasRevenue ? (
 <div className="h-full rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
 <ChartBar className="h-10 w-10 text-slate-200" />
 <p className="text-[13px] text-slate-400">No revenue yet</p>
 <p className="text-[11px] text-slate-300">Revenue appears after the first Paystack payment</p>
 </div>
 ) : (
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={chart} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
 <defs>
 <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
 <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
 <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
 <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
 <Tooltip
 contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }}
 formatter={(v: number) => fmt(v)}
 />
 <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fill="url(#revGrad)" dot={false} />
 </AreaChart>
 </ResponsiveContainer>
 )}
 </div>
 </div>

      {/* Plan breakdown */}
 {summary?.plan_breakdown && summary.plan_breakdown.length > 0 && (
 <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
 <h2 className="text-[15px] font-bold text-slate-900 mb-5">Revenue by Plan</h2>
 <div className="space-y-3">
 {summary.plan_breakdown.map(({ plan, count, revenue }) => {
 const pct = summary.all_time > 0 ? (revenue / summary.all_time) * 100 : 0;
 return (
 <div key={plan} className="flex items-center gap-4">
 <div className="w-24 flex-shrink-0">
 <p className="text-[13px] font-semibold text-slate-900 capitalize">{plan}</p>
 <p className="text-[11px] text-slate-400">{count} payment{count !== 1 ? 's' : ''}</p>
 </div>
 <div className="flex-1 h-2.5 rounded-full bg-slate-100">
 <div
 className="h-2.5 rounded-full bg-indigo-500 transition-all duration-700"
 style={{ width: `${pct}%` }}
 />
 </div>
 <span className="w-24 text-right text-[13px] font-bold text-slate-900">{fmt(revenue)}</span>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 );
}