'use client';

import Link from 'next/link';
import { MapPin, SealCheck, Camera, Timer } from '@phosphor-icons/react';
import { ListingImage } from '@/components/ui/listing-image';
import type { ListingSummary } from '@/lib/api/endpoints/listings';

function fmt(n: number, currency: string) {
 try {
 return new Intl.NumberFormat('en-NG', {
 style: 'currency', currency, maximumFractionDigits: 0,
 notation: n >= 1_000_000 ? 'compact' : 'standard',
 }).format(n);
 } catch { return `${currency} ${n.toLocaleString()}`; }
}

/**
 * Returns a short, human-friendly "active for" string.
 * Examples: "Today", "2d", "3wk", "5mo", "2yr"
 */
function activeDuration(createdAt: string | undefined | null): string | null {
 if (!createdAt) return null;
 try {
 const date = new Date(createdAt);
 // Sanity check — reject clearly invalid dates
 if (isNaN(date.getTime()) || date.getFullYear() < 2020) return null;
 const ms = Date.now() - date.getTime();
 if (ms < 0) return null; // future date — skip
 const minutes = Math.floor(ms / 60_000);
 const hours = Math.floor(ms / 3_600_000);
 const days = Math.floor(ms / 86_400_000);
 const weeks = Math.floor(days / 7);
 const months = Math.floor(days / 30);
 const years = Math.floor(days / 365);

 if (minutes < 60) return 'Just listed';
 if (hours < 24) return `${hours}h ago`;
 if (days === 1) return '1 day';
 if (days < 7) return `${days} days`;
 if (weeks === 1) return '1 week';
 if (weeks < 5) return `${weeks} weeks`;
 if (months === 1) return '1 month';
 if (months < 12) return `${months} months`;
 if (years === 1) return '1 year';
 return `${years} years`;
 } catch {
 return null;
 }
}

export function ListingCard({ listing }: { listing: ListingSummary }) {
 const mediaCount = (listing as any).media_count as number | undefined;
 const duration = activeDuration(listing.created_at);

 return (
 <Link
 href={`/listings/${listing.id}`}
 className="group block card-base card-hover overflow-hidden listing-card"
 >
      {/* ── Image — locked 4:3 on desktop, 1:1 on mobile ── */}
 <div className="relative">
 <ListingImage
 src={listing.image_url}
 alt={listing.title}
 type={listing.listing_type}
 category={listing.category}
 ratio="4/3"
 className="group-hover:scale-[1.03] transition-transform duration-500"
 />
        {/* Photo count badge */}
 {mediaCount != null && mediaCount > 1 && (
 <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm pointer-events-none tabular-nums">
 <Camera className="h-2.5 w-2.5 flex-shrink-0" />
 {mediaCount}
 </div>
 )}
        {/* Active duration badge — top-left of image */}
 {duration && (
 <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm pointer-events-none">
 <Timer className="h-2.5 w-2.5 flex-shrink-0" />
 {duration}
 </div>
 )}
 </div>

      {/* ── Content ── */}
 <div className="p-4 space-y-1.5">
        {/* Category label + verified badge row */}
 <div className="flex items-center justify-between gap-1">
 <p className="text-2xs text-muted-foreground uppercase tracking-wider font-medium truncate">
 {listing.category}
 </p>
 {(listing as any).seller_verified && (
 <span className="flex items-center gap-0.5 flex-shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
 <SealCheck className="h-2.5 w-2.5" />
 Verified
 </span>
 )}
 </div>

        {/* Title */}
 <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-foreground
 group-hover:text-primary transition-colors duration-150 min-h-[2.5rem]">
 {listing.title}
 </h3>

        {/* Price + location */}
 <div className="flex items-center justify-between gap-2 pt-1">
 <div className="flex items-center gap-1.5 min-w-0">
 <span className="text-base font-bold text-primary whitespace-nowrap">
 {fmt(listing.price, listing.currency)}
 </span>
 {listing.is_negotiable && (
 <span className="flex-shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 whitespace-nowrap">
 Nego
 </span>
 )}
 </div>
 {(listing.city || listing.state) && (
 <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
 <MapPin className="h-3 w-3 flex-shrink-0" />
 <span className="truncate">
 {listing.city ?? listing.state}
 </span>
 </div>
 )}
 </div>
 </div>
 </Link>
 );
}

export function ListingCardSkeleton() {
 return (
 <div className="card-base overflow-hidden">
      {/* Locked aspect — same as real card */}
 <div className="aspect-card bg-slate-100 animate-pulse" />
 <div className="p-4 space-y-2.5">
 <div className="h-2.5 w-16 rounded-full bg-slate-100 animate-pulse" />
        {/* Title area — fixed height matches line-clamp-2 */}
 <div className="space-y-1.5">
 <div className="h-4 w-4/5 rounded-lg bg-slate-100 animate-pulse" />
 <div className="h-4 w-3/5 rounded-lg bg-slate-100 animate-pulse" />
 </div>
 <div className="flex justify-between pt-1">
 <div className="h-5 w-24 rounded-lg bg-slate-100 animate-pulse" />
 <div className="h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
 </div>
 </div>
 </div>
 );
}