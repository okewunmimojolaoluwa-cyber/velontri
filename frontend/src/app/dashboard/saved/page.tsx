'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Heart, MapPin, Trash2, ShoppingBag, ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/features/auth/auth-provider';
import type { ApiResponse } from '@/types/api';

interface SavedListing {
  id: string;
  listing_id: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  listing_type: string;
  condition: string | null;
  city: string | null;
  country: string | null;
  image_url: string | null;
  status: string;
  saved_at: string;
}

function fmt(n: number, cur = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${cur} ${n.toLocaleString()}`;
  }
}

const TYPE_EMOJI: Record<string, string> = {
  vehicle: '🚗', property: '🏠', physical: '📦', product: '📦',
  service: '🔧', job: '💼', digital: '💾',
};

function SavedCard({
  item,
  onRemove,
  removing,
}: {
  item: SavedListing;
  onRemove: (listingId: string) => void;
  removing: boolean;
}) {
  const emoji = TYPE_EMOJI[item.listing_type] ?? '📦';
  const location = [item.city, item.country].filter(Boolean).join(', ');
  const savedDate = new Date(item.saved_at).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white
      shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">

      {/* Image */}
      <Link href={`/listings/${item.listing_id}`} className="block no-underline">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2
              bg-gradient-to-br from-slate-50 to-slate-100">
              <span style={{ fontSize: 44 }}>{emoji}</span>
              <p className="text-[11px] font-medium text-slate-400">{item.category}</p>
            </div>
          )}
          {/* Status badge */}
          {item.status !== 'active' && (
            <div className="absolute top-2 left-2 rounded-full bg-amber-500 px-2 py-0.5
              text-[10px] font-bold text-white capitalize">
              {item.status}
            </div>
          )}
        </div>
      </Link>

      {/* Body */}
      <div className="p-4">
        <Link href={`/listings/${item.listing_id}`} className="no-underline">
          <p className="text-[14px] font-bold text-slate-900 leading-snug mb-1 line-clamp-2
            hover:text-indigo-600 transition-colors">
            {item.title}
          </p>
        </Link>

        <div className="flex items-center gap-2 mb-2">
          {item.condition && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px]
              font-semibold text-slate-500 capitalize">
              {item.condition === 'new' ? 'Brand New' : item.condition}
            </span>
          )}
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px]
            font-semibold text-indigo-600 capitalize">
            {item.listing_type}
          </span>
        </div>

        <p className="text-[18px] font-black text-slate-900 tracking-tight mb-2">
          {fmt(item.price, item.currency)}
        </p>

        {location && (
          <p className="flex items-center gap-1 text-[11px] text-slate-400 mb-3">
            <MapPin className="h-3 w-3" /> {location}
          </p>
        )}

        <p className="text-[10px] text-slate-400 mb-3">
          Saved {savedDate}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href={`/listings/${item.listing_id}`}
            className="flex flex-1 items-center justify-center gap-1.5 h-9 rounded-xl
              bg-indigo-600 text-[12px] font-bold text-white no-underline
              hover:bg-indigo-700 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View listing
          </Link>
          <button
            onClick={() => onRemove(item.listing_id)}
            disabled={removing}
            title="Remove from saved"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl
              border border-slate-200 text-slate-400 hover:border-red-300 hover:bg-red-50
              hover:text-red-500 transition-all disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserSavedPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session.userId;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [uid, 'saved'],
    queryFn: () =>
      apiClient.get<ApiResponse<SavedListing[]>>('/saved').then(r => r.data),
    enabled: !!session.isAuthenticated,
    staleTime: 30_000,
  });

  const { mutate: remove, variables: removingId } = useMutation({
    mutationFn: (listingId: string) =>
      apiClient.delete(`/saved/${listingId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [uid, 'saved'] });
    },
  });

  const items: SavedListing[] = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            Saved Listings
          </h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {isLoading ? 'Loading…' : `${items.length} item${items.length !== 1 ? 's' : ''} saved`}
          </p>
        </div>
        {items.length > 0 && (
          <Link href="/listings"
            className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-slate-200
              bg-white px-4 text-[12px] font-semibold text-slate-600 no-underline
              hover:bg-slate-50 transition-colors">
            <ShoppingBag className="h-3.5 w-3.5" />
            Browse more
          </Link>
        )}
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-slate-100" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 w-3/4 rounded-lg bg-slate-100" />
                <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
                <div className="h-5 w-1/3 rounded-lg bg-slate-100" />
                <div className="h-9 rounded-xl bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-bold text-red-700 mb-2">Couldn't load saved listings</p>
          <button onClick={() => refetch()}
            className="h-9 rounded-xl bg-red-600 px-5 text-[13px] font-bold text-white
              hover:bg-red-700 transition-colors">
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl
          border-2 border-dashed border-slate-200 bg-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-4">
            <Heart className="h-8 w-8 text-red-300" />
          </div>
          <h2 className="text-[16px] font-bold text-slate-900 mb-1">No saved listings yet</h2>
          <p className="text-[13px] text-slate-400 mb-6 max-w-xs">
            While browsing, tap the ❤️ icon on any listing to save it here for later.
          </p>
          <Link href="/listings"
            className="inline-flex items-center gap-2 h-10 rounded-xl bg-indigo-600 px-6
              text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            <ShoppingBag className="h-4 w-4" />
            Start browsing
          </Link>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => (
            <SavedCard
              key={item.id}
              item={item}
              onRemove={(lid) => remove(lid)}
              removing={removingId === item.listing_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
