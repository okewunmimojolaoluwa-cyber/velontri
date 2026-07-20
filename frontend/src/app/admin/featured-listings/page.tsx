'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function FeaturedListingsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'featured-listings'],
    queryFn: () => apiClient.get<ApiResponse<FeaturedListing[]>>('/listings/admin/featured').then(r => r.data),
  });

  const { mutate: unfeature } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/listings/admin/featured/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'featured-listings'] }),
  });

  const listings = data?.data ?? [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" /> Featured Listings
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage listings promoted on the homepage</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 py-20 text-center">
            <Star className="h-12 w-12 text-amber-300 mb-3" />
            <p className="text-sm font-semibold text-slate-900">No featured listings</p>
            <p className="text-xs text-slate-500 mt-1">Feature listings from the moderation queue</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(l => (
              <div key={l.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {/* Standardized 4:3 image container */}
                <div className="aspect-card overflow-hidden bg-slate-100">
                  {l.image_url ? (
                    <img src={l.image_url} alt={l.title}
                      className="h-full w-full object-cover object-center"
                      loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300 text-4xl">
                      
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-bold text-slate-900 line-clamp-2 flex-1">{l.title}</p>
                    <Star className="h-4 w-4 text-amber-400 flex-shrink-0 fill-amber-400" />
                  </div>
                  <p className="text-base font-black text-indigo-600 mb-1">
                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: l.currency, maximumFractionDigits: 0 }).format(l.price)}
                  </p>
                  <p className="text-xs text-slate-500 mb-3">by {l.seller_name}</p>
                  <button onClick={() => unfeature(l.id)}
                    className="w-full h-8 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors">
                    Remove from Featured
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface FeaturedListing { id: string; title: string; price: number; currency: string; seller_name: string; image_url?: string; }
