'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store, Package, Star, BarChart3, Plus, MapPin, Trash2, Eye,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { sellerApi, sellerKeys } from '@/lib/api/endpoints/seller';
import type { ApiResponse } from '@/types/api';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES } from '@/config/routes';
import { Input } from '@/components/ui/input';

interface StoreData {
  id: string;
  store_name: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
}

function fmt(n: number, cur: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(n);
  } catch { return `${cur} ${n.toLocaleString()}`; }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active:         { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active'   },
  pending_review: { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Pending'  },
  draft:          { bg: 'bg-slate-100',  text: 'text-slate-500',   label: 'Draft'    },
  rejected:       { bg: 'bg-red-50',     text: 'text-red-600',     label: 'Rejected' },
  archived:       { bg: 'bg-slate-100',  text: 'text-slate-400',   label: 'Archived' },
};

export default function UserStorePage() {
  const router = useRouter();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const uid = session.userId;

  /* ── Listings ─────────────────────────────────── */
  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: [uid, 'seller', 'listings', { page: 1, page_size: 50 }],
    queryFn: () => sellerApi.getMyListings({ page: 1, page_size: 50 }),
    enabled: session.isAuthenticated,
  });

  /* ── Store ─────────────────────────────────────── */
  const { data: storeData, isLoading: storeLoading } = useQuery({
    queryKey: [uid, 'my-store'],
    queryFn: () =>
      apiClient.get<ApiResponse<StoreData>>('/stores/mine').then(r => r.data).catch(() => ({ data: null })),
    enabled: session.isAuthenticated,
    retry: false,
  });

  /* ── Create store ──────────────────────────────── */
  const { mutate: createStore, isPending: creating_ } = useMutation({
    mutationFn: () =>
      apiClient.post('/stores', { store_name: storeName.trim(), theme: 'default' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [uid, 'my-store'] });
      setCreating(false);
      setStoreName('');
    },
  });

  /* ── Delete listing ────────────────────────────── */
  const { mutate: del, variables: deletingId } = useMutation({
    mutationFn: (id: string) => sellerApi.deleteListing(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [uid, 'seller'] });
    },
  });

  const listings = Array.isArray(listingsData?.data) ? listingsData.data : [];
  const store = (storeData as any)?.data ?? null;
  const meta  = listingsData?.meta;

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">My Store</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {meta?.total ?? listings.length} listing{(meta?.total ?? listings.length) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href={ROUTES.user.create}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4
            text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" /> New listing
        </Link>
      </div>

      {/* ── Store brand card ────────────────────────── */}
      {storeLoading ? (
        <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
      ) : store ? (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl
            bg-indigo-100 text-[18px] font-black text-indigo-700">
            {store.store_name?.charAt(0)?.toUpperCase() ?? 'S'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-black text-slate-900">{store.store_name}</p>
            {store.description && (
              <p className="text-[12px] text-slate-500 truncate">{store.description}</p>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            store.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {store.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      ) : creating ? (
        /* ── Create store form ── */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-[15px] font-black text-slate-900">Create your store</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Build a trusted brand and get more visibility</p>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">
              Store name <span className="text-red-500">*</span>
            </label>
            <Input
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="e.g. Mojola's Electronics"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={storeDesc}
              onChange={e => setStoreDesc(e.target.value)}
              placeholder="What do you sell? e.g. Quality phones and accessories"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]
                text-slate-800 placeholder-slate-400 focus:border-indigo-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { if (storeName.trim()) createStore(); }}
              disabled={creating_ || !storeName.trim()}
              className="h-10 rounded-xl bg-indigo-600 px-5 text-[13px] font-bold text-white
                hover:bg-indigo-700 transition-colors disabled:opacity-50
                flex items-center gap-2"
            >
              {creating_ ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                    strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                </svg>
              ) : <Store className="h-4 w-4" />}
              {creating_ ? 'Creating…' : 'Create store'}
            </button>
            <button onClick={() => { setCreating(false); setStoreName(''); setStoreDesc(''); }}
              className="h-10 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold
                text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ── No store yet — compact prompt ── */
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl
            bg-white border border-slate-200">
            <Store className="h-4.5 w-4.5 text-slate-400" style={{ height: 18, width: 18 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-700">You don't have a store yet</p>
            <p className="text-[11px] text-slate-400">Create one to build your brand and get more visibility</p>
          </div>
          <button onClick={() => setCreating(true)}
            className="h-8 shrink-0 rounded-xl bg-indigo-600 px-3.5 text-[12px] font-bold
              text-white hover:bg-indigo-700 transition-colors">
            Create store
          </button>
        </div>
      )}

      {/* ── Listings ────────────────────────────────── */}
      {listingsLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 animate-pulse">
              <div className="h-14 w-14 rounded-xl bg-slate-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-slate-100" />
                <div className="h-3 w-1/3 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed
          border-slate-200 py-16 text-center">
          <Package className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">No listings yet</p>
          <p className="text-[12px] text-slate-400 mb-4">Post your first listing to start selling.</p>
          <Link href={ROUTES.user.create}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5
              text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            <Plus className="h-4 w-4" /> Post a listing
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {listings.map((l) => {
            const st = STATUS_STYLES[l.status ?? 'draft'] ?? STATUS_STYLES.draft;
            const isDeleting = deletingId === l.id;
            return (
              <div
                key={l.id}
                className={`flex items-center gap-3 px-4 py-3.5 transition-all ${
                  isDeleting ? 'opacity-40 pointer-events-none' : 'hover:bg-slate-50'
                }`}
              >
                {/* Thumbnail */}
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                  {l.image_url ? (
                    <img src={l.image_url} alt={l.title}
                      className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl">
                      {l.listing_type === 'vehicle' ? '🚗'
                        : l.listing_type === 'property' ? '🏠'
                        : l.listing_type === 'job' ? '💼'
                        : l.listing_type === 'service' ? '🔧'
                        : '📦'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{l.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400 capitalize">{l.listing_type}</span>
                    {l.city && (
                      <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                        <MapPin className="h-2.5 w-2.5" />{l.city}
                      </span>
                    )}
                  </div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold
                    uppercase tracking-wide ${st.bg} ${st.text}`}>
                    {st.label}
                  </span>
                </div>

                {/* Price */}
                <p className="text-[14px] font-black text-indigo-600 whitespace-nowrap shrink-0">
                  {fmt(l.price ?? 0, l.currency ?? 'NGN')}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link href={`/listings/${l.id}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200
                      text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                    title="View listing">
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('Delete this listing permanently?')) del(l.id);
                    }}
                    disabled={isDeleting}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200
                      text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500
                      transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Delete listing"
                  >
                    {isDeleting
                      ? <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                            strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                        </svg>
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Quick actions ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: Package,  label: 'All Listings', href: ROUTES.user.listings },
          { icon: BarChart3, label: 'Analytics',   href: ROUTES.user.storeAnalytics },
          { icon: Star,      label: 'Reviews',     href: ROUTES.user.reviews },
        ].map(({ icon: Icon, label, href }) => (
          <Link key={label} href={href}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white
              px-4 py-3 no-underline hover:bg-slate-50 hover:border-slate-300 transition-all">
            <Icon className="h-4 w-4 text-slate-400" />
            <span className="text-[13px] font-medium text-slate-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
