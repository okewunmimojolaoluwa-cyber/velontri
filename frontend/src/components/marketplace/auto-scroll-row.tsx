'use client';

import { useRef, useCallback, useEffect, type ReactNode } from 'react';

interface AutoScrollRowProps {
  children: ReactNode;
  /** px per second — default 40 */
  speed?: number;
}

/**
 * Horizontal listing carousel.
 *
 * - Single flex row, never wraps
 * - Auto-scrolls only when content overflows the container
 * - Pauses on hover / touch, resumes 2 s after user stops interacting
 * - Mouse wheel and touch swipe work natively
 */
export function AutoScrollRow({ children, speed = 40 }: AutoScrollRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Pause / resume ───────────────────────────────────── */
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

  /* ── Wheel → horizontal ───────────────────────────────── */
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  }, []);

  /* ── Auto-scroll loop ─────────────────────────────────── */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    function step(ts: number) {
      if (!el) return;

      const overflows = el.scrollWidth > el.clientWidth + 4;

      if (overflows && !pausedRef.current) {
        if (lastTimeRef.current === null) lastTimeRef.current = ts;
        const delta = ts - lastTimeRef.current;
        lastTimeRef.current = ts;

        el.scrollLeft += (speed / 1000) * delta;

        // wrap back to start when we hit the end
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) {
          el.scrollLeft = 0;
        }
      } else {
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
      className="w-full overflow-hidden"
      onMouseEnter={pause}
      onMouseLeave={scheduleResume}
      onTouchStart={pause}
      onTouchEnd={scheduleResume}
    >
      <div
        ref={trackRef}
        onWheel={handleWheel}
        className="carousel-track flex gap-4 overflow-x-scroll pb-2"
        style={{
          flexWrap: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
