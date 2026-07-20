'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModPendingListingsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-pending-listings', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<PendingListing[]>>(`/mod/listings?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/listings/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-pending-listings'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/listings/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-pending-listings'] });
    },
  });

  const listings = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Listings</h1>
          <p className="text-gray-600 dark:text-gray-400">Review and approve new listings</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
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
            title="No pending listings"
            description="There are no listings awaiting review"
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
                      {listing.category} • {listing.location} • {listing.currency} {listing.price}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    listing.status === 'approved'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : listing.status === 'pending'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {listing.status}
                  </span>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {listing.description}
                </p>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <span>Seller: {listing.seller_name}</span>
                  <span>Submitted: {new Date(listing.created_at).toLocaleDateString()}</span>
                </div>

                {listing.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(listing.id)}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rejectMutation.mutate(listing.id)}
                      disabled={rejectMutation.isPending}
                    >
                      Reject
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

interface PendingListing {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  price: number;
  currency: string;
  seller_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}
