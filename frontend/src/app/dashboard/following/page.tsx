'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users, MapPin, ExternalLink, Store } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/features/auth/auth-provider';
import type { ApiResponse } from '@/types/api';

interface SavedListing {
  id: string; listing_id: string; title: string;
  price: number; currency: string; category: string;
  listing_type: string; condition: string | null;
  city: string | null; country: string | null;
  image_url: string | null; status: string;
  seller_id?: string; saved_at: string;
}

/**
 * "Following" — shows sellers whose listings the user has saved.
 * Since there's no explicit follow endpoint, we derive this from saved listings.
 */
export default function UserFollowingPage() {
  const { session } = useAuth();
  const uid = session.userId;

  const { data, isLoading } = useQuery({
    queryKey: [uid, 'saved'],
    queryFn: () => apiClient.get<ApiResponse<SavedListing[]>>('/saved').then(r => r.data),
    enabled: !!session.isAuthenticated,
    staleTime: 30_000,
  });

  const saved: SavedListing[] = Array.isArray(data?.data) ? data.data : [];

  // Group saved listings by seller_id to create "following" list
  const sellerMap = new Map<string, { sellerId: string; listings: SavedListing[] }>();
  for (const item of saved) {
    const sid = item.seller_id ?? 'unknown';
    if (!sellerMap.has(sid)) {
      sellerMap.set(sid, { sellerId: sid, listings: [] });
    }
    sellerMap.get(sid)!.listings.push(item);
  }
  const sellers = Array.from(sellerMap.values()).filter(s => s.sellerId !== 'unknown');

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Sellers I Like</h1>
        <p className="text-[12px] text-slate-400 mt-0.5">
          Sellers whose listings you've saved
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-1/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/4 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : sellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-[14px] font-semibold text-slate-900 mb-1">No sellers yet</p>
            <p className="text-[12px] text-slate-400 mb-4">
              Save listings to start tracking sellers you&apos;re interested in.
            </p>
            <Link href="/listings"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4
                text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
              Browse listings
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sellers.map(s => {
              const sample = s.listings[0];
              const loc = [sample.city, sample.country].filter(Boolean).join(', ');
              return (
                <li key={s.sellerId}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                  {/* Avatar */}
                  <div className="h-12 w-12 flex-shrink-0 rounded-full bg-indigo-100
                    flex items-center justify-center text-[14px] font-bold text-indigo-700">
                    <Store className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900">
                      Seller
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {s.listings.length} saved listing{s.listings.length !== 1 ? 's' : ''}
                      {loc && <> · <MapPin className="inline h-2.5 w-2.5" /> {loc}</>}
                    </p>
                  </div>

                  {/* Thumbnails */}
                  <div className="hidden sm:flex -space-x-2 mr-2">
                    {s.listings.slice(0, 3).map(item => (
                      <div key={item.id}
                        className="h-9 w-9 rounded-lg border-2 border-white overflow-hidden bg-slate-100 flex-shrink-0">
                        {item.image_url
                          ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                          : <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400">📦</div>
                        }
                      </div>
                    ))}
                  </div>

                  {/* View latest listing */}
                  <Link
                    href={`/listings/${sample.listing_id}`}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl
                      bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors no-underline"
                    title="View listing"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Also show saved items as context */}
      {saved.length > 0 && (
        <p className="text-center text-[12px] text-slate-400">
          Based on your {saved.length} saved listing{saved.length !== 1 ? 's' : ''}.{' '}
          <Link href="/dashboard/saved" className="text-indigo-600 font-semibold hover:underline no-underline">
            View saved listings →
          </Link>
        </p>
      )}
    </div>
  );
}
