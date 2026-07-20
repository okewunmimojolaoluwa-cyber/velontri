'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminWalletPage() {
  const { session } = useAuth();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-wallet', period],
    queryFn: () =>
      apiClient.get<ApiResponse<WalletStats>>(`/admin/wallet?period=${period}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const stats = data?.data;

  return (
    
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet Overview</h1>
            <p className="text-gray-600 dark:text-gray-400">Platform wallet statistics and transactions</p>
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
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="Total Balance" value={`₦${stats.total_balance.toLocaleString()}`} />
              <StatCard label="Pending Withdrawals" value={`₦${stats.pending_withdrawals.toLocaleString()}`} />
              <StatCard label="Total Deposits" value={`₦${stats.total_deposits.toLocaleString()}`} />
              <StatCard label="Total Withdrawals" value={`₦${stats.total_withdrawals.toLocaleString()}`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Transactions</h3>
                <div className="space-y-3">
                  {stats.recent_transactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{tx.type}</p>
                        <p className="text-gray-500 dark:text-gray-400">{tx.user}</p>
                      </div>
                      <span className={`font-medium ${
                        tx.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        ₦{tx.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Withdrawal Requests</h3>
                <div className="space-y-3">
                  {stats.pending_withdrawals_list.map((req, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{req.user}</p>
                        <p className="text-gray-500 dark:text-gray-400">{req.bank}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-white">₦{req.amount.toLocaleString()}</p>
                        <p className="text-gray-500 dark:text-gray-400">{req.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-600 dark:text-gray-400">No wallet data available</p>
          </div>
        )}
      </div>
    
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

interface WalletStats {
  total_balance: number;
  pending_withdrawals: number;
  total_deposits: number;
  total_withdrawals: number;
  recent_transactions: Array<{ type: string; user: string; amount: number }>;
  pending_withdrawals_list: Array<{ user: string; bank: string; amount: number; date: string }>;
}
