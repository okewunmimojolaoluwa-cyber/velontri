import type { ReactNode } from 'react';
import Link from 'next/link';
import { VelontriLogo } from '@/components/ui/velontri-logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
      <div className="lg:grid lg:grid-cols-2 min-h-screen">

        {/* ── Left photo panel ── */}
        <div className="relative hidden lg:block overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=90&fit=crop&crop=center"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'brightness(0.38) saturate(1.1)' }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.6) 0%, rgba(79,70,229,0.25) 50%, rgba(15,23,42,0.7) 100%)' }} />

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col justify-between p-12">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
              <VelontriLogo size={36} showWordmark wordmarkSize="md"
                wordmarkClassName="text-white" />
            </Link>

            {/* Bottom quote */}
            <div className="space-y-5">
              <div className="flex gap-1 mb-3">
                {[1,2,3,4,5].map(i => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                ))}
              </div>
              <p className="text-[1.25rem] font-semibold text-white leading-snug max-w-sm">
                &ldquo;I sold my car in 2 days. No agent, no commission — just a WhatsApp message from a serious buyer.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-xs font-bold text-white">
                  KA
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Kwame Asante</p>
                  <p className="text-xs text-white/50">Vehicle Seller · Kumasi, Ghana</p>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-4 border-t border-white/10 text-xs text-white/40">
                <span>Free to list</span>
                <span>·</span>
                <span>12 countries</span>
                <span>·</span>
                <span>No commissions</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12">
          <div className="w-full max-w-[400px]">
            {/* Mobile logo */}
            <Link href="/" className="mb-10 inline-flex items-center gap-2.5 no-underline lg:hidden">
              <VelontriLogo size={30} showWordmark wordmarkSize="md"
                wordmarkClassName="text-slate-900 dark:text-white" />
            </Link>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
