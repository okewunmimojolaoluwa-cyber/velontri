'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, MapPin, Calendar, Storefront, Package, Star } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import { Navbar } from '@/components/layout/navbar';
import { FollowButton } from '@/components/social/follow-button';
import { useAuth } from '@/features/auth/auth-provider';
import Link from 'next/link';

interface UserProfile {
  id: string;
  full_name: string;
  email?: string;
  bio?: string;
  profile_photo_url?: string;
  city?: string;
  state?: string;
  country?: string;
  trust_badge?: string;
  created_at?: string;
  followers_count?: number;
  following_count?: number;
  is_phone_verified?: boolean;
}

interface UserListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  image_url?: string;
  category?: string;
  city?: string;
  created_at: string;
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const userId = params.id as string;
  const isOwnProfile = session?.userId === userId;

  // Fetch user profile
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const res = await apiClient.get(`/users/${userId}/profile`);
      return res.data.data as UserProfile;
    },
    enabled: !!userId,
  });

  // Fetch user listings
  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: ['user-listings', userId],
    queryFn: async () => {
      const res = await apiClient.get(`/listings?seller_id=${userId}&page=1&page_size=12`);
      return res.data.data as UserListing[];
    },
    enabled: !!userId,
  });

  const profile = profileData;
  const listings = listingsData || [];

  // Loading state
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="animate-pulse">
            <div className="h-32 w-32 rounded-full bg-slate-200 mb-4" />
            <div className="h-8 w-64 bg-slate-200 rounded mb-2" />
            <div className="h-4 w-48 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">User not found</h1>
          <p className="text-slate-600 mb-6">This user does not exist or has been deleted.</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    );
  }

  const joinDate = profile.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const initials = profile.full_name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Profile header */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 py-8">
        <div className="mx-auto max-w-5xl px-4">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-indigo-300 hover:text-white transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {profile.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt={profile.full_name}
                  className="h-32 w-32 rounded-full object-cover border-4 border-white/20 shadow-lg"
                />
              ) : (
                <div className="h-32 w-32 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center border-4 border-white/20 shadow-lg">
                  <span className="text-white text-4xl font-black">{initials}</span>
                </div>
              )}
              {profile.is_phone_verified && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2 border-4 border-indigo-900">
                  <CheckCircle className="h-5 w-5 text-white" weight="fill" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                <h1 className="text-white font-black text-3xl">{profile.full_name}</h1>
                {profile.trust_badge && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-bold uppercase">
                    <Star className="h-3 w-3" weight="fill" />
                    {profile.trust_badge}
                  </span>
                )}
              </div>

              {profile.bio && (
                <p className="text-indigo-200 text-sm mb-3 max-w-2xl">{profile.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-indigo-300">
                {location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {location}
                  </span>
                )}
                {joinDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Joined {joinDate}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 mt-4">
                <div className="text-center">
                  <div className="text-white font-black text-2xl">{profile.followers_count || 0}</div>
                  <div className="text-indigo-300 text-xs">Followers</div>
                </div>
                <div className="text-center">
                  <div className="text-white font-black text-2xl">{profile.following_count || 0}</div>
                  <div className="text-indigo-300 text-xs">Following</div>
                </div>
                <div className="text-center">
                  <div className="text-white font-black text-2xl">{listings.length}</div>
                  <div className="text-indigo-300 text-xs">Listings</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {!isOwnProfile && session?.isAuthenticated && (
                <FollowButton userId={userId} />
              )}
              {isOwnProfile && (
                <Link
                  href="/dashboard/profile"
                  className="px-6 py-2.5 bg-white text-indigo-700 rounded-lg font-semibold text-sm hover:bg-indigo-50 transition-colors text-center"
                >
                  Edit Profile
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Listings section */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Storefront className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900">Active Listings</h2>
          <span className="text-slate-400">({listings.length})</span>
        </div>

        {listingsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-slate-200 h-40 rounded-lg mb-2" />
                <div className="bg-slate-200 h-4 rounded mb-1" />
                <div className="bg-slate-200 h-4 w-2/3 rounded" />
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
              <Package className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No active listings yet</p>
            <p className="text-slate-400 text-sm mt-1">
              {isOwnProfile ? 'Create your first listing to get started' : 'This user has not posted any listings'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
              >
                <div className="relative h-40 bg-slate-100">
                  {listing.image_url ? (
                    <img
                      src={listing.image_url}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-slate-300" />
                    </div>
                  )}
                  {/* Time badge - active duration */}
                  {listing.created_at && (() => {
                    try {
                      const date = new Date(listing.created_at);
                      if (isNaN(date.getTime()) || date.getFullYear() < 2020) return null;
                      const ms = Date.now() - date.getTime();
                      if (ms < 0) return null;
                      const minutes = Math.floor(ms / 60_000);
                      const hours = Math.floor(ms / 3_600_000);
                      const days = Math.floor(ms / 86_400_000);
                      const weeks = Math.floor(days / 7);
                      const months = Math.floor(days / 30);
                      const years = Math.floor(days / 365);
                      let duration = '';
                      if (minutes < 60) duration = 'Just listed';
                      else if (hours < 24) duration = `${hours}h ago`;
                      else if (days === 1) duration = '1 day';
                      else if (days < 7) duration = `${days} days`;
                      else if (weeks === 1) duration = '1 week';
                      else if (weeks < 5) duration = `${weeks} weeks`;
                      else if (months === 1) duration = '1 month';
                      else if (months < 12) duration = `${months} months`;
                      else if (years === 1) duration = '1 year';
                      else duration = `${years} years`;
                      return (
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5
                          text-[9px] font-bold text-white backdrop-blur-sm pointer-events-none">
                          {duration}
                        </span>
                      );
                    } catch { return null; }
                  })()}
                </div>
                <div className="p-3">
                  <p className="text-sm font-bold text-slate-900 line-clamp-2 mb-1">{listing.title}</p>
                  <p className="text-indigo-600 font-black text-base">
                    {new Intl.NumberFormat('en-NG', {
                      style: 'currency',
                      currency: listing.currency || 'NGN',
                      maximumFractionDigits: 0,
                    }).format(listing.price)}
                  </p>
                  {listing.city && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {listing.city}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
