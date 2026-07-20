'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminEscrowPage() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<'all' | 'active' | 'released' | 'disputed'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-escrow', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<EscrowTransaction[]>>(`/admin/escrow?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const transactions = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Escrow Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage all escrow transactions</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'active', 'released', 'disputed'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              onClick={() => setFilter(status)}
              size="sm"
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No escrow transactions"
            description="There are no escrow transactions matching your criteria"
          />
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Transaction #{tx.id}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {tx.listing_title} • {tx.currency} {tx.amount}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    tx.status === 'released'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : tx.status === 'active'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {tx.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Buyer</p>
                    <p className="font-medium text-gray-900 dark:text-white">{tx.buyer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Seller</p>
                    <p className="font-medium text-gray-900 dark:text-white">{tx.seller_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Created</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Platform Fee</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {tx.currency} {tx.platform_fee}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  {tx.status === 'active' && (
                    <Button variant="outline" size="sm">
                      Force Release
                    </Button>
                  )}
                  {tx.status === 'disputed' && (
                    <Button variant="outline" size="sm">
                      Resolve Dispute
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface EscrowTransaction {
  id: string;
  listing_title: string;
  amount: number;
  currency: string;
  platform_fee: number;
  buyer_name: string;
  seller_name: string;
  status: 'active' | 'released' | 'disputed';
  created_at: string;
}
