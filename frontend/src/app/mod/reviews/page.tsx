'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModReviewsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'flagged' | 'approved' | 'removed'>('flagged');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-reviews', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<ModReview[]>>(`/mod/reviews?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reviews/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-reviews'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reviews/${id}/remove`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-reviews'] });
    },
  });

  const reviews = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Review Moderation</h1>
          <p className="text-gray-600 dark:text-gray-400">Review flagged user reviews</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'flagged', 'approved', 'removed'] as const).map((status) => (
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
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            title="No reviews found"
            description="There are no reviews matching your criteria"
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Review by {review.reviewer_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      For: {review.listing_title} • {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={`text-lg ${i < review.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-4">{review.comment}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <span>Seller: {review.seller_name}</span>
                  {review.flag_reason && <span>Flagged: {review.flag_reason}</span>}
                </div>

                {review.status === 'flagged' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(review.id)}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeMutation.mutate(review.id)}
                      disabled={removeMutation.isPending}
                    >
                      Remove
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

interface ModReview {
  id: string;
  rating: number;
  comment: string;
  reviewer_name: string;
  seller_name: string;
  listing_title: string;
  flag_reason?: string;
  status: 'flagged' | 'approved' | 'removed';
  created_at: string;
}
