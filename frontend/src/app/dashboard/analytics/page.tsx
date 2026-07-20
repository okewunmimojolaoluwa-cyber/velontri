'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function UserAnalyticsPage() {
  const { session } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['user-analytics'],
    queryFn: () =>
      apiClient.get<ApiResponse<UserAnalytics>>('/users/me/analytics').then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const analytics = data?.data;

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your buying and selling activity</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ))}
          </div>
        ) : analytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard
                label="Total Orders"
                value={analytics.total_orders}
                change={analytics.orders_change}
              />
              <StatCard
                label="Total Spent"
                value={`₦${analytics.total_spent.toLocaleString()}`}
                change={analytics.spent_change}
              />
              <StatCard
                label="Total Sales"
                value={`₦${analytics.total_sales.toLocaleString()}`}
                change={analytics.sales_change}
              />
              <StatCard
                label="Active Listings"
                value={analytics.active_listings}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {analytics.recent_activity.map((activity, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{activity.action}</span>
                      <span className="text-gray-900 dark:text-white">{activity.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Categories</h3>
                <div className="space-y-4">
                  {analytics.top_categories.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{cat.category}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{cat.count} orders</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-600 dark:text-gray-400">No analytics data available yet</p>
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
          {change >= 0 ? '+' : ''}{change}% from last month
        </p>
      )}
    </div>
  );
}

interface UserAnalytics {
  total_orders: number;
  total_spent: number;
  total_sales: number;
  orders_change?: number;
  spent_change?: number;
  sales_change?: number;
  active_listings: number;
  recent_activity: Array<{ action: string; date: string }>;
  top_categories: Array<{ category: string; count: number }>;
}
