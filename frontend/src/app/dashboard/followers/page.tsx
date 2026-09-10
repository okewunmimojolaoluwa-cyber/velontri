'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  UserCircle, 
  MagnifyingGlass,
  CheckCircle,
  Clock,
  XCircle,
} from '@phosphor-icons/react';
import { socialApi, socialKeys } from '@/lib/api/endpoints/social';
import { useAuth } from '@/features/auth/auth-provider';
import { FollowButton } from '@/components/social/follow-button';

/**
 * Followers Page - Shows users who follow the authenticated user.
 */
export default function UserFollowersPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: socialKeys.myFollowers(page),
    queryFn: () => socialApi.getMyFollowers(page),
    enabled: session.isAuthenticated,
    staleTime: 30_000,
  });

  const followers = data?.data?.followers ?? [];
  const meta = data?.data?.meta;

  // Verification status badge
  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
            <CheckCircle weight="fill" className="h-3 w-3" />
            Verified
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
            <Clock weight="fill" className="h-3 w-3" />
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-red-600">
            <XCircle weight="fill" className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">
            Followers
          </h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {meta?.total ?? 0} {meta?.total === 1 ? 'person' : 'people'} following you
          </p>
        </div>

        {/* Search users link */}
        <Link
          href="/users/search"
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-100 px-4
            text-[13px] font-semibold text-slate-700 hover:bg-slate-200 transition-colors no-underline"
        >
          <MagnifyingGlass className="h-4 w-4" weight="bold" />
          Find users
        </Link>
      </div>

      {/* Followers list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-14 w-14 rounded-full bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/4 rounded bg-slate-100" />
                </div>
                <div className="h-9 w-24 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <XCircle className="h-12 w-12 text-red-300 mb-3" weight="fill" />
            <p className="text-[14px] font-semibold text-slate-900 mb-1">
              Failed to load followers
            </p>
            <p className="text-[12px] text-slate-400">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        ) : followers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-slate-200 mb-3" weight="duotone" />
            <p className="text-[14px] font-semibold text-slate-900 mb-1">
              No followers yet
            </p>
            <p className="text-[12px] text-slate-400 mb-4">
              Share your profile to get followers
            </p>
            <Link
              href="/dashboard/profile"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4
                text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors"
            >
              View your profile
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {followers.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                {/* Avatar - Clickable */}
                <Link
                  href={`/users/${user.id}`}
                  className="h-14 w-14 flex-shrink-0 rounded-full bg-indigo-100
                    flex items-center justify-center text-[16px] font-bold text-indigo-700
                    hover:bg-indigo-200 transition-colors cursor-pointer"
                >
                  <UserCircle className="h-10 w-10" weight="fill" />
                </Link>

                {/* Info - Clickable */}
                <Link href={`/users/${user.id}`} className="flex-1 min-w-0 cursor-pointer">
                  <p className="text-[14px] font-semibold text-slate-900 truncate
                    group-hover:text-indigo-600 transition-colors">
                    {user.full_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] text-slate-400">
                      {user.followers_count} {user.followers_count === 1 ? 'follower' : 'followers'}
                    </p>
                    {getVerificationBadge(user.seller_verification_status)}
                  </div>
                  {user.followed_at && (
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      Following you since {new Date(user.followed_at).toLocaleDateString()}
                    </p>
                  )}
                </Link>

                {/* Follow back button */}
                <FollowButton userId={user.id} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!meta.has_prev}
            className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-[13px]
              font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
              hover:bg-slate-50 transition-colors"
          >
            Previous
          </button>

          <span className="text-[13px] text-slate-500">
            Page {meta.page} of {meta.total_pages}
          </span>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!meta.has_next}
            className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-[13px]
              font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
              hover:bg-slate-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
