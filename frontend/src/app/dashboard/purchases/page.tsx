'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, MapPin, ExternalLink, Heart, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/features/auth/auth-provider';
import type { ApiResponse } from '@/types/api';

interface SavedListing {
  id: string; listing_id: string; title: string;
  price: number; currency: string; category: string;
  listing_type: string; condition: string | null;
  city: string | null; country: string | null;
  image_url: string | null; status: string; saved_at: string;
}

function fmt(n: number, cur = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(n);
  } catch { return `₦${n.toLocaleString()}`; }
}

const TYPE_EMOJI: Record<string, string> = {
  vehicle: '🚗', property: '🏠', physical: '📦',
  product: '📦', service: '🔧', job: '💼', digital: '💾',
};

export default function UserPurchasesPage() {
  const { session } = useAuth();
  const uid = session.userId;

  const { data, isLoading } = useQuery({
    queryKey: [uid, 'saved'],
    queryFn: () => apiClient.get<ApiResponse<SavedListing[]>>('/saved').then(r => r.data),
    enabled: !!session.isAuthenticated,
    staleTime: 30_000,
  });

  const items: SavedListing[] = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Interested In</h1>
        <p className="text-[12px] text-slate-400 mt-0.5">
          Listings you've saved — contact sellers via WhatsApp to buy
        </p>
      </div>

      {/* How to buy banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-bold text-amber-800 mb-0.5">How to purchase on Velontri</p>
          <p className="text-[12px] text-amber-700 leading-relaxed">
            Tap <strong>Chat on WhatsApp</strong> on any listing to contact the seller directly.
            Meet in a public place, inspect the item, then pay in person. Never send money upfront.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-14 w-14 rounded-xl bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-3/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                  <div className="h-4 w-1/3 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Heart className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-[14px] font-semibold text-slate-900 mb-1">No saved listings yet</p>
            <p className="text-[12px] text-slate-400 mb-4">
              Browse and tap the ❤️ icon to save items you&apos;re interested in.
            </p>
            <Link href="/listings"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4
                text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
              <ShoppingBag className="h-3.5 w-3.5" />
              Browse listings
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map(item => {
              const emoji = TYPE_EMOJI[item.listing_type] ?? '📦';
              const loc = [item.city, item.country].filter(Boolean).join(', ');
              return (
                <li key={item.id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="h-14 w-14 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">{emoji}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{item.title}</p>
                    {loc && (
                      <p className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <MapPin className="h-3 w-3" /> {loc}
                      </p>
                    )}
                    <p className="text-[15px] font-black text-slate-900 mt-0.5">
                      {fmt(item.price, item.currency)}
                    </p>
                  </div>
                  <Link href={`/listings/${item.listing_id}`}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl
                      bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors no-underline"
                    title="View listing">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
