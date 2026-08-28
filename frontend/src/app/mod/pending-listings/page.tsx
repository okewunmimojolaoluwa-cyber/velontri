'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { CheckCircle, XCircle, Eye, CaretDown, CaretUp, WarningCircle, Tag, MapPin, User, CalendarBlank } from '@phosphor-icons/react';

interface PendingListing {
 id: string;
 title: string;
 description: string;
 category: string;
 listing_type: string;
 condition?: string;
 location: string;
 city?: string;
 country?: string;
 price: number;
 currency: string;
 seller_name: string;
 seller_email: string;
 status: string;
 image_url?: string;
 created_at: string;
}

const REJECTION_REASONS = [
 'Wrong category',
 'Duplicate listing',
 'Prohibited item',
 'Misleading information',
 'Poor quality images',
 'Incomplete information',
 'Incorrect price',
 'Suspected scam',
 'Inappropriate content',
 'Other',
];

export default function ModPendingListingsPage() {
 const { session } = useAuth();
 const qc = useQueryClient();
 const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
 const [selectedReason, setSelectedReason] = useState('');
 const [otherReason, setOtherReason] = useState('');

 const { data, isLoading } = useQuery({
 queryKey: ['mod-pending-listings', filter],
 queryFn: () =>
 apiClient
 .get<ApiResponse<PendingListing[]>>(`/mod/listings?status=${filter}`)
 .then(r => r.data),
 enabled: session?.isAuthenticated,
 refetchInterval: 30_000,
 });

 const approveMutation = useMutation({
 mutationFn: (id: string) => apiClient.post(`/mod/listings/${id}/approve`, {}),
 onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-pending-listings'] }),
 onError: (err: any) => alert(err?.response?.data?.error?.message || err?.message || 'Failed to approve.'),
 });

 const rejectMutation = useMutation({
 mutationFn: ({ id, reason }: { id: string; reason: string }) =>
 apiClient.post(`/mod/listings/${id}/reject`, { reason }),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['mod-pending-listings'] });
 setRejectModal(null);
 setSelectedReason('');
 setOtherReason('');
 },
 onError: (err: any) => alert(err?.response?.data?.error?.message || err?.message || 'Failed to reject.'),
 });

 const listings: PendingListing[] = Array.isArray(data?.data) ? data.data : [];
 const pendingCount = listings.filter(l => l.status === 'pending_review' || l.status === 'pending').length;

 const effectiveReason = selectedReason === 'Other' ? otherReason.trim() : selectedReason;
 const canSubmitReject = selectedReason && (selectedReason !== 'Other' || otherReason.trim().length >= 5);

 return (
 <div className="space-y-6">
 <div className="flex items-start justify-between flex-wrap gap-3">
 <div>
 <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Listing Moderation</h1>
 <p className="text-[13px] text-slate-400 mt-0.5">
 Review, approve and reject seller listings before they go live.
 </p>
 </div>
 {pendingCount > 0 && filter === 'pending' && (
 <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[12px] font-bold text-white">
 <WarningCircle className="h-3.5 w-3.5" />
 {pendingCount} awaiting review
 </span>
 )}
 </div>

      {/* Funnel tabs */}
 <div className="flex gap-1.5 flex-wrap">
 {(['pending', 'approved', 'rejected', 'all'] as const).map(v => (
 <button key={v} onClick={() => setFilter(v)}
 className={`h-9 rounded-xl border px-4 text-[13px] font-semibold capitalize transition-colors ${
 filter === v
 ? 'bg-indigo-600 text-white border-indigo-600'
 : 'border-slate-200 text-slate-600 hover:bg-slate-50'
 }`}>
 {v === 'pending' ? 'Pending Review' : v}
 </button>
 ))}
 </div>

      {/* Content */}
 {isLoading ? (
 <div className="space-y-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
 ))}
 </div>
 ) : listings.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
 <CheckCircle className="h-12 w-12 text-slate-200 mb-3" />
 <p className="text-[15px] font-semibold text-slate-900">
 {filter === 'pending' ? 'No listings awaiting review' : `No ${filter} listings`}
 </p>
 </div>
 ) : (
 <div className="space-y-4">
 {listings.map(listing => {
 const isExpanded = expandedId === listing.id;
 const isPending = listing.status === 'pending_review' || listing.status === 'pending';
 return (
 <div key={listing.id}
 className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Card header */}
 <div className="p-5 flex items-start gap-4">
 <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-slate-100 overflow-hidden">
 {listing.image_url ? (
 <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
 ) : (
 <div className="flex h-full items-center justify-center text-slate-400 text-xs text-center px-2">No image</div>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <h3 className="font-bold text-slate-900 truncate text-[15px]">{listing.title}</h3>
 <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
 isPending ? 'bg-amber-100 text-amber-800' :
 listing.status === 'active' || listing.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
 'bg-red-100 text-red-800'
 }`}>
 {isPending ? 'Pending Review' : listing.status}
 </span>
 </div>
 <div className="mt-1.5 flex flex-wrap gap-3 text-[12px] text-slate-500">
 <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{listing.category} · {listing.listing_type}</span>
 {(listing.city || listing.country) && (
 <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[listing.city, listing.country].filter(Boolean).join(', ')}</span>
 )}
 <span className="font-semibold text-slate-700">{listing.currency} {listing.price?.toLocaleString()}</span>
 </div>
 <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
 <span className="flex items-center gap-1"><User className="h-3 w-3" />{listing.seller_name}{listing.seller_email && ` · ${listing.seller_email}`}</span>
 <span className="flex items-center gap-1"><CalendarBlank className="h-3 w-3" />{new Date(listing.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
 </div>
 </div>
 </div>

 {isExpanded && (
 <div className="px-5 pb-4 border-t border-slate-100 pt-4">
 <p className="text-[13px] text-slate-600 whitespace-pre-wrap">
 {listing.description || 'No description.'}
 </p>
 {listing.condition && (
 <p className="mt-2 text-[12px] text-slate-500">Condition: <span className="font-semibold capitalize">{listing.condition}</span></p>
 )}
 </div>
 )}

                {/* Action bar */}
 <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 flex-wrap">
 {isPending && (
 <>
 <button
 onClick={() => approveMutation.mutate(listing.id)}
 disabled={approveMutation.isPending}
 className="flex items-center gap-1.5 h-9 rounded-xl bg-emerald-600 px-4 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
 >
 <CheckCircle className="h-3.5 w-3.5" /> Approve
 </button>
 <button
 onClick={() => setRejectModal({ id: listing.id, title: listing.title })}
 disabled={rejectMutation.isPending}
 className="flex items-center gap-1.5 h-9 rounded-xl border border-red-200 bg-red-50 px-4 text-[12px] font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
 >
 <XCircle className="h-3.5 w-3.5" /> Reject
 </button>
 </>
 )}
 <button
 onClick={() => setExpandedId(isExpanded ? null : listing.id)}
 className="flex items-center gap-1 ml-auto h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:bg-white transition-colors"
 >
 <Eye className="h-3.5 w-3.5" />
 {isExpanded ? 'Hide' : 'Details'}
 {isExpanded ? <CaretUp className="h-3 w-3" /> : <CaretDown className="h-3 w-3" />}
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}

      {/* Reject Modal — predefined reasons */}
 {rejectModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
 <h2 className="text-[18px] font-black text-slate-900 mb-1">Reject Listing</h2>
 <p className="text-[13px] text-slate-500 mb-5">
 &ldquo;{rejectModal.title}&rdquo;
 </p>

 <div className="mb-4">
 <label className="block text-[13px] font-bold text-slate-700 mb-2">
 Select reason <span className="text-red-500">*</span>
 </label>
 <div className="grid grid-cols-2 gap-2">
 {REJECTION_REASONS.map(r => (
 <button
 key={r}
 type="button"
 onClick={() => { setSelectedReason(r); if (r !== 'Other') setOtherReason(''); }}
 className={`rounded-xl border px-3 py-2 text-[12px] font-medium text-left transition-all ${
 selectedReason === r
 ? 'border-red-400 bg-red-50 text-red-700'
 : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
 }`}
 >
 {r}
 </button>
 ))}
 </div>
 </div>

 {selectedReason === 'Other' && (
 <div className="mb-4">
 <label className="block text-[13px] font-bold text-slate-700 mb-1.5">
 Explain the reason <span className="text-red-500">*</span>
 </label>
 <textarea
 value={otherReason}
 onChange={e => setOtherReason(e.target.value)}
 placeholder="Describe why this listing is being rejected…"
 rows={3}
 className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px]
 text-slate-900 placeholder-slate-400 outline-none focus:border-red-400 resize-none transition-all"
 />
 {otherReason.length > 0 && otherReason.trim().length < 5 && (
 <p className="text-[11px] text-red-500 mt-1">Please provide at least 5 characters.</p>
 )}
 </div>
 )}

 {selectedReason && selectedReason !== 'Other' && (
 <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
 <p className="text-[12px] font-semibold text-amber-800 mb-0.5">Rejection reason to be sent to seller:</p>
 <p className="text-[13px] text-amber-700">{selectedReason}</p>
 </div>
 )}

 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => { setRejectModal(null); setSelectedReason(''); setOtherReason(''); }}
 disabled={rejectMutation.isPending}
 className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
 >
 Cancel
 </button>
 <button
 type="button"
 disabled={!canSubmitReject || rejectMutation.isPending}
 onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: effectiveReason })}
 className="flex-1 h-10 rounded-xl bg-red-600 text-[13px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
 >
 {rejectMutation.isPending ? 'Rejecting…' : 'Reject Listing'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}