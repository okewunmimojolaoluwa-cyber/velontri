'use client';

import Link from 'next/link';
import { 
  UserCircle, 
  CheckCircle, 
  MapPin, 
  Users, 
  Storefront,
  Clock,
  XCircle 
} from '@phosphor-icons/react';
import { FollowButton } from '@/components/social/follow-button';
import { useAuth } from '@/features/auth/auth-provider';

interface SellerResult {
  id: string;
  full_name: string;
  profile_photo_url?: string;
  city?: string;
  state?: string;
  country?: string;
  bio?: string;
  followers_count?: number;
  seller_verification_status?: string;
  listings_count?: number;
  is_phone_verified?: boolean;
}

interface SellerResultsProps {
  sellers: SellerResult[];
  isLoading?: boolean;
  query: string;
}

export function SellerResults({ sellers, isLoading, query }: SellerResultsProps) {
  const { session } = useAuth();

  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 
            border border-green-200 text-[10px] font-bold text-green-700 uppercase
            dark:bg-green-950/40 dark:border-green-800 dark:text-green-400">
            <CheckCircle weight="fill" className="h-3 w-3" />
            Verified
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 
            border border-amber-200 text-[10px] font-bold text-amber-700 uppercase
            dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400">
            <Clock weight="fill" className="h-3 w-3" />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-slate-200 
            animate-pulse dark:bg-[#1c1c1c] dark:border-[#2a2a2a]">
            <div className="h-16 w-16 rounded-full bg-slate-200 flex-shrink-0 dark:bg-[#242424]" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-1/3 rounded bg-slate-200 dark:bg-[#242424]" />
              <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-[#242424]" />
              <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-[#242424]" />
            </div>
            <div className="h-9 w-24 rounded-xl bg-slate-200 dark:bg-[#242424]" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (sellers.length === 0) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mx-auto 
          dark:bg-[#242424]">
          <UserCircle className="h-10 w-10 text-slate-300" />
        </div>
        <div>
          <p className="text-[18px] font-black text-slate-900 dark:text-slate-100 mb-1">
            No sellers found
          </p>
          <p className="text-[13px] text-slate-400 max-w-sm mx-auto">
            We couldn't find any sellers matching &ldquo;{query}&rdquo;. Try a different search term.
          </p>
        </div>
      </div>
    );
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const location = (seller: SellerResult) =>
    [seller.city, seller.state, seller.country].filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      {sellers.map((seller) => (
        <div
          key={seller.id}
          className="group flex flex-col sm:flex-row items-start gap-4 p-5 rounded-2xl bg-white 
            border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all
            dark:bg-[#1c1c1c] dark:border-[#2a2a2a] dark:hover:border-indigo-800"
        >
          {/* Avatar */}
          <Link
            href={`/users/${seller.id}`}
            className="flex-shrink-0 relative"
          >
            {seller.profile_photo_url ? (
              <img
                src={seller.profile_photo_url}
                alt={seller.full_name}
                className="h-16 w-16 rounded-full object-cover border-2 border-slate-100 
                  group-hover:border-indigo-200 transition-colors
                  dark:border-[#2a2a2a] dark:group-hover:border-indigo-800"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 
                flex items-center justify-center border-2 border-slate-100 group-hover:border-indigo-200 
                transition-colors dark:border-[#2a2a2a] dark:group-hover:border-indigo-800">
                <span className="text-white text-xl font-black">{initials(seller.full_name)}</span>
              </div>
            )}
            {seller.is_phone_verified && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 
                border-2 border-white dark:border-[#1c1c1c]">
                <CheckCircle className="h-3 w-3 text-white" weight="fill" />
              </div>
            )}
          </Link>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <Link
                href={`/users/${seller.id}`}
                className="font-black text-[16px] text-slate-900 hover:text-indigo-600 
                  transition-colors dark:text-slate-100 dark:hover:text-indigo-400"
              >
                {seller.full_name}
              </Link>
              {getVerificationBadge(seller.seller_verification_status)}
            </div>

            {seller.bio && (
              <p className="text-[13px] text-slate-600 mb-3 line-clamp-2 dark:text-slate-400">
                {seller.bio}
              </p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-slate-500 
              dark:text-slate-400">
              {location(seller) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  {location(seller)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 flex-shrink-0" />
                {seller.followers_count || 0} follower{seller.followers_count !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <Storefront className="h-3.5 w-3.5 flex-shrink-0" />
                {seller.listings_count || 0} listing{seller.listings_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link
              href={`/users/${seller.id}`}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-slate-200 
                bg-white text-center text-[13px] font-semibold text-slate-700
                hover:bg-slate-50 hover:border-slate-300 transition-all
                dark:bg-[#1c1c1c] dark:border-[#2a2a2a] dark:text-slate-300 
                dark:hover:bg-[#242424]"
            >
              View Profile
            </Link>
            {session?.isAuthenticated && session.userId !== seller.id && (
              <FollowButton userId={seller.id} size="md" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
