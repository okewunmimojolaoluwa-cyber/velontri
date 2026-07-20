'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard, Search, DollarSign, TrendingUp,
  Calendar, Package, CheckCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

/* ── Types ──────────────────────────────────────────────── */
interface SubPayment {
  id:         string;
  user_id:    string;
  user_name:  string;
  user_email: string;
  plan:       string;
  reference:  string;
  amount:     number;
  currency:   string;
  status:     string;
  paid_at:    string;
}

interface RevSummary {
  today:          number;
  monthly:        number;
  all_time:       number;
  total_payments: number;
  plan_breakdown: { plan: string; count: number; revenue: number }[];
  currency:       string;
}

/* ── Helpers ────────────────────────────────────────────── */
function fmt(n: number, cur = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(n);
  } catch { return `₦${n.toLocaleString()}`; }
}

const PLAN_COLOR: Record<string, string> = {
  starter:    'bg-indigo-50 text-indigo-700 border-indigo-200',
  business:   'bg-violet-50 text-violet-700 border-violet-200',
  enterprise: 'bg-amber-50  text-amber-700  border-amber-200',
};

/* ── Page ────────────────────────────────────────────────── */
export default function AdminPaymentsPage() {
  const [search, setSearch] = useState('');

  /* Revenue summary */
  const { data: summaryData } = useQuery({
    queryKey: ['admin', 'revenue', 'summary'],
    queryFn: () =>
      apiClient.get<ApiResponse<RevSummary>>('/admin/revenue/summary').then(r => r.data),
    staleTime: 30_000,
  });

  /* Payments list */
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['admin', 'payments'],
    queryFn: () =>
      apiClient.get<ApiResponse<SubPayment[]>>('/admin/payments', {
        params: { page: 1, page_size: 100 },
      }).then(r => r.data),
    staleTime: 30_000,
  });

  const summary = summaryData?.data;
  const allPayments: SubPayment[] = Array.isArray(paymentsData?.data) ? paymentsData.data : [];

  const payments = allPayments.filter(p =>
    !search ||
    p.reference.toLowerCase().includes(search.toLowerCase()) ||
    p.user_email.toLowerCase().includes(search.toLowerCase()) ||
    p.user_name.toLowerCase().includes(search.toLowerCase()) ||
    p.plan.toLowerCase().includes(search.toLowerCase())
  );

  const currency = summary?.currency ?? 'NGN';

  /* KPI cards */
  const KPI = [
    {
      label: 'Today\'s Revenue', value: fmt(summary?.today ?? 0, currency),
      icon: DollarSign, color: '#059669', bg: '#ecfdf5',
    },
    {
      label: 'Monthly Revenue (30d)', value: fmt(summary?.monthly ?? 0, currency),
      icon: TrendingUp, color: '#4F46E5', bg: '#eef2ff',
    },
    {
      label: 'All-Time Revenue', value: fmt(summary?.all_time ?? 0, currency),
      icon: CreditCard, color: '#7C3AED', bg: '#f5f3ff',
    },
    {
      label: 'Total Payments', value: (summary?.total_payments ?? 0).toString(),
      icon: CheckCircle, color: '#D97706', bg: '#fffbeb',
    },
  ];

  return (
    <div className="space-y-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-indigo-600" /> Subscription Payments
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              All Paystack subscription payments — Velontri's revenue
            </p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              placeholder="Search name, email, plan…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 w-full sm:w-64 rounded-xl border border-slate-200 pl-9 pr-4 text-sm text-slate-800
                placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>
        </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPI.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: bg }}>
                <Icon className="h-4 w-4" style={{ color }} strokeWidth={2} />
              </div>
            </div>
            <p className="text-[1.3rem] font-black text-slate-900 tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      {(summary?.plan_breakdown?.length ?? 0) > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {summary!.plan_breakdown.map(p => (
            <div key={p.plan}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-slate-900 capitalize">{p.plan} Plan</p>
                <p className="text-[11px] text-slate-400">{p.count} payment{p.count !== 1 ? 's' : ''}</p>
                <p className="text-[14px] font-black text-emerald-600">{fmt(p.revenue, currency)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payments table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Empty / no real payments */}
        {!isLoading && allPayments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
              <CreditCard className="h-8 w-8 text-indigo-300" />
            </div>
            <p className="text-[15px] font-bold text-slate-900 mb-1">No payments yet</p>
            <p className="text-[13px] text-slate-400 max-w-xs">
              Payments will appear here once users subscribe to a plan via Paystack.
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Table */}
        {!isLoading && payments.length > 0 && (
          <>
            {/* ── Mobile: card list ──────────────────────── */}
            <div className="space-y-3 lg:hidden">
              {payments.map(p => (
                <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 truncate">{p.user_name || 'User'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{p.user_email}</p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${PLAN_COLOR[p.plan] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {p.plan}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[16px] font-black text-emerald-600">{fmt(p.amount, p.currency)}</p>
                    <p className="text-[11px] text-slate-400">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <p className="font-mono text-[10px] text-slate-400 truncate">{p.reference}</p>
                </div>
              ))}
            </div>

            {/* ── Desktop: table ─────────────────────────── */}
            <div className="hidden lg:block overflow-x-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['User', 'Plan', 'Amount', 'Reference', 'Date'].map(h => (
                      <th key={h}
                        className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-[13px] font-semibold text-slate-900 truncate max-w-[140px]">
                          {p.user_name || 'User'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{p.user_email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${PLAN_COLOR[p.plan] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {p.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[14px] font-black text-emerald-600">
                          {fmt(p.amount, p.currency)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-[11px] text-slate-500 truncate max-w-[160px]">
                          {p.reference}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-[12px] text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {p.paid_at
                            ? new Date(p.paid_at).toLocaleDateString('en-NG', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })
                            : '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Search no results */}
        {!isLoading && search && payments.length === 0 && allPayments.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-8 w-8 text-slate-200 mb-2" />
            <p className="text-[13px] text-slate-500">No payments match "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
