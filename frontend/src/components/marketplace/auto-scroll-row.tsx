'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';

interface AutoScrollRowProps {
  /** Card elements to scroll */
  children: ReactNode;
  /** px/second — lower = slower. Default 45 */
  speed?: number;
}

/**
 * Desktop-only infinite auto-scrolling carousel.
 * Duplicates children for a seamless loop.
 * Pauses on hover.
 * On mobile (< md) renders a standard horizontal scroll strip.
 */
export function AutoScrollRow({ children, speed = 45 }: AutoScrollRowProps) {
  const firstRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    const el = firstRef.current;
    if (!el) return;

    // Measure after a paint so images have a chance to affect layout
    const measure = () => {
      const w = el.offsetWidth;
      if (w > 0) setDuration(w / speed);
    };

    measure();
    // Re-measure if window resizes
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, [speed]);

  return (
    <>
      {/* ── Desktop: auto-scrolling marquee ── */}
      <div
        className="marquee-wrapper hidden md:block relative overflow-hidden w-full"
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
          maskImage:
            'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
        }}
      >
        <div
          className="marquee-track flex gap-4"
          style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
        >
          {/* First copy — measured for width */}
          <div ref={firstRef} className="flex gap-4 flex-shrink-0">
            {children}
          </div>
          {/* Duplicate — seamless loop */}
          <div className="flex gap-4 flex-shrink-0" aria-hidden="true">
            {children}
          </div>
        </div>
      </div>

      {/* ── Mobile: regular horizontal scroll ── */}
      <div className="flex gap-3 overflow-x-auto md:hidden pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {children}
      </div>
    </>
  );
}
