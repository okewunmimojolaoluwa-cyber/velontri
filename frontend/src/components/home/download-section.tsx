'use client';

import Link from 'next/link';
import { Smartphone, Star, Download, Shield } from 'lucide-react';

export function DownloadSection() {
  return (
    <section className="py-20 px-4 sm:px-6 bg-background">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl">
          {/* Background */}
          <div className="absolute inset-0 gradient-hero" />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 60% 70% at 80% 50%, hsl(243 75% 59% / 0.4) 0%, transparent 60%), radial-gradient(ellipse 40% 50% at 20% 50%, hsl(271 91% 65% / 0.3) 0%, transparent 55%)',
          }} />
          <div className="absolute inset-0 bg-grid bg-grid opacity-[0.04]" />

          {/* Decorative orbs */}
          <div className="absolute top-1/4 right-1/4 h-48 w-48 rounded-full blur-3xl bg-primary/20 animate-float" />
          <div className="absolute bottom-1/4 left-1/4 h-32 w-32 rounded-full blur-3xl bg-violet-500/20 animate-float" style={{ animationDelay: '1.5s' }} />

          <div className="relative z-10 grid gap-10 lg:grid-cols-2 items-center p-10 sm:p-14">
            {/* Left */}
            <div className="space-y-6 text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm backdrop-blur-sm">
                <Smartphone className="h-4 w-4 text-amber-300" />
                <span className="text-white/80">Available on iOS & Android</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black leading-tight">
                The marketplace
                <br />in your pocket
              </h2>

              <p className="text-white/60 leading-relaxed">
                Browse listings, message sellers, track orders, and manage your wallet
                — all from the Velontri mobile app. Commerce, anywhere in Africa.
              </p>

              {/* App store buttons */}
              <div className="flex flex-wrap gap-3">
                <button className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm px-5 py-3 hover:bg-white/15 transition-colors">
                  <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-xs text-white/50 leading-none">Download on the</p>
                    <p className="text-sm font-semibold text-white leading-tight">App Store</p>
                  </div>
                </button>

                <button className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm px-5 py-3 hover:bg-white/15 transition-colors">
                  <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.18 23.76c.35.2.76.21 1.14.04L14.84 12 4.32.2C3.94.03 3.53.04 3.18.24 2.83.44 2.62.84 2.62 1.29v21.42c0 .45.21.85.56 1.05zm11.48-11.56L4.45 2.02l10.12 10.12-10.12 10.12 10.21-10.06z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-xs text-white/50 leading-none">Get it on</p>
                    <p className="text-sm font-semibold text-white leading-tight">Google Play</p>
                  </div>
                </button>
              </div>

              {/* App stats */}
              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {['from-pink-400 to-rose-500', 'from-blue-400 to-indigo-500', 'from-emerald-400 to-teal-500'].map((g, i) => (
                      <div key={i} className={`h-8 w-8 rounded-full bg-gradient-to-br ${g} border-2 border-white/20 flex items-center justify-center text-xs font-bold text-white`}>
                        {['A', 'K', 'F'][i]}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-white/50">15M+ users</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold text-white">4.9</span>
                  <span className="text-xs text-white/50">(120K reviews)</span>
                </div>
              </div>
            </div>

            {/* Right — phone mockup */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative w-56">
                {/* Phone frame */}
                <div className="relative rounded-[2.5rem] border-4 border-white/15 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden aspect-[9/19]">
                  {/* Screen content */}
                  <div className="h-full p-3 space-y-3">
                    {/* Status bar */}
                    <div className="flex justify-between items-center px-1">
                      <span className="text-white/40 text-xs">9:41</span>
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                        <div className="h-1.5 w-4 rounded-full bg-white/40" />
                      </div>
                    </div>
                    {/* App header */}
                    <div className="rounded-xl gradient-primary p-3 text-white">
                      <p className="text-xs font-bold">Velontri</p>
                      <p className="text-xs text-white/60 mt-0.5">₦48,200 available</p>
                    </div>
                    {/* Mini cards */}
                    {['📱 iPhone 15 · ₦1.2M', '🚗 Camry 2023 · ₦18M', '🏠 Lekki 3-bed · ₦85M'].map((item) => (
                      <div key={item} className="rounded-xl bg-white/8 border border-white/10 px-3 py-2">
                        <p className="text-xs text-white/70">{item}</p>
                      </div>
                    ))}
                    {/* Search bar */}
                    <div className="rounded-xl bg-white/8 border border-white/10 px-3 py-2 flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-white/20" />
                      <p className="text-xs text-white/30">Search listings…</p>
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -left-8 top-8 glass rounded-xl px-3 py-2 border border-white/15 animate-float" style={{ animationDelay: '0.5s' }}>
                  <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium">
                    <Download className="h-3 w-3 text-emerald-400" />
                    New order!
                  </div>
                </div>
                <div className="absolute -right-6 bottom-16 glass rounded-xl px-3 py-2 border border-white/15 animate-float" style={{ animationDelay: '1.2s' }}>
                  <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium">
                    <Shield className="h-3 w-3 text-primary" />
                    Escrow released
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
