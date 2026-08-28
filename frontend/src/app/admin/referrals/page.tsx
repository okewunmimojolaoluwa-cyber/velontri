'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, CurrencyDollar, TrendUp } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface ReferralStats {
 total_referrals: number;
 pending_rewards: number;
 paid_rewards: number;
 conversion_rate: number;
 top_referrers: { name: string; referrals: number; earnings: number }[];
 currency: string;
}

export default function ReferralsPage() {
 const { data, isLoading, isError, refetch } = useQuery({
 queryKey: ['admin', 'referrals'],
 queryFn: () =>
 apiClient.get<ApiResponse<ReferralStats>>('/admin/referrals/stats').then(r => r.data),
 staleTime: 60_000,
 });

 const stats = data?.data;
 const totalEarnings = stats ? (stats.paid_rewards ?? 0) + (stats.pending_rewards ?? 0) : 0;

 if (isError) {
 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-2xl font-black text-slate-900 tracking-tight">Referral Programme</h1>
 </div>
 <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
 <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load referral data</p>
 <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-2xl font-black text-slate-900 tracking-tight">Referral Programme</h1>
 <p className="text-sm text-slate-500 mt-0.5">Track referral performance and payouts</p>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {[
 { label: 'Total Referrals', value: stats ? stats.total_referrals.toLocaleString() : ' ', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
 { label: 'Total Rewards', value: stats ? `₦${totalEarnings.toLocaleString()}` : ' ', icon: CurrencyDollar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
 { label: 'Conversion Rate', value: stats ? `${(stats.conversion_rate ?? 0).toFixed(1)}%` : ' ', icon: TrendUp, color: 'text-violet-600', bg: 'bg-violet-50' },
 ].map(({ label, value, icon: Icon, color, bg }) => (
 <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
 <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg} mb-3`}>
 <Icon className={`h-5 w-5 ${color}`} />
 </div>
 <p className="text-2xl font-black text-slate-900">{isLoading ? '…' : value}</p>
 <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
 </div>
 ))}
 </div>

 <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
 <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Top Referrers</h3>
 {isLoading ? (
 <div className="space-y-3">
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
 ))}
 </div>
 ) : stats?.top_referrers?.length ? (
 <div className="space-y-3">
 {stats.top_referrers.map((r, i) => (
 <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
 <p className="text-[14px] font-semibold text-slate-900">{r.name}</p>
 <div className="flex items-center gap-4 text-[13px] text-slate-500">
 <span>{r.referrals} referrals</span>
 <span className="font-bold text-emerald-700">₦{r.earnings.toLocaleString()}</span>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-slate-500 py-8 text-center">
 Referral data will appear here once users start referring others.
 </p>
 )}
 </div>
 </div>
 );
}