'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, BadgeCheck, MessageCircle,
  ChevronRight, Heart, Share2, Eye, Clock, Star,
  ChevronLeft, X, ZoomIn, Send, CheckCircle, AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useListing } from '@/features/listings/hooks/use-listings';
import { useAuth } from '@/features/auth/auth-provider';
import { apiClient } from '@/lib/api/client';
import { Navbar } from '@/components/layout/navbar';
import { ROUTES } from '@/config/routes';
import type { ApiResponse } from '@/types/api';

function fmt(n: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(n);
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
      <p className="text-[13px] font-semibold text-slate-400 max-w-[200px] text-center px-4 truncate">
        {title}
      </p>
    </div>
  );
}

/* ── Safety Notice ─────────────────────────────────── */
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

/* ── Message Panel ─────────────────────────────────── */
function MessagePanel({
  listingId, sellerId, sellerName, listingTitle, onClose,
}: {
  listingId: string; sellerId: string; sellerName: string;
  listingTitle: string; onClose: () => void;
}) {
  const [text, setText] = useState(
    `Hi, I'm interested in your listing: "${listingTitle}". Is it still available?`
  );
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState('');

  async function send() {
    if (!text.trim() || loading) return;
    setLoading(true); setSendError('');
    try {
      await apiClient.post('/chat/messages', {
        recipient_id: sellerId, content: text.trim(), listing_id: listingId,
      });
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
        <button onClick={onClose}
          className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold
            text-white hover:bg-indigo-700 transition-colors">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] font-bold text-slate-900">Message {sellerName}</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px]
          text-slate-800 focus:border-indigo-400 focus:outline-none
          focus:ring-2 focus:ring-indigo-500/10 resize-none" />
      {sendError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-[12px] font-medium text-red-600">{sendError}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px]
            font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={send} disabled={loading || !text.trim()}
          className="flex-1 h-10 rounded-xl bg-indigo-600 text-[13px] font-bold text-white
            hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading
            ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
              </svg>
            : <Send className="h-4 w-4" />}
          Send
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════ */
export default function ListingDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { session } = useAuth();
  const { data, isLoading, isError } = useListing(id);
  const listing = data?.data;

  const [imgIdx,   setImgIdx]   = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [panel,    setPanel]    = useState<'none' | 'message'>('none');

  const qc = useQueryClient();
  const uid = session.userId;

  // Check saved status
  const { data: savedData } = useQuery({
    queryKey: [uid, 'saved-check', id],
    queryFn: () =>
      apiClient.get<ApiResponse<{ saved: boolean }>>(`/saved/${id}/check`)
        .then(r => r.data)
        .catch(() => ({ data: { saved: false } })),
    enabled: !!session.isAuthenticated && !!id,
    staleTime: 60_000,
  });
  const isSaved = savedData?.data?.saved ?? false;

  const { mutate: toggleSave, isPending: savePending } = useMutation({
    mutationFn: () =>
      isSaved
        ? apiClient.delete(`/saved/${id}`)
        : apiClient.post(`/saved/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [uid, 'saved-check', id] });
      qc.invalidateQueries({ queryKey: [uid, 'saved'] });
    },
  });

  const { data: sellerData } = useQuery({
    queryKey: ['user-public', listing?.seller_id],
    queryFn: () =>
      apiClient.get<ApiResponse<{ full_name?: string; display_name?: string; trust_badge?: string; phone?: string }>>(
        `/users/${listing!.seller_id}/profile`
      ).then(r => r.data).catch(() => null),
    enabled: !!listing?.seller_id,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const sellerName = sellerData?.data?.full_name || sellerData?.data?.display_name || 'Seller';
  const images: string[] = listing?.image_url ? [listing.image_url] : [];
  const hasImages = images.length > 0;

  // WhatsApp number — from listing data, then seller profile phone as fallback
  const whatsapp: string = (listing as any)?.whatsapp_number
    || (listing as any)?.contact_phone
    || sellerData?.data?.phone
    || '';

  function buildWhatsAppUrl() {
    if (!whatsapp) return '#';
    const clean = whatsapp.replace(/\D/g, '');
    const title = listing?.title ?? 'your listing';
    const msg = encodeURIComponent(
      `Hello, I found your listing on Velontri.\nI'm interested in: ${title}\nIs it still available?`
    );
    return `https://wa.me/${clean}?text=${msg}`;
  }

  function handleMessage() {
    if (!session.isAuthenticated) {
      router.push(`${ROUTES.login}?redirect=/listings/${id}`);
      return;
    }
    setPanel('message');
  }

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: listing?.title, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }

  function prevImg() { setImgIdx(i => (i - 1 + images.length) % images.length); }
  function nextImg() { setImgIdx(i => (i + 1) % images.length); }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Navbar />

      {/* Lightbox */}
      {lightbox && hasImages && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 backdrop-blur-sm"
          onClick={() => setLightbox(false)}>
          <button onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center
              rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
            <X className="h-5 w-5" />
          </button>
          <img src={images[imgIdx]} alt={listing?.title}
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Message panel modal */}
      {panel !== 'none' && listing && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center
          bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={() => setPanel('none')}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <MessagePanel
              listingId={id} sellerId={listing.seller_id ?? ''}
              sellerName={sellerName} listingTitle={listing.title}
              onClose={() => setPanel('none')}
            />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[13px] text-slate-400 mb-7">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 hover:text-slate-700 transition-colors cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <ChevronRight className="h-3.5 w-3.5 opacity-40" />
          <button onClick={() => router.push('/listings')}
            className="hover:text-slate-700 transition-colors cursor-pointer">Listings</button>
          {listing && (
            <>
              <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              <span className="text-slate-700 truncate max-w-[200px]">{listing.title}</span>
            </>
          )}
        </nav>

        {/* Error */}
        {isError && (
          <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
            <p className="text-[18px] font-bold text-slate-900 mb-2">Listing not found</p>
            <button onClick={() => router.push('/listings')}
              className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-6 text-[14px]
                font-semibold text-white hover:bg-indigo-700 transition-colors">
              Browse all listings
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <div className="aspect-[4/3] rounded-2xl bg-slate-200 animate-pulse" />
              <div className="h-8 w-2/3 rounded-xl bg-slate-200 animate-pulse" />
            </div>
            <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
        )}

        {/* Main content */}
        {listing && (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">

            {/* LEFT */}
            <div className="space-y-6">

              {/* Main image */}
              <div className="relative overflow-hidden rounded-2xl bg-slate-100 border border-slate-200 group"
                style={{ aspectRatio: '4/3' }}>
                {hasImages ? (
                  <>
                    <img src={images[imgIdx]} alt={listing.title} className="h-full w-full object-cover" />
                    <button onClick={() => setLightbox(true)}
                      className="absolute inset-0 flex items-center justify-center
                        bg-black/0 hover:bg-black/20 transition-colors" aria-label="View full size">
                      <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5
                        text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100
                        transition-opacity backdrop-blur-sm">
                        <ZoomIn className="h-3.5 w-3.5" /> View full size
                      </span>
                    </button>
                    {images.length > 1 && (
                      <>
                        <button onClick={prevImg}
                          className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9
                            items-center justify-center rounded-full bg-white/80 shadow hover:bg-white">
                          <ChevronLeft className="h-4 w-4 text-slate-700" />
                        </button>
                        <button onClick={nextImg}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9
                            items-center justify-center rounded-full bg-white/80 shadow hover:bg-white">
                          <ChevronRight className="h-4 w-4 text-slate-700" />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <ListingImagePlaceholder type={listing.listing_type} title={listing.title} />
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={() => {
                      if (!session.isAuthenticated) {
                        router.push(`${ROUTES.login}?redirect=/listings/${id}`);
                        return;
                      }
                      toggleSave();
                    }}
                    disabled={savePending}
                    title={isSaved ? 'Remove from saved' : 'Save listing'}
                    className={`h-9 w-9 rounded-xl backdrop-blur-sm border flex items-center justify-center
                      shadow-sm transition-all hover:scale-105 disabled:opacity-60 ${
                        isSaved
                          ? 'bg-red-500 border-red-400 text-white'
                          : 'bg-white/90 border-white/50 text-slate-600 hover:bg-white'
                      }`}>
                    <Heart className={`h-4 w-4 ${isSaved ? 'fill-white' : ''}`} />
                  </button>
                  <button onClick={handleShare}
                    className="h-9 w-9 rounded-xl bg-white/90 backdrop-blur-sm border border-white/50
                      flex items-center justify-center text-slate-600 shadow-sm hover:bg-white">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
                    style={{ background: TYPE_COLOR[listing.listing_type] ?? '#4F46E5' }}>
                    {listing.listing_type}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1
                    text-[11px] font-semibold text-slate-500">{listing.category}</span>
                  {listing.condition && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1
                      text-[11px] font-semibold text-slate-500 capitalize">{listing.condition}</span>
                  )}
                </div>
                <h1 className="text-[1.6rem] font-black text-slate-900 leading-tight tracking-tight mb-3">
                  {listing.title}
                </h1>
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

              {/* Safety notice — always visible */}
              <SafetyNotice />
            </div>

            {/* RIGHT — sticky sidebar */}
            <div className="space-y-4 lg:sticky lg:top-20 self-start">

              {/* Price + CTA */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1.5">
                    Listed price
                  </p>
                  <p className="text-[2.25rem] font-black text-slate-900 tracking-tight leading-none">
                    {fmt(listing.price ?? 0, listing.currency ?? 'NGN')}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {/* Primary WhatsApp CTA */}
                  {whatsapp ? (
                    <a
                      href={buildWhatsAppUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full h-13 items-center justify-center gap-2.5 rounded-xl
                        bg-[#25D366] text-white text-[14px] font-bold shadow-sm
                        hover:bg-[#1ebe5d] active:scale-[0.99] transition-all no-underline py-3.5"
                    >
                      {/* WhatsApp SVG icon */}
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white flex-shrink-0">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15
                          -.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475
                          -.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52
                          .149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207
                          -.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372
                          -.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096
                          3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085
                          1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.857L0 24l6.335-1.51
                          A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.572
                          -.504-5.057-1.385l-.362-.215-3.758.895.952-3.663-.235-.376A9.96 9.96 0 012 12C2
                          6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                      </svg>
                      Chat Seller on WhatsApp
                    </a>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                      <p className="text-[13px] text-slate-500">Contact info not available</p>
                    </div>
                  )}

                  {/* Secondary message button */}
                  <button onClick={handleMessage}
                    className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white text-[14px]
                      font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600
                      active:scale-[0.99] transition-all flex items-center justify-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    {session.isAuthenticated ? 'Message in app' : 'Sign in to message'}
                  </button>
                </div>

                {!session.isAuthenticated && (
                  <p className="text-center text-[12px] text-slate-400">
                    <button onClick={() => router.push(`${ROUTES.login}?redirect=/listings/${id}`)}
                      className="text-indigo-600 font-semibold hover:underline">Sign in</button>
                    {' '}or{' '}
                    <button onClick={() => router.push(ROUTES.register)}
                      className="text-indigo-600 font-semibold hover:underline">register</button>
                    {' '}to send in-app messages
                  </p>
                )}
              </div>

              {/* Seller card */}
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full
                  bg-indigo-100 text-[15px] font-bold text-indigo-700 uppercase">
                  {sellerName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{sellerName}</p>
                    <BadgeCheck className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[12px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.9
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~1 hr reply</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {listing.review_count ?? 0} reviews
                    </span>
                  </div>
                </div>
              </div>

              {/* Safety notice — also in sidebar on desktop */}
              <div className="hidden lg:block">
                <SafetyNotice />
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
