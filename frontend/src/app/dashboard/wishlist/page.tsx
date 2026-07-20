'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function UserWishlistPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () =>
      apiClient.get<ApiResponse<WishlistItem[]>>('/wishlist').then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/wishlist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  const wishlist = data?.data || [];

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wishlist</h1>
          <p className="text-gray-600 dark:text-gray-400">Items you want to buy</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : wishlist.length === 0 ? (
          <EmptyState
            title="Your wishlist is empty"
            description="Add items you want to purchase later"
          />
        ) : (
          <div className="space-y-4">
            {wishlist.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start gap-4">
                  <div className="h-24 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {item.seller_name} • {item.location}
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                      {item.currency} {item.price.toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Buy Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeMutation.mutate(item.id)}
                        disabled={removeMutation.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}

interface WishlistItem {
  id: string;
  title: string;
  seller_name: string;
  location: string;
  price: number;
  currency: string;
  image_url?: string;
}
