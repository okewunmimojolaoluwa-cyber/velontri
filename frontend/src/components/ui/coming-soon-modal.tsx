'use client';

import { useEffect, useState } from 'react';
import { X, DeviceMobile, Sparkle } from '@phosphor-icons/react';

interface ComingSoonModalProps {
  store: 'google' | 'apple' | null;
  onClose: () => void;
}

export function ComingSoonModal({ store, onClose }: ComingSoonModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (store) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [store]);

  if (!store) return null;

  const isGoogle = store === 'google';

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 300);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-md transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 pointer-events-none"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 350ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div 
          className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: isGoogle
              ? 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1c2128 100%)'
              : 'linear-gradient(135deg, #000000 0%, #0a0a0a 50%, #1a1a1a 100%)',
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(30px)',
            transition: 'transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* Animated gradient background orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div 
              className="absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl opacity-30 animate-pulse"
              style={{
                background: isGoogle
                  ? 'radial-gradient(circle, #34A853 0%, transparent 70%)'
                  : 'radial-gradient(circle, #0071E3 0%, transparent 70%)',
              }}
            />
            <div 
              className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full blur-3xl opacity-20 animate-pulse"
              style={{
                background: isGoogle
                  ? 'radial-gradient(circle, #4285F4 0%, transparent 70%)'
                  : 'radial-gradient(circle, #A8AAAE 0%, transparent 70%)',
                animationDelay: '1s',
              }}
            />
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center
              rounded-full bg-white/10 backdrop-blur-sm text-white/70
              hover:bg-white/20 hover:text-white hover:scale-110
              active:scale-95 transition-all duration-200 shadow-lg"
          >
            <X className="h-5 w-5" weight="bold" />
          </button>

          <div className="relative z-10 px-8 py-12 text-center">
            {/* Store icon */}
            <div 
              className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl shadow-2xl transform hover:scale-105 transition-transform duration-300"
              style={{
                background: isGoogle
                  ? 'linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC04 100%)'
                  : 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)',
              }}
            >
              {isGoogle ? (
                <svg viewBox="0 0 24 24" className="h-12 w-12">
                  <path fill="#fff" d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85c-.5-.24-.84-.76-.84-1.35z"/>
                  <path fill="#fff" opacity="0.9" d="M16.81 15.12l-3.12-3.12-10.69 9.84c.16.08.34.13.53.13.22 0 .44-.06.63-.18l12.65-6.67z"/>
                  <path fill="#fff" opacity="0.8" d="M20.16 10.16l-3.35-1.77-3.12 3.61 3.12 3.12 3.35-1.77c.65-.34 1.04-1.01 1.04-1.75 0-.74-.39-1.41-1.04-1.75z"/>
                  <path fill="#fff" opacity="0.7" d="M3.84 2.15l9.85 9.85 3.12-3.12L4.16 2.21c-.19-.12-.41-.18-.63-.18-.19 0-.37.05-.53.13z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-12 w-12 fill-white">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              )}
            </div>

            {/* Store badge */}
            <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                background: isGoogle
                  ? 'linear-gradient(90deg, rgba(66,133,244,0.15), rgba(52,168,83,0.15))'
                  : 'linear-gradient(90deg, rgba(0,113,227,0.15), rgba(168,170,174,0.15))',
                border: `1px solid ${isGoogle ? 'rgba(66,133,244,0.3)' : 'rgba(0,113,227,0.3)'}`,
              }}
            >
              <DeviceMobile className="h-4 w-4" style={{ color: isGoogle ? '#4285F4' : '#0071E3' }} weight="duotone" />
              <span
                className="text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: isGoogle ? '#4285F4' : '#0071E3' }}
              >
                {isGoogle ? 'Google Play' : 'App Store'}
              </span>
            </div>

            {/* Heading */}
            <h2
              className="font-black text-white leading-tight mb-2"
              style={{
                fontSize: 'clamp(2rem, 6vw, 2.75rem)',
                letterSpacing: '-0.04em',
                textShadow: '0 4px 30px rgba(0,0,0,0.4)',
              }}
            >
              Coming Soon
            </h2>

            <div className="flex items-center justify-center gap-1 mb-4">
              <Sparkle className="h-4 w-4 text-yellow-400" weight="fill" />
              <p 
                className="text-sm font-semibold"
                style={{ 
                  background: isGoogle
                    ? 'linear-gradient(90deg, #4285F4, #34A853, #FBBC04)'
                    : 'linear-gradient(90deg, #0071E3, #A8AAAE)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Mobile App in Development
              </p>
              <Sparkle className="h-4 w-4 text-yellow-400" weight="fill" />
            </div>

            <p className="text-[14px] text-slate-400 leading-relaxed mb-6 max-w-xs mx-auto">
              We&apos;re building an amazing mobile experience for {isGoogle ? 'Android' : 'iOS'}. 
              You&apos;ll be notified as soon as it&apos;s ready to download!
            </p>

            {/* Progress section */}
            <div className="bg-white/5 rounded-2xl p-5 backdrop-blur-sm border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Development Progress</span>
                <span className="text-sm font-black text-white">65%</span>
              </div>
              <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="absolute inset-0 h-full rounded-full animate-pulse"
                  style={{
                    width: '65%',
                    background: isGoogle
                      ? 'linear-gradient(90deg, #4285F4, #34A853)'
                      : 'linear-gradient(90deg, #0071E3, #5AC8FA)',
                    boxShadow: isGoogle 
                      ? '0 0 20px rgba(66,133,244,0.5)'
                      : '0 0 20px rgba(0,113,227,0.5)',
                  }}
                />
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={handleClose}
              className="mt-6 w-full h-12 rounded-xl font-bold text-[15px] text-white
                transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{
                background: isGoogle
                  ? 'linear-gradient(135deg, #4285F4, #34A853)'
                  : 'linear-gradient(135deg, #0071E3, #5AC8FA)',
                boxShadow: isGoogle
                  ? '0 8px 20px rgba(66,133,244,0.3)'
                  : '0 8px 20px rgba(0,113,227,0.3)',
              }}
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
