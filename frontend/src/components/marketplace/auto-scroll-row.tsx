'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';

interface AutoScrollRowProps {
  /** Card elements to scroll */
  children: ReactNode;
  /** px/second — lower = slower. Default 45 */
  speed?: number;
}

/**
 * Smart listing row:
 * - Desktop: static grid if items fit in one row, auto-scrolling marquee if they overflow.
 * - Mobile: regular horizontal scroll strip.
 */
export function AutoScrollRow({ children, speed = 45 }: AutoScrollRowProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(30);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const measure = () => {
      const wrapper = wrapperRef.current;
      const first = firstRef.current;
      if (!wrapper || !first) return;

      const contentW = first.scrollWidth;
      const containerW = wrapper.offsetWidth;

      // Only scroll if content is wider than the container
      const doesOverflow = contentW > containerW;
      setOverflows(doesOverflow);

      if (doesOverflow && speed > 0) {
        setDuration(contentW / speed);
      }
    };

    measure();
    // Small delay for images to load and affect layout
    const t = setTimeout(measure, 300);
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [speed, children]);

  return (
    <>
      {/* ── Desktop ── */}
      <div ref={wrapperRef} className="hidden md:block w-full">
        {overflows ? (
          /* Scrolling marquee — only when content overflows */
          <div
            className="marquee-wrapper relative overflow-hidden w-full"
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
        ) : (
          /* Static grid — items fit in one row, no scrolling needed */
          <div ref={firstRef} className="flex gap-4 flex-wrap">
            {children}
          </div>
        )}
      </div>

      {/* ── Mobile: regular horizontal scroll ── */}
      <div
        className="flex gap-3 overflow-x-auto md:hidden pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </>
  );
}
