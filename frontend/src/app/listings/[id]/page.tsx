'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, BadgeCheck, MessageCircle,
  ChevronRight, Heart, Share2, Star,
  ChevronLeft, X, Send, CheckCircle, AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useListing } from '@/features/listings/hooks/use-listings';
import { listingKeys } from '@/lib/api/endpoints/listings';
import { useAuth } from '@/features/auth/auth-provider';
import { apiClient } from '@/lib/api/client';
import { Navbar } from '@/components/layout/navbar';
import { ROUTES } from '@/config/routes';
import { normalizePhoneNumber } from '@/lib/utils/formatters';
import type { ApiResponse } from '@/types/api';

function fmt(n: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch { return `${currency} ${n.toLocaleString()}`; }
}

const TYPE_COLOR: Record<string, string> = {
  physical: '#4F46E5', product: '#4F46E5', service: '#7C3AED',
  job: '#059669', property: '#0369A1', vehicle: '#D97706', digital: '#0891B2',
};
const TYPE_EMOJI: Record<string, string> = {
  physical: '📦', product: '📦', service: '🔧',
  job: '💼', property: '🏠', vehicle: '🚗', digital: '💾',
};

function ListingImagePlaceholder({ type, title }: { type: string; title: string }) {
  const emoji = TYPE_EMOJI[type] ?? '📦';
  const color = TYPE_COLOR[type] ?? '#4F46E5';
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 select-none"
      style={{ background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)` }}>
      <span style={{ fontSize: 72 }}>{emoji}</span>
      <p className="text-[13px] font-semibold text-slate-400 max-w-[200px] text-center px-4 truncate">{title}</p>
    </div>
  );
}

function SafetyNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <p className="text-[13px] font-black text-amber-800">Stay Safe</p>
      </div>
      <ul className="space-y-2">
        {[
          'Meet the seller in person.',
          'Inspect the item carefully before any payment.',
          'Never send money before seeing the item.',
          'Meet in a public location whenever possible.',
          'Verify the seller before making any payment.',
        ].map(tip => (
          <li key={tip} className="flex items-start gap-2 text-[12px] text-amber-700">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessagePanel({ listingId, sellerId, sellerName, listingTitle, onClose }: {
  listingId: string; sellerId: string; sellerName: string; listingTitle: string; onClose: () => void;
}) {
  const [text, setText] = useState(`Hi, I'm interested in your listing: "${listingTitle}". Is it still available?`);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState('');

  async function send() {
    if (!text.trim() || loading) return;
    setLoading(true); setSendError('');
    try {
      await apiClient.post('/chat/messages', { recipient_id: sellerId, content: text.trim(), listing_id: listingId });
      setSent(true);
    } catch (err: any) {
      setSendError(err?.response?.data?.error?.message || err?.message || 'Failed to send.');
    } finally { setLoading(false); }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="text-[15px] font-bold text-slate-900">Message sent!</p>
        <p className="text-[13px] text-slate-500">{sellerName} will reply soon.</p>
        <button onClick={onClose} className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] font-bold text-slate-900">Message {sellerName}</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none" />
      {sendError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-[12px] font-medium text-red-600">{sendError}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={send} disabled={loading || !text.trim()}
          className="flex-1 h-10 rounded-xl bg-indigo-600 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" /></svg> : <Send className="h-4 w-4" />}
          Send
        </button>
      </div>
    </div>
  );
}

