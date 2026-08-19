'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Package, MapPin, Trash2, Eye, Search,
  AlertCircle, RotateCcw, Pencil, X, Check,
} from 'lucide-react';
import { sellerApi } from '@/lib/api/endpoints/seller';
import { apiClient } from '@/lib/api/client';
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

interface ListingItem {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  listing_type: string;
  category?: string;
  condition?: string;
  city?: string;
  state?: string;
  image_url?: string;
  status?: string;
  rejection_reason?: string;
}

interface EditState {
  listing: ListingItem;
  /** 'price' = price-only (active listings), 'full' = all fields (pending/rejected) */
  mode: 'price' | 'full';
}

function EditModal({
  editState,
  onClose,
  onSaved,
}: {
  editState: EditState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { listing, mode } = editState;
  const [form, setForm] = useState({
    title: listing.title,
    description: listing.description ?? '',
    price: String(listing.price),
    condition: listing.condition ?? 'used',
    city: listing.city ?? '',
    state: listing.state ?? '',
  });
  const [err, setErr] = useState('');
  const [resubmit, setResubmit] = useState(listing.status === 'rejected');

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { price: parseFloat(form.price) || listing.price };
      if (mode === 'full') {
        payload.title = form.title.trim();
        payload.description = form.description.trim();
        payload.condition = form.condition;
        payload.city = form.city.trim() || undefined;
        payload.state = form.state.trim() || undefined;
      }
      await apiClient.patch(`/listings/${listing.id}`, payload);
      // If rejected + resubmit checked, re-publish after saving
      if (resubmit && listing.status === 'rejected') {
        await apiClient.post(`/listings/${listing.id}/publish`, {});
      }
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: any) => {
      setErr(e?.message || e?.response?.data?.error?.message || 'Failed to save changes.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      setErr('Enter a valid price.');
      return;
    }
    if (mode === 'full' && !form.title.trim()) {
      setErr('Title is required.');
      return;
    }
    save();
  }

  const inputCls = 'w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-[84px] sm:pb-0">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-black text-slate-900">
              {mode === 'price' ? 'Update Price' : 'Edit Listing'}
            </h2>
            <p className="text-[12px] text-slate-400 mt-0.5 truncate max-w-[260px]">{listing.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
          {mode === 'full' && (
            <>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide">Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputCls}
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px]
                    text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400
                    focus:bg-white focus:ring-2 focus:ring-indigo-500/10 resize-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide">Condition</label>
                  <select
                    value={form.condition}
                    onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] text-slate-700 outline-none focus:border-indigo-400 transition-all"
                  >
                    <option value="new">Brand New</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide">City</label>
                  <input
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="e.g. Lagos"
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          )}

          {/* Price — always shown */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide">
              Price (NGN)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">₦</span>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-4 text-[14px] text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all"
                min="0"
                step="1"
                required
              />
            </div>
          </div>

          {/* Resubmit option for rejected listings */}
          {listing.status === 'rejected' && (
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={resubmit}
                onChange={e => setResubmit(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500 flex-shrink-0"
              />
              <div>
                <p className="text-[13px] font-semibold text-amber-800">Resubmit for review</p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  After saving, your listing will be sent back to the moderation queue.
                </p>
              </div>
            </label>
          )}

          {err && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-[12px] font-medium text-red-600">{err}</p>
            </div>
          )}
          </div>

          {/* Sticky footer buttons */}
          <div className="flex gap-2 px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 h-11 rounded-xl bg-indigo-600 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isPending ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                </svg>
              ) : <Check className="h-4 w-4" />}
              {isPending ? 'Saving…' : listing.status === 'rejected' && resubmit ? 'Save & Resubmit' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserListingsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
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
      if (ctx?.prev) ctx.prev.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
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

  function openEdit(l: ListingItem) {
    // active → price only; pending/rejected → full edit
    const mode = l.status === 'active' ? 'price' : 'full';
    setEditState({ listing: l as ListingItem, mode });
  }

  return (
    <div className="space-y-5">

      {/* Edit modal */}
      {editState && (
        <EditModal
          editState={editState}
          onClose={() => setEditState(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: [uid, 'seller'] });
            qc.invalidateQueries({ queryKey: listingKeys.all });
          }}
        />
      )}

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-[84px] sm:pb-0 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-[16px] font-black text-slate-900 mb-1">Delete listing?</h3>
            <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
              This listing will be removed from public view. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => del(confirmId)}
                className="flex-1 h-11 rounded-xl bg-red-600 text-[13px] font-bold text-white hover:bg-red-700 transition-colors">
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
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 animate-pulse">
              <div className="h-16 w-16 rounded-xl bg-slate-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-100" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
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
            const listing = l as ListingItem;
            const st = STATUS_STYLES[listing.status ?? 'draft'] ?? STATUS_STYLES.draft;
            const isDeleting = deletingId === listing.id;
            const isRejected = listing.status === 'rejected';
            const isPending = listing.status === 'pending_review';
            const isActive = listing.status === 'active';
            // Can edit: pending, rejected, active (price only), draft
            const canEdit = ['active', 'pending_review', 'rejected', 'draft'].includes(listing.status ?? '');

            return (
              <div key={listing.id} className={`flex flex-col transition-all ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className={`flex items-center gap-3 px-4 py-3.5 ${!isDeleting ? 'hover:bg-slate-50' : ''}`}>
                  {/* Thumbnail */}
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                    {listing.image_url ? (
                      <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">
                        {listing.listing_type === 'vehicle' ? '🚗'
                          : listing.listing_type === 'property' ? '🏠'
                          : listing.listing_type === 'job' ? '💼'
                          : listing.listing_type === 'service' ? '🔧'
                          : '📦'}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{listing.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 capitalize">{listing.listing_type}</span>
                      {listing.city && (
                        <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                          <MapPin className="h-2.5 w-2.5" />{listing.city}
                        </span>
                      )}
                    </div>
                    <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.bg} ${st.text}`}>
                      {isPending && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      {st.label}
                    </span>
                  </div>

                  {/* Price */}
                  <p className="text-[14px] font-black text-indigo-600 whitespace-nowrap shrink-0">
                    {fmt(listing.price, listing.currency)}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(isActive || isPending) && (
                      <Link href={`/listings/${listing.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                        title="View listing">
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => openEdit(listing)}
                        title={isActive ? 'Update price' : 'Edit listing'}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      disabled={isDeleting}
                      onClick={() => setConfirmId(listing.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Delete listing"
                    >
                      {isDeleting ? (
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                        </svg>
                      ) : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Rejection reason banner */}
                {isRejected && (
                  <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide mb-0.5">Listing Rejected</p>
                      <p className="text-[12px] text-red-600">
                        {(listing as any).rejection_reason || 'Your listing did not meet our guidelines.'}
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(listing)}
                      className="flex-shrink-0 flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit & Resubmit
                    </button>
                  </div>
                )}

                {/* Pending review banner */}
                {isPending && (
                  <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                      <p className="text-[12px] text-amber-700">
                        Under review — our team will approve or provide feedback shortly.
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(listing)}
                      className="flex-shrink-0 flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </div>
                )}

                {/* Active listing — subtle price edit hint */}
                {isActive && (
                  <div className="mx-4 mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">Live on marketplace</p>
                    <button
                      onClick={() => openEdit(listing)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                    >
                      <Pencil className="h-3 w-3" /> Update price
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={!meta.has_prev} onClick={() => setPage((p) => p - 1)}
            className="h-9 rounded-xl border border-slate-200 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed">
            Previous
          </button>
          <span className="px-3 text-[13px] text-slate-400">{meta.page} / {meta.total_pages}</span>
          <button disabled={!meta.has_next} onClick={() => setPage((p) => p + 1)}
            className="h-9 rounded-xl border border-slate-200 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
