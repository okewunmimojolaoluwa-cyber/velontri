'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModDisputesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'resolved' | 'escalated' | 'all'>('open');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-disputes', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<Dispute[]>>(`/mod/disputes?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/disputes/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-disputes'] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/disputes/${id}/escalate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-disputes'] });
    },
  });

  const disputes = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Disputes</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage transaction disputes and conflicts</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'open', 'resolved', 'escalated'] as const).map((status) => (
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
        ) : disputes.length === 0 ? (
          <EmptyState
            title="No disputes found"
            description="There are no disputes matching your criteria"
          />
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <div
                key={dispute.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Dispute #{dispute.id}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {dispute.listing_title} • {dispute.currency} {dispute.amount}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    dispute.status === 'resolved'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : dispute.status === 'open'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {dispute.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Buyer</p>
                    <p className="font-medium text-gray-900 dark:text-white">{dispute.buyer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Seller</p>
                    <p className="font-medium text-gray-900 dark:text-white">{dispute.seller_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Opened</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Reason</p>
                    <p className="font-medium text-gray-900 dark:text-white">{dispute.reason}</p>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {dispute.description}
                </p>

                {dispute.status === 'open' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => resolveMutation.mutate(dispute.id)}
                      disabled={resolveMutation.isPending}
                    >
                      Resolve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => escalateMutation.mutate(dispute.id)}
                      disabled={escalateMutation.isPending}
                    >
                      Escalate to Admin
                    </Button>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface Dispute {
  id: string;
  listing_title: string;
  amount: number;
  currency: string;
  buyer_name: string;
  seller_name: string;
  reason: string;
  description: string;
  status: 'open' | 'resolved' | 'escalated';
  created_at: string;
}
