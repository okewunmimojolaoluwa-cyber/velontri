'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Package } from '@phosphor-icons/react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface FeaturedListing {
 id: string;
 title: string;
 price: number;
 currency: string;
 seller_name: string;
 image_url?: string;
 category?: string;
 avg_rating?: number;
}

export default function FeaturedListingsPage() {
 const qc = useQueryClient();

 const { data, isLoading, isError, refetch } = useQuery({
 queryKey: ['admin', 'featured-listings'],
 queryFn: () =>
 apiClient
 .get<ApiResponse<FeaturedListing[]>>('/listings/admin/featured', { params: { page_size: 20 } })
 .then(r => r.data),
 staleTime: 30_000,
 });

 const { mutate: unfeature, isPending: unfeaturing } = useMutation({
 mutationFn: (id: string) => apiClient.delete(`/listings/admin/featured/${id}`),
 onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'featured-listings'] }),
 });

 const listings: FeaturedListing[] = Array.isArray(data?.data) ? data.data : [];

 return (
 <div className="space-y-6">
 <div className="flex items-start justify-between flex-wrap gap-4">
 <div>
 <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
 <Star className="h-6 w-6 text-amber-500" /> Featured Listings
 </h1>
 <p className="text-sm text-slate-500 mt-0.5">Top-rated active listings on the platform</p>
 </div>
 <Link href="/admin/listings"
 className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors no-underline">
 View All Listings
 </Link>
 </div>

 {isError ? (
 <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
 <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load featured listings</p>
 <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
 </div>
 ) : isLoading ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="h-56 rounded-2xl bg-slate-100 animate-pulse" />
 ))}
 </div>
 ) : listings.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 py-20 text-center">
 <Star className="h-12 w-12 text-amber-300 mb-3" />
 <p className="text-sm font-semibold text-slate-900">No active listings yet</p>
 <p className="text-xs text-slate-500 mt-1">Active listings will appear here as sellers publish them</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {listings.map(l => (
 <div key={l.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
 <div className="relative aspect-[4/3] bg-slate-100">
 {l.image_url ? (
 <img src={l.image_url} alt={l.title} className="h-full w-full object-cover" loading="lazy" />
 ) : (
 <div className="flex h-full w-full items-center justify-center">
 <Package className="h-10 w-10 text-slate-300" />
 </div>
 )}
 <div className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow">
 <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
 </div>
 </div>
 <div className="p-4">
 <p className="text-[14px] font-bold text-slate-900 line-clamp-2 mb-1">{l.title}</p>
 <p className="text-[15px] font-black text-indigo-600 mb-0.5">
 {new Intl.NumberFormat('en-NG', { style: 'currency', currency: l.currency || 'NGN', maximumFractionDigits: 0 }).format(l.price)}
 </p>
 <p className="text-[11px] text-slate-400 mb-3">by {l.seller_name}</p>
 <div className="flex gap-2">
 <Link href={`/listings/${l.id}`} target="_blank"
 className="flex-1 flex h-8 items-center justify-center rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors no-underline">
 View
 </Link>
 <button
 onClick={() => unfeature(l.id)}
 disabled={unfeaturing}
 className="flex-1 h-8 rounded-xl border border-red-200 bg-red-50 text-[12px] font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
 >
 Archive
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}