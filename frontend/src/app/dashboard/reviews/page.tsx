'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, MessageSquarePlus, ShoppingBag, Package } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Review {
  id: string;
  rating: number;
  comment: string;
  listing_title: string;
  seller_name?: string | null;
  buyer_name?: string | null;
  created_at: string;
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${sz} ${i < rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`}
        />
      ))}
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="px-5 py-4 space-y-2.5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-1/3 rounded-lg bg-slate-100" />
        <div className="h-3 w-20 rounded-lg bg-slate-100" />
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3.5 w-3.5 rounded bg-slate-100" />
        ))}
      </div>
      <div className="h-3 w-full rounded-lg bg-slate-100" />
      <div className="h-3 w-2/3 rounded-lg bg-slate-100" />
    </div>
  );
}

export default function UserReviewsPage() {
  const { session } = useAuth();
  const uid = session.userId;
  const [filter, setFilter] = useState<'given' | 'received'>('given');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [uid, 'reviews', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Review[]>>(`/reviews?type=${filter}&page=1&page_size=50`)
        .then(r => r.data),
    enabled: session.isAuthenticated,
    retry: 1,
  });

  // Handle both array data and paginated data wrapper
  const raw = data?.data;
  const reviews: Review[] = Array.isArray(raw) ? raw : [];

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Reviews</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Your product reviews</p>
        </div>
        {filter === 'received' && reviews.length > 0 && (
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[22px] font-black text-slate-900 leading-none">
                {avgRating.toFixed(1)}
              </span>
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-400">
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['given', 'received'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 rounded-xl px-4 text-[12px] font-semibold capitalize transition-all ${
              filter === f
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            Reviews {f}
          </button>
        ))}
      </div>

      {/* Content card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 3 }).map((_, i) => (
              <ReviewSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 mb-4">
              <Star className="h-7 w-7 text-red-300" />
            </div>
            <p className="text-[15px] font-bold text-slate-900 mb-1">
              Couldn't load reviews
            </p>
            <p className="text-[13px] text-slate-400 mb-4">
              There was a problem fetching your reviews.
            </p>
            <button
              onClick={() => refetch()}
              className="h-9 rounded-xl bg-indigo-600 px-5 text-[13px] font-bold text-white
                hover:bg-indigo-700 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            {filter === 'given' ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
                  <MessageSquarePlus className="h-7 w-7 text-indigo-300" />
                </div>
                <p className="text-[15px] font-bold text-slate-900 mb-1">
                  No reviews given yet
                </p>
                <p className="text-[13px] text-slate-400 mb-5 max-w-xs">
                  After you complete a purchase, you can leave a review for the seller.
                </p>
                <Link
                  href="/dashboard/purchases"
                  className="inline-flex items-center gap-2 h-9 rounded-xl bg-indigo-600 px-5
                    text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  View my purchases
                </Link>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 mb-4">
                  <Star className="h-7 w-7 text-amber-300" />
                </div>
                <p className="text-[15px] font-bold text-slate-900 mb-1">
                  No reviews received yet
                </p>
                <p className="text-[13px] text-slate-400 mb-5 max-w-xs">
                  Buyers will leave reviews after they receive their orders.
                </p>
                <Link
                  href="/dashboard/listings"
                  className="inline-flex items-center gap-2 h-9 rounded-xl bg-indigo-600 px-5
                    text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors"
                >
                  <Package className="h-3.5 w-3.5" />
                  View my listings
                </Link>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reviews.map(r => {
              const name = filter === 'given'
                ? (r.seller_name ?? 'Seller')
                : (r.buyer_name ?? 'Buyer');
              const date = new Date(r.created_at).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', year: 'numeric',
              });

              return (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar initial */}
                      <div className="h-8 w-8 flex-shrink-0 rounded-full bg-indigo-100
                        flex items-center justify-center text-[11px] font-bold text-indigo-700">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">
                          {name}
                        </p>
                        <p className="text-[11px] text-slate-400">{date}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <StarRow rating={r.rating} size="sm" />
                    </div>
                  </div>

                  {r.comment && (
                    <p className="text-[13px] text-slate-600 leading-relaxed mb-2 pl-[42px]">
                      {r.comment}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-400 pl-[42px]">
                    For: <span className="font-medium text-slate-500">{r.listing_title}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