/* ── Full-screen image viewer with swipe, keyboard, counter ── */
function ImageViewer({ images, startIdx, onClose }: { images: string[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);
  const touchStartX = useRef<number | null>(null);

  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')       onClose();
      else if (e.key === 'ArrowLeft')  prev();
      else if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black select-none"
      style={{ touchAction: 'none' }}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
        touchStartX.current = null;
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <p className="text-white font-bold text-[15px] tabular-nums">{idx + 1} / {images.length}</p>
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors active:scale-95">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main image */}
      <div className="relative flex-1 flex items-center justify-center min-h-0 px-2">
        <img
          key={idx}
          src={images[idx]}
          alt={`Photo ${idx + 1} of ${images.length}`}
          className="max-h-full max-w-full object-contain rounded-xl"
          style={{ maxHeight: 'calc(100dvh - 200px)' }}
          draggable={false}
        />
        {images.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prev(); }}
              className="absolute left-2 sm:left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors active:scale-95 backdrop-blur-sm"
              aria-label="Previous image">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button onClick={e => { e.stopPropagation(); next(); }}
              className="absolute right-2 sm:right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors active:scale-95 backdrop-blur-sm"
              aria-label="Next image">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Bottom: dots + thumbnails */}
      <div className="flex-shrink-0 pb-safe pb-6 pt-3 space-y-2.5">
        {images.length > 1 && images.length <= 10 && (
          <div className="flex items-center justify-center gap-1.5 px-4">
            {images.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${i === idx ? 'h-2 w-6 bg-white' : 'h-2 w-2 bg-white/40 hover:bg-white/70'}`}
                aria-label={`Go to image ${i + 1}`} />
            ))}
          </div>
        )}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
            {images.map((img, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? 'border-white scale-105 shadow-lg' : 'border-white/25 opacity-55 hover:opacity-80'}`}
                aria-label={`View image ${i + 1}`}>
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════ */
export default function ListingDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const router     = useRouter();
  const { session } = useAuth();
  const { data, isLoading, isError } = useListing(id);
  const listing = data?.data;

  // Gallery state — single index drives both main carousel AND viewer
  const [imgIdx,      setImgIdx]      = useState(0);
  const [viewerOpen,  setViewerOpen]  = useState(false);
  const [panel,       setPanel]       = useState<'none' | 'message'>('none');

  // Main image swipe (mobile)
  const touchStartX = useRef<number | null>(null);

  const qc  = useQueryClient();
  const uid = session.userId;

  const { data: savedData } = useQuery({
    queryKey: [uid, 'saved-check', id],
    queryFn: () => apiClient.get<ApiResponse<{ saved: boolean }>>(`/saved/${id}/check`).then(r => r.data).catch(() => ({ data: { saved: false } })),
    enabled: !!session.isAuthenticated && !!id,
    staleTime: 60_000,
  });
  const isSaved = savedData?.data?.saved ?? false;

  const { mutate: toggleSave, isPending: savePending } = useMutation({
    mutationFn: () => isSaved ? apiClient.delete(`/saved/${id}`) : apiClient.post(`/saved/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [uid, 'saved-check', id] }); qc.invalidateQueries({ queryKey: [uid, 'saved'] }); },
  });

  const { data: sellerData } = useQuery({
    queryKey: ['user-public', listing?.seller_id],
    queryFn: () => apiClient.get<ApiResponse<{
      full_name?: string;
      display_name?: string;
      trust_badge?: string;
      phone?: string;
      seller_verification_status?: string;
      profile_photo_url?: string;
      city?: string;
      state?: string;
      country?: string;
      bio?: string;
      active_listing_count?: number;
    }>>(`/users/${listing!.seller_id}/profile`).then(r => r.data).catch(() => null),
    enabled: !!listing?.seller_id,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const sellerName = sellerData?.data?.full_name || sellerData?.data?.display_name || 'Seller';
  const isVerifiedSeller = ['approved', 'verified'].includes(sellerData?.data?.seller_verification_status ?? '') || sellerData?.data?.trust_badge === 'verified';

  const { data: reviewsData } = useQuery({
    queryKey: ['listing-reviews', id],
    queryFn: () => apiClient.get(`/listings/${id}/reviews`).then(r => r.data),
    enabled: !!id,
    staleTime: 60_000,
  });
  const reviews: any[] = Array.isArray(reviewsData?.data) ? reviewsData.data : [];

  const [reviewRating,  setReviewRating]  = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewHover,   setReviewHover]   = useState(0);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewErr,     setReviewErr]     = useState('');

  const { mutate: submitReview, isPending: submittingReview } = useMutation({
    mutationFn: () => apiClient.post(`/listings/${id}/reviews`, { rating: reviewRating, comment: reviewComment.trim() || undefined }),
    onSuccess: () => {
      setReviewSuccess(true); setReviewRating(0); setReviewComment('');
      qc.invalidateQueries({ queryKey: ['listing-reviews', id] });
      qc.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
    onError: (e: any) => { setReviewErr(e?.message || 'Could not submit review. You may have already reviewed this listing.'); },
  });

  // Images — full array from backend
  const images: string[] = ((listing as any)?.media_urls?.length
    ? (listing as any).media_urls
    : listing?.image_url ? [listing.image_url] : []
  ).filter(Boolean);
  const hasImages = images.length > 0;

  const whatsapp: string = (listing as any)?.whatsapp_number || (listing as any)?.contact_phone || sellerData?.data?.phone || '';

  function buildWhatsAppUrl() {
    if (!whatsapp) return '#';
    const clean = normalizePhoneNumber(whatsapp);
    const msg = encodeURIComponent(`Hello, I found your listing on Velontri.\nI'm interested in: ${listing?.title ?? 'your listing'}\nIs it still available?`);
    return `https://wa.me/${clean}?text=${msg}`;
  }

  function prevImg() { setImgIdx(i => (i - 1 + images.length) % images.length); }
  function nextImg() { setImgIdx(i => (i + 1) % images.length); }

  function handleMessage() {
    if (!session.isAuthenticated) { router.push(`${ROUTES.login}?redirect=/listings/${id}`); return; }
    setPanel('message');
  }

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: listing?.title, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Navbar />

      {/* Full-screen image viewer */}
      {viewerOpen && hasImages && (
        <ImageViewer images={images} startIdx={imgIdx} onClose={() => setViewerOpen(false)} />
      )}

      {/* Message panel */}
      {panel !== 'none' && listing && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0" onClick={() => setPanel('none')}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <MessagePanel listingId={id} sellerId={listing.seller_id ?? ''} sellerName={sellerName} listingTitle={listing.title} onClose={() => setPanel('none')} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[13px] text-slate-400 mb-7">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 hover:text-slate-700 transition-colors cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <ChevronRight className="h-3.5 w-3.5 opacity-40" />
          <button onClick={() => router.push('/listings')} className="hover:text-slate-700 transition-colors cursor-pointer">Listings</button>
          {listing && (<><ChevronRight className="h-3.5 w-3.5 opacity-40" /><span className="text-slate-700 truncate max-w-[200px]">{listing.title}</span></>)}
        </nav>

        {isError && (
          <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
            <p className="text-[18px] font-bold text-slate-900 mb-2">Listing not found</p>
            <button onClick={() => router.push('/listings')} className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-6 text-[14px] font-semibold text-white hover:bg-indigo-700 transition-colors">Browse all listings</button>
          </div>
        )}

        {isLoading && (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <div className="aspect-[4/3] rounded-2xl bg-slate-200 animate-pulse" />
              <div className="h-8 w-2/3 rounded-xl bg-slate-200 animate-pulse" />
            </div>
            <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
        )}

        {listing && (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">

            {/* LEFT */}
            <div className="space-y-6">

              {/* ── Image gallery ─────────────────────────────────── */}
              <div className="space-y-2">
                {/* Main image container */}
                <div
                  className="relative overflow-hidden rounded-2xl bg-slate-100 border border-slate-200 cursor-pointer"
                  style={{ aspectRatio: '4/3', touchAction: 'pan-y' }}
                  onClick={() => hasImages && setViewerOpen(true)}
                  onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                  onTouchEnd={e => {
                    if (touchStartX.current === null) return;
                    const dx = e.changedTouches[0].clientX - touchStartX.current;
                    if (Math.abs(dx) > 40) { e.stopPropagation(); dx < 0 ? nextImg() : prevImg(); }
                    touchStartX.current = null;
                  }}
                >
                  {hasImages ? (
                    <>
                      <img
                        src={images[imgIdx]}
                        alt={listing.title}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />

                      {/* Counter badge — top left */}
                      {images.length > 1 && (
                        <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur-sm tabular-nums pointer-events-none">
                          {imgIdx + 1} / {images.length}
                        </div>
                      )}

                      {/* Prev / Next arrows */}
                      {images.length > 1 && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); prevImg(); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 shadow-md hover:bg-white transition-colors active:scale-95"
                            aria-label="Previous image"
                          >
                            <ChevronLeft className="h-5 w-5 text-slate-700" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); nextImg(); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 shadow-md hover:bg-white transition-colors active:scale-95"
                            aria-label="Next image"
                          >
                            <ChevronRight className="h-5 w-5 text-slate-700" />
                          </button>
                        </>
                      )}

                      {/* Save + Share — top right */}
                      <div className="absolute top-3 right-3 flex gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { if (!session.isAuthenticated) { router.push(`${ROUTES.login}?redirect=/listings/${id}`); return; } toggleSave(); }}
                          disabled={savePending}
                          className={`h-9 w-9 rounded-xl backdrop-blur-sm border flex items-center justify-center shadow-sm transition-all hover:scale-105 disabled:opacity-60 ${isSaved ? 'bg-red-500 border-red-400 text-white' : 'bg-white/90 border-white/50 text-slate-600 hover:bg-white'}`}>
                          <Heart className={`h-4 w-4 ${isSaved ? 'fill-white' : ''}`} />
                        </button>
                        <button onClick={handleShare} className="h-9 w-9 rounded-xl bg-white/90 backdrop-blur-sm border border-white/50 flex items-center justify-center text-slate-600 shadow-sm hover:bg-white">
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <ListingImagePlaceholder type={listing.listing_type} title={listing.title} />
                  )}
                </div>

                {/* Thumbnail strip — shown when 2+ images */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setImgIdx(i)}
                        className={`flex-shrink-0 h-16 w-16 rounded-xl overflow-hidden border-2 transition-all ${i === imgIdx ? 'border-indigo-500 scale-105 shadow-sm' : 'border-slate-200 opacity-70 hover:opacity-100'}`}
                        aria-label={`View image ${i + 1}`}
                      >
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* "Tap to view full size" hint — mobile */}
                {hasImages && (
                  <p className="text-center text-[11px] text-slate-400 sm:hidden">Tap image to view full size · Swipe to browse</p>
                )}
              </div>

              {/* Title */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: TYPE_COLOR[listing.listing_type] ?? '#4F46E5' }}>{listing.listing_type}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">{listing.category}</span>
                  {listing.condition && <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500 capitalize">{listing.condition}</span>}
                </div>
                <h1 className="text-[1.6rem] font-black text-slate-900 leading-tight tracking-tight mb-3">{listing.title}</h1>
                {(listing.city || listing.country) && (
                  <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
                    <MapPin className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    {[listing.city, listing.country].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>

              {listing.description && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide mb-3">Description</h2>
                  <p className="text-[14px] text-slate-600 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide mb-4">Listing Details</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  {[
                    { label: 'Category',  value: listing.category },
                    { label: 'Type',      value: listing.listing_type },
                    { label: 'Condition', value: listing.condition },
                    { label: 'Location',  value: [listing.city, listing.country].filter(Boolean).join(', ') || null },
                    { label: 'Currency',  value: listing.currency },
                  ].filter(r => r.value).map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className="text-[13px] font-semibold text-slate-700 capitalize mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <SafetyNotice />

              {/* Reviews */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-slate-900">
                    Reviews{(listing.review_count ?? 0) > 0 && <span className="ml-2 text-[12px] font-normal text-slate-400">({listing.review_count})</span>}
                  </h2>
                  {(listing.avg_rating ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`h-4 w-4 ${s <= Math.round(listing.avg_rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}
                      <span className="text-[13px] font-bold text-slate-700 ml-1">{Number(listing.avg_rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {reviews.length === 0 ? (
                  <p className="text-[13px] text-slate-400 text-center py-4">No reviews yet. Be the first to rate this listing.</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((r: any) => (
                      <div key={r.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 flex-shrink-0">{(r.reviewer_name || 'U').charAt(0).toUpperCase()}</div>
                            <p className="text-[13px] font-semibold text-slate-800">{r.reviewer_name || 'Anonymous'}</p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {[1,2,3,4,5].map(s => <Star key={s} className={`h-3.5 w-3.5 ${s <= (r.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}
                          </div>
                        </div>
                        {r.comment && <p className="text-[13px] text-slate-600 leading-relaxed ml-9">{r.comment}</p>}
                        <p className="text-[11px] text-slate-400 mt-1 ml-9">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                        {r.seller_response && (
                          <div className="mt-2 ml-9 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold text-slate-500 mb-0.5">Seller response</p>
                            <p className="text-[12px] text-slate-700">{r.seller_response}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {session.isAuthenticated && listing.seller_id !== session.userId && (
                  <div className="border-t border-slate-100 pt-5">
                    <p className="text-[13px] font-bold text-slate-900 mb-3">Rate this listing</p>
                    {reviewSuccess ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <p className="text-[13px] font-semibold text-emerald-700">Review submitted! Thank you.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(s => (
                            <button key={s} type="button" onClick={() => setReviewRating(s)} onMouseEnter={() => setReviewHover(s)} onMouseLeave={() => setReviewHover(0)} className="p-0.5 transition-transform hover:scale-110 active:scale-95">
                              <Star className={`h-7 w-7 transition-colors ${s <= (reviewHover || reviewRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-300'}`} />
                            </button>
                          ))}
                          {reviewRating > 0 && <span className="ml-2 text-[12px] font-semibold text-slate-500">{['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewRating]}</span>}
                        </div>
                        <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Share your experience (optional)…" rows={3}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all" />
                        {reviewErr && <p className="text-[12px] font-medium text-red-600">{reviewErr}</p>}
                        <button onClick={() => { setReviewErr(''); if (reviewRating === 0) { setReviewErr('Please select a star rating.'); return; } submitReview(); }}
                          disabled={submittingReview || reviewRating === 0}
                          className="h-10 rounded-xl bg-indigo-600 px-5 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                          {submittingReview ? 'Submitting…' : 'Submit Review'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!session.isAuthenticated && (
                  <p className="text-[12px] text-slate-400 text-center border-t border-slate-100 pt-4">
                    <button onClick={() => router.push(`${ROUTES.login}?redirect=/listings/${id}`)} className="text-indigo-600 font-semibold hover:underline">Sign in</button>{' '}to leave a review
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT — sticky sidebar */}
            <div className="space-y-4 lg:sticky lg:top-20 self-start">

              {/* ── Price card ────────────────────────────── */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">Listed price</p>
                <p className="text-[2.25rem] font-black text-slate-900 tracking-tight leading-none mb-5">
                  {fmt(listing.price ?? 0, listing.currency ?? 'NGN')}
                </p>

                {/* ── WhatsApp — primary CTA ──────────────── */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 mb-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" style={{ fill: '#25D366' }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.857L0 24l6.335-1.51A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.572-.504-5.057-1.385l-.362-.215-3.758.895.952-3.663-.235-.376A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    <div>
                      <p className="text-[12px] font-bold text-emerald-800 leading-tight">WhatsApp</p>
                      <p className="text-[11px] text-emerald-600 leading-tight">Chat directly with seller</p>
                    </div>
                  </div>
                  {whatsapp ? (
                    <a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white text-[13px] font-bold py-3 hover:bg-[#1ebe5d] active:scale-[0.99] transition-all no-underline shadow-sm">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white flex-shrink-0">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.857L0 24l6.335-1.51A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.572-.504-5.057-1.385l-.362-.215-3.758.895.952-3.663-.235-.376A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                      </svg>
                      Chat on WhatsApp
                    </a>
                  ) : (
                    <div className="rounded-xl bg-emerald-100 px-4 py-2.5 text-center">
                      <p className="text-[12px] text-emerald-700 font-medium">No WhatsApp number provided</p>
                    </div>
                  )}
                </div>

                {/* ── Velontri Messages — secondary ───────── */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <MessageCircle className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-bold text-slate-800 leading-tight">Velontri Messages</p>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        {session.isAuthenticated ? 'Send an in-app message' : 'Sign in to send an in-app message'}
                      </p>
                    </div>
                  </div>
                  {session.isAuthenticated ? (
                    <button onClick={handleMessage}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white text-[13px] font-semibold text-indigo-600 py-2.5 hover:bg-indigo-50 active:scale-[0.99] transition-all">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Message Seller
                    </button>
                  ) : (
                    <button onClick={() => router.push(`${ROUTES.login}?redirect=/listings/${id}`)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-[13px] font-semibold text-slate-600 py-2.5 hover:bg-slate-100 active:scale-[0.99] transition-all">
                      Sign in to message
                    </button>
                  )}
                </div>
              </div>

              {/* ── Seller card ───────────────────────────── */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Seller</p>
                </div>

                <div className="p-4 space-y-4">
                  {/* Avatar + name + badge */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {sellerData?.data?.profile_photo_url ? (
                        <img
                          src={sellerData.data.profile_photo_url}
                          alt={sellerName}
                          className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-[18px] font-black uppercase shadow-sm flex-shrink-0">
                          {sellerName.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        </div>
                      )}
                    </div>

                    {/* Name + badge + rating */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[15px] font-bold text-slate-900 leading-tight">{sellerName}</p>
                        {isVerifiedSeller && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 flex-shrink-0 whitespace-nowrap">
                            <BadgeCheck className="h-2.5 w-2.5" />
                            Verified
                          </span>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {(listing.avg_rating ?? 0) > 0 ? (
                          <span className="flex items-center gap-1 text-[12px] text-amber-600 font-semibold">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {Number(listing.avg_rating).toFixed(1)}
                            <span className="font-normal text-slate-400">
                              ({listing.review_count ?? 0} review{(listing.review_count ?? 0) !== 1 ? 's' : ''})
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">No reviews yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats row: listing count + location */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-slate-500">
                    {(sellerData?.data?.active_listing_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        {sellerData?.data?.active_listing_count} listing{sellerData?.data?.active_listing_count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {(sellerData?.data?.city || sellerData?.data?.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {[sellerData?.data?.city, sellerData?.data?.state].filter(Boolean).join(', ')}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Navigation actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => router.push(`/listings?seller_id=${listing.seller_id}`)}
                      className="flex-1 h-9 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] transition-all"
                    >
                      View Listings
                    </button>
                    <button
                      onClick={() => router.push(`/listings?seller_id=${listing.seller_id}`)}
                      className="flex-1 h-9 rounded-xl border border-indigo-200 bg-indigo-50 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-100 active:scale-[0.99] transition-all"
                    >
                      View Store
                    </button>
                  </div>
                </div>
              </div>

              {/* Safety notice — sidebar */}
              <div className="hidden lg:block"><SafetyNotice /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
