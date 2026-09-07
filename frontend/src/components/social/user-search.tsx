'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  MagnifyingGlass, 
  UserCircle,
  CheckCircle,
  Clock,
  XCircle,
} from '@phosphor-icons/react';
import { socialApi, socialKeys } from '@/lib/api/endpoints/social';
import { FollowButton } from '@/components/social/follow-button';

interface UserSearchProps {
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * User search component with debounced search and follow functionality.
 */
export function UserSearch({ 
  autoFocus = false, 
  placeholder = 'Search users by name...',
  className = '',
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1); // Reset to first page on new search
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results
  const { data, isLoading, error } = useQuery({
    queryKey: socialKeys.search(debouncedQuery, page),
    queryFn: () => socialApi.searchUsers(debouncedQuery, page),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000, // 1 minute
  });

  const users = data?.data?.users ?? [];
  const meta = data?.data?.meta;

  // Verification status badge
  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
            <CheckCircle weight="fill" className="h-3 w-3" />
            Verified Seller
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
    <div className={`space-y-4 ${className}`}>
      {/* Search input */}
      <div className="relative">
        <MagnifyingGlass 
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" 
          weight="bold" 
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 bg-white
            text-[14px] placeholder:text-slate-400 focus:outline-none focus:ring-2
            focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Search results */}
      {query.length < 2 ? (
        <div className="text-center py-8 text-[13px] text-slate-400">
          Enter at least 2 characters to search
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 animate-pulse">
              <div className="h-12 w-12 rounded-full bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-3 w-1/4 rounded bg-slate-200" />
              </div>
              <div className="h-9 w-24 rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <XCircle className="h-10 w-10 text-red-300 mx-auto mb-2" weight="fill" />
          <p className="text-[13px] text-slate-900 font-semibold">Search failed</p>
          <p className="text-[12px] text-slate-400">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[13px] text-slate-900 font-semibold">No users found</p>
          <p className="text-[12px] text-slate-400">
            Try a different search term
          </p>
        </div>
      ) : (
        <>
          {/* Results list */}
          <ul className="space-y-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200
                  hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                {/* Avatar */}
                <div className="h-12 w-12 flex-shrink-0 rounded-full bg-indigo-100
                  flex items-center justify-center">
                  <UserCircle className="h-9 w-9 text-indigo-600" weight="fill" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900 truncate">
                    {user.full_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-slate-400">
                      {user.followers_count} {user.followers_count === 1 ? 'follower' : 'followers'}
                    </p>
                    {getVerificationBadge(user.seller_verification_status)}
                  </div>
                </div>

                {/* Follow button */}
                <FollowButton userId={user.id} size="sm" showIcon={false} />
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!meta.has_prev}
                className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-[12px]
                  font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
                  hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>

              <span className="text-[12px] text-slate-500">
                Page {meta.page} of {meta.total_pages}
              </span>

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!meta.has_next}
                className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-[12px]
                  font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
                  hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Results count */}
          {meta && (
            <p className="text-center text-[11px] text-slate-400 pt-1">
              Found {meta.total} {meta.total === 1 ? 'user' : 'users'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
