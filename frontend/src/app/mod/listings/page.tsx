'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModListingsPage() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-listings', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<ModListing[]>>(`/mod/listings?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const listings = data?.data || [];
  const filteredListings = listings.filter(
    (l) =>
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.seller_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Listing Moderation</h1>
          <p className="text-gray-600 dark:text-gray-400">Review and moderate marketplace listings</p>
        </div>

        <div className="flex gap-4">
          <Input
            placeholder="Search listings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
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
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <EmptyState
            title="No listings found"
            description="There are no listings matching your criteria"
          />
        ) : (
          <div className="space-y-4">
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {listing.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Seller: {listing.seller_name} • {listing.currency} {listing.price}
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

                {listing.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm">Approve</Button>
                    <Button variant="outline" size="sm">Reject</Button>
                    <Button variant="outline" size="sm">View Details</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface ModListing {
  id: string;
  title: string;
  description: string;
  seller_name: string;
  price: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
}
