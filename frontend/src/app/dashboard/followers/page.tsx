'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function UserFollowersPage() {
  const { session } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['followers'],
    queryFn: () =>
      apiClient.get<ApiResponse<Follower[]>>('/followers').then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const followers = data?.data || [];

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Followers</h1>
          <p className="text-gray-600 dark:text-gray-400">People following your store</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : followers.length === 0 ? (
          <EmptyState
            title="No followers yet"
            description="Share your store to get more followers"
          />
        ) : (
          <div className="space-y-4">
            {followers.map((follower) => (
              <div
                key={follower.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    {follower.avatar_url ? (
                      <img src={follower.avatar_url} alt={follower.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-gray-400">{follower.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{follower.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {follower.location || 'Unknown location'}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Since {new Date(follower.followed_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}

interface Follower {
  id: string;
  name: string;
  avatar_url?: string;
  location?: string;
  followed_at: string;
}
