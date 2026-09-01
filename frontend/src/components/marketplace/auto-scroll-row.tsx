'use client';

import { useRef, useCallback, type ReactNode } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

interface AutoScrollRowProps {
  children: ReactNode;
  /** unused — kept for API compatibility */
  speed?: number;
}

/**
 * Premium horizontal listing carousel — Jiji-style.
 *
 * - Single flex row, flex-nowrap — cards NEVER wrap to a second line
 * - overflow-x: scroll with hidden scrollbar (all browsers)
 * - Left / right arrow buttons appear on hover (desktop)
 * - Touch swipe works natively
 * - Mouse wheel scroll converted to horizontal
 * - scroll-snap for snappy feel
 */
export function AutoScrollRow({ children }: AutoScrollRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const SCROLL_BY = 290;

  const scrollLeft = useCallback(() => {
    trackRef.current?.scrollBy({ left: -SCROLL_BY, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    trackRef.current?.scrollBy({ left: SCROLL_BY, behavior: 'smooth' });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    // Only hijack if vertical scroll delta dominates (trackpad/mouse wheel)
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  }, []);

  return (
    <div className="relative group/car w-full overflow-hidden">

      {/* Left arrow */}
      <button
        type="button"
        onClick={scrollLeft}
        aria-label="Scroll left"
        className={[
          'absolute left-1 top-1/2 -translate-y-1/2 z-20',
          'flex h-9 w-9 items-center justify-center',
          'rounded-full bg-white shadow-lg border border-slate-200',
          'text-slate-500 transition-all duration-200',
          'opacity-0 group-hover/car:opacity-100',
          'hover:text-indigo-600 hover:border-indigo-300 hover:shadow-indigo-100',
          'active:scale-90',
        ].join(' ')}
      >
        <CaretLeft className="h-4 w-4" weight="bold" />
      </button>

      {/* Scrollable track — THE key container */}
      <div
        ref={trackRef}
        onWheel={handleWheel}
        className="carousel-track flex gap-4 overflow-x-scroll pb-2"
        style={{
          flexWrap: 'nowrap',            /* ← never wrap */
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',        /* Firefox */
          msOverflowStyle: 'none',       /* IE/Edge legacy */
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {children}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        onClick={scrollRight}
        aria-label="Scroll right"
        className={[
          'absolute right-1 top-1/2 -translate-y-1/2 z-20',
          'flex h-9 w-9 items-center justify-center',
          'rounded-full bg-white shadow-lg border border-slate-200',
          'text-slate-500 transition-all duration-200',
          'opacity-0 group-hover/car:opacity-100',
          'hover:text-indigo-600 hover:border-indigo-300 hover:shadow-indigo-100',
          'active:scale-90',
        ].join(' ')}
      >
        <CaretRight className="h-4 w-4" weight="bold" />
      </button>
    </div>
  );
}
