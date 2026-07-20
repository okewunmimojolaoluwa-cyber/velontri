'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, DollarSign, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ReferralsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'referrals'],
    queryFn: () => apiClient.get<ApiResponse<ReferralStats>>('/admin/referrals/stats').then(r => r.data),
  });

  const stats = data?.data;

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Referral Programme</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track referral performance and payouts</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Referrals',    value: stats ? stats.total_referrals.toLocaleString() : '—',                icon: Users,       color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Total Earnings',     value: stats ? `₦${(stats.total_earnings / 1000).toFixed(0)}K` : '—',       icon: DollarSign,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Conversion Rate',    value: stats ? `${stats.conversion_rate.toFixed(1)}%` : '—',                icon: TrendingUp,  color: 'text-violet-600', bg: 'bg-violet-50' },
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
          <div className="space-y-3">
            {isLoading ? (
              [...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)
            ) : (
              <p className="text-sm text-slate-500 py-8 text-center">Referral data will appear here once users start referring others.</p>
            )}
          </div>
        </div>
      </div>
    
  );
}

interface ReferralStats { total_referrals: number; total_earnings: number; conversion_rate: number; }
