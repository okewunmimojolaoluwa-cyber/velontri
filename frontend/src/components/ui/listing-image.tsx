'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/* ─────────────────────────────────────────────────────────────
   Velontri Image Standardization System
   ─────────────────────────────────────────────────────────────
   All listing images are rendered inside a locked-ratio container.
   • object-fit: cover  → fills container, never distorts
   • object-position: center  → auto-crops excess edges
   • aspect-ratio locked  → card height never changes regardless of image
   • onError fallback  → premium placeholder, never empty
   ─────────────────────────────────────────────────────────────*/

export type AspectRatio = '4/3' | '1/1' | '16/9' | '3/1' | '4/5';

interface ListingImageProps {
  src?: string | null;
  alt: string;
  /** Listing type used for emoji placeholder */
  type?: string;
  /** category fallback */
  category?: string;
  /** Fixed aspect ratio of the image container */
  ratio?: AspectRatio;
  /** Extra classes on the container div */
  className?: string;
  /** Show photo count badge */
  photoCount?: number;
  /** Priority load (above the fold) */
  priority?: boolean;
  /** Custom placeholder icon/element */
  placeholder?: React.ReactNode;
  /** Called when image loads */
  onLoad?: () => void;
}

const TYPE_EMOJI: Record<string, string> = {
  vehicle:  '🚗',
  property: '🏠',
  job:      '💼',
  service:  '🔧',
  physical: '📦',
  product:  '📦',
  digital:  '💾',
};

const CATEGORY_EMOJI: Record<string, string> = {
  Vehicles:         '🚗',
  Property:         '🏠',
  Electronics:      '📱',
  Fashion:          '👗',
  Furniture:        '🛋️',
  Agriculture:      '🌾',
  Jobs:             '💼',
  Services:         '🔧',
  Food:             '🍔',
  Health:           '💊',
  Sports:           '⚽',
  Books:            '📚',
};

// Deterministic soft gradient from a seed string
const BG_PAIRS = [
  ['#EEF2FF', '#C7D2FE'],
  ['#F0FDF4', '#BBF7D0'],
  ['#FFF7ED', '#FED7AA'],
  ['#F0F9FF', '#BAE6FD'],
  ['#FDF4FF', '#E9D5FF'],
  ['#FFFBEB', '#FDE68A'],
  ['#FFF1F2', '#FECDD3'],
  ['#F0FDFA', '#99F6E4'],
];
function seedBg(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BG_PAIRS[h % BG_PAIRS.length];
}

const RATIO_MAP: Record<AspectRatio, string> = {
  '4/3':  'aspect-[4/3]',
  '1/1':  'aspect-square',
  '16/9': 'aspect-video',
  '3/1':  'aspect-[3/1]',
  '4/5':  'aspect-[4/5]',
};

export function ListingImage({
  src,
  alt,
  type,
  category,
  ratio = '4/3',
  className,
  photoCount,
  priority = false,
  placeholder,
  onLoad,
}: ListingImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const emoji = (type && TYPE_EMOJI[type]) ||
                (category && CATEGORY_EMOJI[category]) ||
                '📦';
  const [bg1, bg2] = seedBg(alt + (type ?? ''));
  const hasSrc = !!src && !failed;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-slate-100',
        RATIO_MAP[ratio],
        className,
      )}
    >
      {/* ── Real image ── */}
      {hasSrc && (
        <img
          src={src!}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          onLoad={() => { setLoaded(true); onLoad?.(); }}
          className={cn(
            // Core standardization: always fill, center-crop, never distort
            'absolute inset-0 h-full w-full object-cover object-center',
            'transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {/* ── Placeholder (no image or load failed) ── */}
      {(!hasSrc || !loaded) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)` }}
        >
          {placeholder ?? (
            <>
              <span className="text-4xl select-none" role="img" aria-label={category ?? type ?? 'listing'}>
                {emoji}
              </span>
              {hasSrc && !loaded && (
                /* Subtle loading shimmer over the emoji placeholder */
                <div className="absolute inset-0 bg-white/40 animate-pulse" />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Photo count badge ── */}
      {photoCount && photoCount > 1 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1
          rounded-full bg-black/60 backdrop-blur-sm px-2 py-1
          text-[10px] font-semibold text-white pointer-events-none">
          <Camera className="h-3 w-3" />
          {photoCount}
        </div>
      )}
    </div>
  );
}
