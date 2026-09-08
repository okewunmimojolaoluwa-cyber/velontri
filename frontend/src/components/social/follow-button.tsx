'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, UserMinus } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { socialApi, socialKeys } from '@/lib/api/endpoints/social';
import { useAuth } from '@/features/auth/auth-provider';
import { Button } from '@/components/ui/button';

interface FollowButtonProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showIcon?: boolean;
  fullWidth?: boolean;
  className?: string;
}

/**
 * Follow/Unfollow button with optimistic updates.
 * 
 * Features:
 * - Fetches follow status on mount
 * - Optimistic UI updates
 * - Loading states
 * - Error handling with rollback
 * - Guest user handling (redirects to login)
 * - Prevents self-follows
 */
export function FollowButton({
  userId,
  size = 'md',
  variant = 'default',
  showIcon = true,
  fullWidth = false,
  className = '',
}: FollowButtonProps) {
  const router = useRouter();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);

  // Don't show button if trying to follow yourself
  if (session.userId === userId) {
    return null;
  }

  // Fetch follow status
  const { data: statusData, isLoading } = useQuery({
    queryKey: socialKeys.followStatus(userId),
    queryFn: () => socialApi.getFollowStatus(userId),
    enabled: session.isAuthenticated,
    staleTime: 30_000, // 30 seconds
  });

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: () => socialApi.followUser(userId),
    onMutate: async () => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: socialKeys.followStatus(userId) });

      // Save previous value
      const previousStatus = queryClient.getQueryData(socialKeys.followStatus(userId));

      // Optimistically update to following
      setOptimisticFollowing(true);

      return { previousStatus };
    },
    onSuccess: (data) => {
      // Update cache with server response
      queryClient.setQueryData(socialKeys.followStatus(userId), data);
      setOptimisticFollowing(null);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: socialKeys.myFollowing(1) });
      queryClient.invalidateQueries({ queryKey: socialKeys.followers(userId, 1) });
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        queryClient.setQueryData(socialKeys.followStatus(userId), context.previousStatus);
      }
      setOptimisticFollowing(null);
      
      // Show error message
      console.error('Failed to follow user:', error);
      alert('Failed to follow user. Please try again.');
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: () => socialApi.unfollowUser(userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: socialKeys.followStatus(userId) });

      const previousStatus = queryClient.getQueryData(socialKeys.followStatus(userId));

      // Optimistically update to not following
      setOptimisticFollowing(false);

      return { previousStatus };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(socialKeys.followStatus(userId), data);
      setOptimisticFollowing(null);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: socialKeys.myFollowing(1) });
      queryClient.invalidateQueries({ queryKey: socialKeys.followers(userId, 1) });
    },
    onError: (error, _, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(socialKeys.followStatus(userId), context.previousStatus);
      }
      setOptimisticFollowing(null);

      console.error('Failed to unfollow user:', error);
      alert('Failed to unfollow user. Please try again.');
    },
  });

  // Handle click
  const handleClick = () => {
    // Redirect to login if not authenticated
    if (!session.isAuthenticated) {
      router.push(`/login?redirect=/users/${userId}`);
      return;
    }

    // Toggle follow status
    if (isCurrentlyFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  // Determine current state (optimistic or actual)
  const actualFollowing = statusData?.data?.following ?? false;
  const isCurrentlyFollowing = optimisticFollowing !== null ? optimisticFollowing : actualFollowing;

  // Determine button state
  const isMutating = followMutation.isPending || unfollowMutation.isPending;
  const isDisabled = isLoading || isMutating;

  // Size classes
  const sizeClasses = {
    sm: 'h-8 text-[11px] px-3 gap-1.5',
    md: 'h-9 text-[13px] px-4 gap-2',
    lg: 'h-10 text-[14px] px-5 gap-2',
  };

  // Icon sizes
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-4 w-4',
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={isCurrentlyFollowing ? 'outline' : variant}
      className={`${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className} font-semibold transition-all`}
    >
      {isLoading ? (
        <>
          <span className="animate-pulse">•••</span>
        </>
      ) : (
        <>
          {showIcon && (
            isCurrentlyFollowing ? (
              <UserMinus className={iconSizes[size]} weight="bold" />
            ) : (
              <UserPlus className={iconSizes[size]} weight="bold" />
            )
          )}
          <span>
            {isMutating
              ? isCurrentlyFollowing
                ? 'Following...'
                : 'Unfollowing...'
              : isCurrentlyFollowing
              ? 'Following'
              : 'Follow'}
          </span>
        </>
      )}
    </Button>
  );
}
