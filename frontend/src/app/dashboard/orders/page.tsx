'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  MessageCircle, Heart, ShoppingBag, Package,
  MapPin, ExternalLink, Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/features/auth/auth-provider';
import type { ApiResponse } from '@/types/api';
import { ROUTES } from '@/config/routes';

/* ── Types ─────────────────────────────────────────────────── */
interface SavedListing {
  id: string; listing_id: string; title: string;
  price: number; currency: string; category: string;
  listing_type: string; condition: string | null;
  city: string | null; country: string | null;
  image_url: string | null; status: string; saved_at: string;
}

interface Conversation {
  id: string; participant_id: string; participant_name?: string;
  last_message?: string; last_message_at?: string;
  listing_id?: string; listing_title?: string; unread_count?: number;
}

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(n: number, cur = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(n);
  } catch { return `${cur} ${n.toLocaleString()}`; }
}

const TYPE_EMOJI: Record<string, string> = {
  vehicle: '🚗', property: '🏠', physical: '📦',
  product: '📦', service: '🔧', job: '💼', digital: '💾',
};

export default function UserOrdersPage() {
  const { session } = useAuth();
  const uid = session.userId;

  /* Saved listings */
  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: [uid, 'saved'],
    queryFn: () => apiClient.get<ApiResponse<SavedListing[]>>('/saved').then(r => r.data),
    enabled: !!session.isAuthenticated,
    staleTime: 30_000,
  });

  /* In-app conversations */
  const { data: chatData, isLoading: chatLoading } = useQuery({
    queryKey: [uid, 'conversations'],
    queryFn: () =>
      apiClient.get<ApiResponse<Conversation[]>>('/chat/conversations').then(r => r.data).catch(() => ({ data: [] })),
    enabled: !!session.isAuthenticated,
    staleTime: 30_000,
  });

  const saved = Array.isArray(savedData?.data) ? savedData.data : [];
  const conversations: Conversation[] = Array.isArray(chatData?.data) ? chatData.data : [];

  const recentSaved = saved.slice(0, 5);
  const hasActivity = saved.length > 0 || conversations.length > 0;

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">
          Activity
        </h1>
        <p className="text-[12px] text-slate-400 mt-0.5">
          Your saved listings and conversations
        </p>
      </div>

      {/* How it works banner */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
        <p className="text-[13px] font-bold text-indigo-900 mb-2">
          How buying works on Velontri
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { n: '1', t: 'Find what you want', d: 'Browse or search listings' },
            { n: '2', t: 'Save or contact', d: 'Save listings or tap WhatsApp to chat' },
            { n: '3', t: 'Meet & buy', d: 'Meet the seller in a public place, inspect, then pay' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full
                bg-indigo-600 text-[12px] font-black text-white">
                {s.n}
              </div>
              <div>
                <p className="text-[12px] font-bold text-indigo-900">{s.t}</p>
                <p className="text-[11px] text-indigo-600 mt-0.5">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {!savedLoading && !chatLoading && !hasActivity && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl
          border-2 border-dashed border-slate-200 bg-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 mb-4">
            <ShoppingBag className="h-8 w-8 text-slate-300" />
          </div>
          <h2 className="text-[16px] font-bold text-slate-900 mb-1">No activity yet</h2>
          <p className="text-[13px] text-slate-400 mb-6 max-w-xs">
            Browse listings and save items you're interested in.
          </p>
          <Link href="/listings"
            className="inline-flex items-center gap-2 h-10 rounded-xl bg-indigo-600 px-6
              text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            <ShoppingBag className="h-4 w-4" />
            Browse listings
          </Link>
        </div>
      )}

      {/* Recent conversations */}
      {(chatLoading || conversations.length > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-indigo-600" />
              Messages
            </h2>
            <Link href={ROUTES.user.messages}
              className="text-[12px] font-semibold text-indigo-600 no-underline hover:underline">
              View all →
            </Link>
          </div>

          {chatLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.slice(0, 5).map(c => (
                <li key={c.id}>
                  <Link
                    href={ROUTES.user.messages}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors no-underline"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center
                      rounded-full bg-indigo-100 text-[12px] font-bold text-indigo-700">
                      {(c.participant_name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">
                        {c.participant_name || 'Seller'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {c.listing_title ? `Re: ${c.listing_title}` : c.last_message || 'Start conversation'}
                      </p>
                    </div>
                    {c.last_message_at && (
                      <span className="text-[10px] text-slate-400 flex-shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(c.last_message_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {(c.unread_count ?? 0) > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full
                        bg-indigo-600 text-[10px] font-bold text-white flex-shrink-0">
                        {c.unread_count}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Saved listings */}
      {(savedLoading || saved.length > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              Saved Listings
              {saved.length > 0 && (
                <span className="text-[11px] font-normal text-slate-400">({saved.length})</span>
              )}
            </h2>
            <Link href={ROUTES.user.saved}
              className="text-[12px] font-semibold text-indigo-600 no-underline hover:underline">
              View all →
            </Link>
          </div>

          {savedLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-14 w-14 rounded-xl bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-3/4 rounded bg-slate-100" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                    <div className="h-4 w-1/4 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentSaved.map(item => {
                const emoji = TYPE_EMOJI[item.listing_type] ?? '📦';
                const loc = [item.city, item.country].filter(Boolean).join(', ');
                return (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    {/* Thumbnail */}
                    <div className="h-14 w-14 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl">
                          {emoji}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{item.title}</p>
                      {loc && (
                        <p className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <MapPin className="h-3 w-3" /> {loc}
                        </p>
                      )}
                      <p className="text-[14px] font-black text-slate-900 mt-0.5">
                        {fmt(item.price, item.currency)}
                      </p>
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/listings/${item.listing_id}`}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl
                        bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors no-underline"
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
      )}

      {/* CTA to browse */}
      {hasActivity && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-[13px] text-slate-500 mb-3">
            Found something you like? Contact the seller directly on WhatsApp.
          </p>
          <Link href="/listings"
            className="inline-flex items-center gap-2 h-9 rounded-xl bg-indigo-600 px-5
              text-[12px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            <Package className="h-3.5 w-3.5" />
            Browse more listings
          </Link>
        </div>
      )}
    </div>
  );
}
