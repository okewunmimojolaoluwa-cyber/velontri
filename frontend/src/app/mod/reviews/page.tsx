'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

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

export default function ModReviewsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'flagged' | 'approved' | 'removed'>('flagged');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mod-reviews', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<ModReview[]>>(`/mod/reviews?status=${filter}`)
        .then((r) => r.data),
    enabled: session.isAuthenticated,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reviews/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-reviews'] }),
    onError: (err: any) => alert(err?.message || 'Failed to approve review.'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reviews/${id}/remove`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-reviews'] }),
    onError: (err: any) => alert(err?.message || 'Failed to remove review.'),
  });

  const reviews: ModReview[] = Array.isArray(data?.data) ? data.data as ModReview[] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" /> Review Moderation
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Review flagged user reviews</p>
      </div>

      <div className="flex gap-1.5">
        {(['all', 'flagged', 'approved', 'removed'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
              filter === s ? 'bg-amber-500 text-white' : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-[14px] font-semibold text-amber-700 mb-1">Feature under development</p>
          <p className="text-[13px] text-amber-600">Review flagging system will be available in a future update.</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 && !isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Star className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">No reviews found</p>
          <p className="text-[12px] text-slate-400">
            {filter !== 'all' ? `No ${filter} reviews.` : 'No reviews match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <p className="text-[14px] font-bold text-slate-900">Review by {review.reviewer_name}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    For: {review.listing_title} · {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                  ))}
                </div>
              </div>
              <p className="text-[13px] text-slate-600 mb-3">{review.comment}</p>
              <div className="flex items-center gap-4 text-[12px] text-slate-400 mb-3">
                <span>Seller: {review.seller_name}</span>
                {review.flag_reason && <span className="text-amber-600">Flagged: {review.flag_reason}</span>}
              </div>
              {review.status === 'flagged' && (
                <div className="flex gap-2">
                  <button onClick={() => approveMutation.mutate(review.id)} disabled={approveMutation.isPending}
                    className="h-8 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    Approve
                  </button>
                  <button onClick={() => removeMutation.mutate(review.id)} disabled={removeMutation.isPending}
                    className="h-8 rounded-lg border border-red-200 bg-red-50 px-3 text-[12px] font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
