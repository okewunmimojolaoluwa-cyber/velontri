'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModReportedListingsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('open');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-reported-listings', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<ReportedListing[]>>(`/mod/reported-listings?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reported-listings/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-reported-listings'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reported-listings/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-reported-listings'] });
    },
  });

  const listings = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reported Listings</h1>
          <p className="text-gray-600 dark:text-gray-400">Review listings reported by users</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'open', 'resolved', 'dismissed'] as const).map((status) => (
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
        ) : listings.length === 0 ? (
          <EmptyState
            title="No reported listings"
            description="There are no reported listings matching your criteria"
          />
        ) : (
          <div className="space-y-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{listing.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Reported by {listing.reporter_name} • {new Date(listing.reported_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    listing.status === 'resolved'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : listing.status === 'open'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {listing.status}
                  </span>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  <strong>Reason:</strong> {listing.reason}
                </p>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <span>Seller: {listing.seller_name}</span>
                  <span>Reports: {listing.report_count}</span>
                </div>

                {listing.status === 'open' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => resolveMutation.mutate(listing.id)}
                      disabled={resolveMutation.isPending}
                    >
                      Resolve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => dismissMutation.mutate(listing.id)}
                      disabled={dismissMutation.isPending}
                    >
                      Dismiss
                    </Button>
                    <Button variant="outline" size="sm">
                      View Listing
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

interface ReportedListing {
  id: string;
  title: string;
  reason: string;
  reporter_name: string;
  seller_name: string;
  report_count: number;
  status: 'open' | 'resolved' | 'dismissed';
  reported_at: string;
}
