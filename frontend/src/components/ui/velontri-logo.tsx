'use client';

import { cn } from '@/lib/utils/cn';

/**
 * VelontriLogo — renders the Velontri phoenix-V mark.
 *
 * Drop the logo image at: frontend/public/logo.png
 * (The logo should be the phoenix-V on a black or transparent background)
 *
 * Light mode: shows the logo in a dark indigo container (brand colors)
 * Dark mode:  same — logo looks great on dark backgrounds
 */
interface VelontriLogoProps {
  /** Height & width of the logo container in px */
  size?: number;
  className?: string;
  /** If true, show the wordmark "Velontri" next to the mark */
  showWordmark?: boolean;
  wordmarkClassName?: string;
  /** Size variant for the wordmark */
  wordmarkSize?: 'sm' | 'md' | 'lg';
}

const WORDMARK_SIZES = {
  sm: 'text-[13px]',
  md: 'text-[15px]',
  lg: 'text-[20px]',
};

export function VelontriLogo({
  size = 32,
  className,
  showWordmark = false,
  wordmarkClassName,
  wordmarkSize = 'md',
}: VelontriLogoProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-shrink-0', className)}>
      {/* Logo mark — dark rounded container matches brand */}
      <div
        className="flex flex-shrink-0 items-center justify-center rounded-xl overflow-hidden"
        style={{
          width: size,
          height: size,
          background: '#0a0a0a',
          padding: Math.round(size * 0.06),
        }}
      >
        <img
          src="/logo.png"
          alt="Velontri"
          width={size}
          height={size}
          className="w-full h-full object-contain"
          draggable={false}
          onError={(e) => {
            // Fallback: show a V if image not found
            const el = e.currentTarget;
            el.style.display = 'none';
            const fallback = el.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        {/* Fallback V mark */}
        <span
          className="hidden items-center justify-center text-white font-black"
          style={{ fontSize: size * 0.55 }}
        >
          V
        </span>
      </div>

      {showWordmark && (
        <span className={cn(
          'font-black tracking-tight select-none text-slate-900 dark:text-white',
          WORDMARK_SIZES[wordmarkSize],
          wordmarkClassName,
        )}>
          Velontri
        </span>
      )}
    </div>
  );
}

export function VelontriWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-black tracking-tight select-none', className)}>
      Velontri
    </span>
  );
}
