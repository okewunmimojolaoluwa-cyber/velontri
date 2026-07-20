'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ComingSoonModalProps {
  store: 'google' | 'apple' | null;
  onClose: () => void;
}

export function ComingSoonModal({ store, onClose }: ComingSoonModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (store) {
      // Trigger entrance animation on next tick
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [store]);

  if (!store) return null;

  const isGoogle = store === 'google';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(20px)',
          transition: 'opacity 350ms cubic-bezier(0.34,1.56,0.64,1), transform 350ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div className="relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl"
          style={{
            background: isGoogle
              ? 'linear-gradient(135deg, #0f0c29 0%, #1a1060 50%, #24243e 100%)'
              : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          }}
        >
          {/* Glow orb */}
          <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full blur-3xl"
            style={{
              background: isGoogle
                ? 'radial-gradient(circle, rgba(79,70,229,0.5) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center
              rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white
              transition-all"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative z-10 px-8 py-10 text-center">
            {/* Store icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg"
              style={{
                background: isGoogle
                  ? 'linear-gradient(135deg, #4285F4, #34A853)'
                  : 'linear-gradient(135deg, #555, #1c1c1e)',
              }}>
              {isGoogle ? (
                /* Google Play icon */
                <svg viewBox="0 0 24 24" className="h-10 w-10 fill-white">
                  <path d="M3.18 23.76c.3.17.64.24.99.18l11.65-11.94L12.1 9.18 3.18 23.76z"/>
                  <path d="M20.57 10.31l-2.8-1.6-3.32 3.29 3.32 3.3 2.82-1.62a1.96 1.96 0 000-3.37z"/>
                  <path d="M2.4.41a1.96 1.96 0 00-.4 1.22v20.74c0 .45.14.86.4 1.21l.07.07 11.62-11.62v-.28L2.47.34 2.4.41z"/>
                  <path d="M16.82 15.72L4.16 23.94c-.33.2-.68.26-1 .19l11.66-11.94 2 1.53z"/>
                </svg>
              ) : (
                /* Apple icon */
                <svg viewBox="0 0 24 24" className="h-10 w-10 fill-white">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              )}
            </div>

            {/* Coming Soon text with animated dots */}
            <div className="mb-2">
              <span
                className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-3"
                style={{ color: isGoogle ? '#818cf8' : '#a5b4fc' }}
              >
                {isGoogle ? 'Google Play Store' : 'Apple App Store'}
              </span>
              <h2
                className="font-black text-white leading-tight"
                style={{
                  fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
                  letterSpacing: '-0.04em',
                  textShadow: '0 2px 20px rgba(99,102,241,0.4)',
                }}
              >
                Coming
              </h2>
              <h2
                className="font-black leading-tight"
                style={{
                  fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
                  letterSpacing: '-0.04em',
                  background: isGoogle
                    ? 'linear-gradient(90deg, #818cf8, #34d399)'
                    : 'linear-gradient(90deg, #a78bfa, #60a5fa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Soon
              </h2>
            </div>

            <p className="mt-4 text-[13px] text-slate-400 leading-relaxed">
              The Velontri mobile app is under development.<br />
              We&apos;ll notify you when it&apos;s ready.
            </p>

            {/* Animated progress bar */}
            <div className="mt-6 rounded-full bg-white/10 h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: '65%',
                  background: isGoogle
                    ? 'linear-gradient(90deg, #4F46E5, #34d399)'
                    : 'linear-gradient(90deg, #7C3AED, #60a5fa)',
                  animation: 'shimmer-bar 2s ease-in-out infinite',
                }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-600">65% complete</p>

            <button
              onClick={onClose}
              className="mt-6 w-full h-11 rounded-2xl font-bold text-[14px] text-white
                transition-all hover:opacity-90 active:scale-[0.97]"
              style={{
                background: isGoogle
                  ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                  : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer-bar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(0%); }
          100% { transform: translateX(0%); }
        }
      `}</style>
    </>
  );
}
