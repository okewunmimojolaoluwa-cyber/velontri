'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
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

export function ListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group block card-base card-hover overflow-hidden listing-card"
    >
      {/* ── Image — locked 4:3 on desktop, 1:1 on mobile ── */}
      <ListingImage
        src={listing.image_url}
        alt={listing.title}
        type={listing.listing_type}
        category={listing.category}
        ratio="4/3"
        className="group-hover:scale-[1.03] transition-transform duration-500"
      />

      {/* ── Content — fixed padding so every card is identical ── */}
      <div className="p-4 space-y-1.5">
        {/* Category label */}
        <p className="text-2xs text-muted-foreground uppercase tracking-wider font-medium truncate">
          {listing.category}
        </p>

        {/* Title — always 2 lines max, never grows the card */}
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-foreground
          group-hover:text-primary transition-colors duration-150 min-h-[2.5rem]">
          {listing.title}
        </h3>

        {/* Price + location — always on bottom */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-base font-bold text-primary whitespace-nowrap">
            {fmt(listing.price, listing.currency)}
          </span>
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
