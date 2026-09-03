'use client';

import { useRef, useCallback, useEffect, type ReactNode } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

interface AutoScrollRowProps {
  children: ReactNode;
  /** px per second for auto-scroll — default 40 */
  speed?: number;
}

/**
 * Premium horizontal listing carousel — Jiji-style.
 *
 * - Single flex row, flex-nowrap — cards NEVER wrap to a second line
 * - Auto-scrolls continuously left→right when the row overflows the viewport
 * - Pauses on hover / touch so the user can browse freely
 * - Resumes 2 s after the user stops interacting
 * - Left / right arrow buttons appear on hover (desktop)
 * - Touch swipe works natively
 * - Mouse wheel converted to horizontal scroll
 */
export function AutoScrollRow({ children, speed = 40 }: AutoScrollRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SCROLL_BY = 290;

  /* ─── Arrow buttons ──────────────────────────────────────── */
  const scrollLeft = useCallback(() => {
    trackRef.current?.scrollBy({ left: -SCROLL_BY, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    trackRef.current?.scrollBy({ left: SCROLL_BY, behavior: 'smooth' });
  }, []);

  /* ─── Wheel → horizontal ─────────────────────────────────── */
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  }, []);

  /* ─── Pause / resume helpers ─────────────────────────────── */
  const pause = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, 2000);
  }, []);

  /* ─── Auto-scroll loop ───────────────────────────────────── */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    function step(ts: number) {
      if (!el) return;

      // Only auto-scroll when content is wider than the container
      const overflows = el.scrollWidth > el.clientWidth + 4;

      if (overflows && !pausedRef.current) {
        if (lastTimeRef.current === null) lastTimeRef.current = ts;
        const delta = ts - lastTimeRef.current;
        lastTimeRef.current = ts;

        const pxToMove = (speed / 1000) * delta;
        el.scrollLeft += pxToMove;

        // When we've reached the end, snap back to start
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) {
          el.scrollLeft = 0;
        }
      } else {
        // Reset timer so the next movement starts fresh
        lastTimeRef.current = null;
      }

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [speed]);

  return (
    <div
      className="relative group/car w-full overflow-hidden"
      onMouseEnter={pause}
      onMouseLeave={scheduleResume}
      onTouchStart={pause}
      onTouchEnd={scheduleResume}
    >
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

      {/* Scrollable track */}
      <div
        ref={trackRef}
        onWheel={handleWheel}
        className="carousel-track flex gap-4 overflow-x-scroll pb-2"
        style={{
          flexWrap: 'nowrap',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
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
