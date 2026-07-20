'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminRevenuePage() {
  const { session } = useAuth();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-revenue', period],
    queryFn: () =>
      apiClient.get<ApiResponse<RevenueData>>(`/admin/revenue?period=${period}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const revenue = data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Revenue Dashboard</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Track platform revenue and earnings</p>
        </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d', '1y'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                onClick={() => setPeriod(p)}
                size="sm"
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : revenue ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard
                label="Total Revenue"
                value={`₦${revenue.total_revenue.toLocaleString()}`}
                change={revenue.revenue_change}
              />
              <StatCard
                label="Platform Fees"
                value={`₦${revenue.platform_fees.toLocaleString()}`}
                change={revenue.fees_change}
              />
              <StatCard
                label="Transactions"
                value={revenue.total_transactions}
                change={revenue.transactions_change}
              />
              <StatCard
                label="Active Subscriptions"
                value={revenue.active_subscriptions}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Revenue Breakdown</h3>
                <div className="space-y-4">
                  {revenue.breakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{item.source}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ₦{item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Revenue Sources</h3>
                <div className="space-y-4">
                  {revenue.top_sources.map((source, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{source.name}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {source.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-600 dark:text-gray-400">No revenue data available</p>
          </div>
        )}
      </div>
  );
}

function StatCard({ label, value, change }: { label: string; value: string | number; change?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{value}</p>
      {change !== undefined && (
        <p className={`text-sm ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-000 dark:text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change}% from last period
        </p>
      )}
    </div>
  );
}

interface RevenueData {
  total_revenue: number;
  platform_fees: number;
  total_transactions: number;
  active_subscriptions: number;
  revenue_change?: number;
  fees_change?: number;
  transactions_change?: number;
  breakdown: Array<{ source: string; amount: number }>;
  top_sources: Array<{ name: string; percentage: number }>;
}
