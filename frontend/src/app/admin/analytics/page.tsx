'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminAnalyticsPage() {
  const { session } = useAuth();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics', period],
    queryFn: () =>
      apiClient.get<ApiResponse<AnalyticsData>>(`/admin/analytics?period=${period}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const analytics = data?.data;

  return (
    
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Analytics</h1>
            <p className="text-gray-600 dark:text-gray-400">Overview of platform performance and metrics</p>
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((p) => (
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
        ) : analytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="Total Users" value={analytics.total_users} change={analytics.users_change} />
              <StatCard label="Active Listings" value={analytics.active_listings} change={analytics.listings_change} />
              <StatCard label="Total Transactions" value={analytics.total_transactions} change={analytics.transactions_change} />
              <StatCard label="Revenue" value={`₦${analytics.revenue.toLocaleString()}`} change={analytics.revenue_change} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">User Growth</h3>
                <div className="space-y-3">
                  {analytics.user_growth.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{item.period}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Categories</h3>
                <div className="space-y-3">
                  {analytics.top_categories.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{cat.name}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{cat.listings} listings</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Geographic Distribution</h3>
                <div className="space-y-3">
                  {analytics.geo_distribution.map((loc, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{loc.location}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{loc.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Device Usage</h3>
                <div className="space-y-3">
                  {analytics.device_usage.map((device, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{device.type}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{device.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-600 dark:text-gray-400">No analytics data available</p>
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
        <p className={`text-sm ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change}% from last period
        </p>
      )}
    </div>
  );
}

interface AnalyticsData {
  total_users: number;
  active_listings: number;
  total_transactions: number;
  revenue: number;
  users_change?: number;
  listings_change?: number;
  transactions_change?: number;
  revenue_change?: number;
  user_growth: Array<{ period: string; count: number }>;
  top_categories: Array<{ name: string; listings: number }>;
  geo_distribution: Array<{ location: string; percentage: number }>;
  device_usage: Array<{ type: string; percentage: number }>;
}
