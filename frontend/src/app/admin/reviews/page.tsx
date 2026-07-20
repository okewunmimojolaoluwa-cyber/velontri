'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminReviewsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'flagged' | 'verified'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', filter],
    queryFn: () => apiClient.get<ApiResponse<Review[]>>('/admin/reviews', { params: { filter } }).then(r => r.data),
  });

  const { mutate: removeReview } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/reviews/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });

  const reviews = data?.data ?? [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-400" /> Reviews
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Monitor and moderate platform reviews</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'flagged', 'verified'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`h-9 rounded-xl border px-4 text-sm font-medium capitalize transition-colors ${
                filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <Star className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-900">No reviews found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{r.reviewer_name}</span>
                      <span className="text-xs text-slate-500">→ {r.target_name}</span>
                      {r.is_flagged && (
                        <span className="text-xs rounded-full bg-red-50 border border-red-100 text-red-600 px-2 py-0.5 font-semibold">Flagged</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{r.comment}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => removeReview(r.id)}
                    className="flex-shrink-0 h-8 w-8 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface Review { id: string; reviewer_name: string; target_name: string; rating: number; comment: string; is_flagged: boolean; created_at: string; }
