'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, MapPin, Trash2, Eye, Search, AlertCircle } from 'lucide-react';
import { sellerApi, sellerKeys } from '@/lib/api/endpoints/seller';
import { listingKeys } from '@/lib/api/endpoints/listings';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES } from '@/config/routes';

function fmt(n: number, cur: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(n);
  } catch { return `${cur} ${n.toLocaleString()}`; }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active:         { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active'    },
  pending_review: { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Pending'   },
  draft:          { bg: 'bg-slate-100',  text: 'text-slate-500',   label: 'Draft'     },
  rejected:       { bg: 'bg-red-50',     text: 'text-red-600',     label: 'Rejected'  },
  archived:       { bg: 'bg-slate-100',  text: 'text-slate-400',   label: 'Archived'  },
  sold:           { bg: 'bg-violet-50',  text: 'text-violet-700',  label: 'Sold'      },
};

export default function UserListingsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const uid = session.userId;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [uid, 'seller', 'listings', { page, page_size: 20 }],
    queryFn: () => sellerApi.getMyListings({ page, page_size: 20 }),
    enabled: session.isAuthenticated,
  });

  const { mutate: del } = useMutation({
    mutationFn: (id: string) => sellerApi.deleteListing(id),
    onMutate: async (id) => {
      setDeletingId(id);
      setConfirmId(null);
      await qc.cancelQueries({ queryKey: [uid, 'seller'] });
      const prev = qc.getQueriesData({ queryKey: [uid, 'seller'] });
      qc.setQueriesData({ queryKey: [uid, 'seller'] }, (old: any) => {
        if (!old?.data || !Array.isArray(old.data)) return old;
        return {
          ...old,
          data: old.data.filter((l: any) => l.id !== id),
          meta: old.meta ? { ...old.meta, total: Math.max(0, (old.meta.total ?? 1) - 1) } : old.meta,
        };
      });
      return { prev };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.prev) {
        ctx.prev.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
      }
    },
    onSettled: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: [uid, 'seller'] });
    },
  });

  const all = Array.isArray(data?.data) ? data.data : [];
  const items = search
    ? all.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()))
    : all;
  const meta = data?.meta;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">My Listings</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {meta?.total ?? all.length} total listing{(meta?.total ?? all.length) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href={ROUTES.user.create}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4
            text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" /> New listing
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search listings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px]
            text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400
            focus:ring-2 focus:ring-indigo-500/10 transition-all"
        />
      </div>

      {/* Delete confirm modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-[16px] font-black text-slate-900 mb-1">Delete listing?</h3>
            <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
              This listing will be archived and removed from public view. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-[13px] font-semibold
                  text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => del(confirmId)}
                className="flex-1 h-11 rounded-xl bg-red-600 text-[13px] font-bold text-white
                  hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* States */}
      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-[14px] text-red-700 mb-2">Failed to load listings</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 animate-pulse">
              <div className="h-16 w-16 rounded-xl bg-slate-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-100" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
                <div className="h-3 w-1/4 rounded bg-slate-100" />
              </div>
              <div className="h-8 w-20 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Package className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">
            {search ? `No results for "${search}"` : 'No listings yet'}
          </p>
          <p className="text-[12px] text-slate-400 mb-4">
            {search ? 'Try a different search term.' : 'Post your first listing to start selling.'}
          </p>
          {!search && (
            <Link href={ROUTES.user.create}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5
                text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
              <Plus className="h-4 w-4" /> Post a listing
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {items.map((l) => {
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
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                  {l.image_url ? (
                    <img
                      src={l.image_url}
                      alt={l.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">
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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 capitalize">{l.listing_type}</span>
                    {l.city && (
                      <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                        <MapPin className="h-2.5 w-2.5" />{l.city}
                      </span>
                    )}
                  </div>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.bg} ${st.text}`}>
                    {st.label}
                  </span>
                </div>

                {/* Price */}
                <p className="text-[14px] font-black text-indigo-600 whitespace-nowrap shrink-0">
                  {fmt(l.price, l.currency)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/listings/${l.id}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200
                      text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                    title="View listing"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    disabled={isDeleting}
                    onClick={() => setConfirmId(l.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200
                      text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500
                      transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Delete listing"
                  >
                    {isDeleting ? (
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                          strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={!meta.has_prev}
            onClick={() => setPage((p) => p - 1)}
            className="h-9 rounded-xl border border-slate-200 px-4 text-[13px] font-medium
              text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-3 text-[13px] text-slate-400">{meta.page} / {meta.total_pages}</span>
          <button
            disabled={!meta.has_next}
            onClick={() => setPage((p) => p + 1)}
            className="h-9 rounded-xl border border-slate-200 px-4 text-[13px] font-medium
              text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
