'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, Sparkles, ArrowRight, CheckCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { useRouter } from 'next/navigation';

// Premium Unsplash photos — African business, lifestyle, commerce
const BG_IMAGES = [
  'https://images.unsplash.com/photo-1611095789397-4d8f5d7dded7?w=1920&q=80&fit=crop',
  'https://images.unsplash.com/photo-1577900232427-18219b9166a0?w=1920&q=80&fit=crop',
  'https://images.unsplash.com/photo-1534470397273-33e44e8b6e45?w=1920&q=80&fit=crop',
  'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1920&q=80&fit=crop',
];

// Floating product cards
const FLOAT_CARDS = [
  { emoji: '📱', title: 'iPhone 15 Pro Max', price: '₦1.2M', loc: 'Lagos', delay: '0s', x: 'left-[5%]', y: 'top-[25%]' },
  { emoji: '🚗', title: 'Toyota Camry 2023', price: '₦18.5M', loc: 'Abuja', delay: '0.6s', x: 'right-[4%]', y: 'top-[20%]' },
  { emoji: '🏠', title: '3-Bed Apartment', price: '₦85M', loc: 'Lekki', delay: '1.2s', x: 'left-[3%]', y: 'bottom-[25%]' },
  { emoji: '👗', title: 'Designer Kaftan', price: '₦45,000', loc: 'Kano', delay: '1.8s', x: 'right-[5%]', y: 'bottom-[30%]' },
  { emoji: '💼', title: 'UI/UX Designer', price: '₦500K/mo', loc: 'Remote', delay: '2.4s', x: 'left-[8%]', y: 'top-[55%]' },
];

export function HeroSection() {
  const router = useRouter();
  const [bgIndex, setBgIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
    const timer = setInterval(() => setBgIndex((i) => (i + 1) % BG_IMAGES.length), 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* ── Layered background images ── */}
      {BG_IMAGES.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === bgIndex ? 1 : 0 }}
        >
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover object-center"
            style={{ filter: 'blur(2px) brightness(0.35) saturate(1.2)' }}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        </div>
      ))}

      {/* ── Gradient overlays ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/80 via-slate-900/70 to-violet-950/80" />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 70% 70% at 20% -5%, hsl(243 75% 59% / 0.35) 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 80% 110%, hsl(271 91% 65% / 0.25) 0%, transparent 55%)',
      }} />
      {/* Bottom page fade */}
      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-background to-transparent" />

      {/* ── Floating product cards (hidden on mobile) ── */}
      {FLOAT_CARDS.map((card) => (
        <div
          key={card.title}
          className={`absolute hidden lg:block ${card.x} ${card.y} animate-float z-10`}
          style={{ animationDelay: card.delay, animationDuration: `${3 + parseFloat(card.delay) * 0.4}s` }}
        >
          <div className="glass rounded-2xl px-4 py-3 min-w-[160px] shadow-xl border border-white/15 backdrop-blur-xl">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-2xl">{card.emoji}</span>
              <div>
                <p className="text-xs font-semibold text-white leading-tight">{card.title}</p>
                <p className="text-xs text-white/50">{card.loc}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gold-300">{card.price}</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5">Live</span>
            </div>
          </div>
        </div>
      ))}

      {/* ── Hero content ── */}
      <div className={`relative z-10 mx-auto max-w-4xl px-4 text-center transition-all duration-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* Eyebrow */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 backdrop-blur-sm px-5 py-2 text-sm text-white/75">
          <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          <span>Africa's #1 AI-powered commerce platform</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400">Live</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.04] tracking-tight mb-5">
          Where Africa
          <br />
          <span style={{ background: 'linear-gradient(135deg, #f59e0b, #fb923c, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            buys & sells
          </span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg text-white/60 leading-relaxed mb-10">
          Millions of products, cars, homes, jobs, and services — across 12 African markets,
          protected by escrow and powered by AI.
        </p>

        {/* Search bar */}
        <div className="mx-auto mb-8 max-w-2xl">
          <form
            onSubmit={(e) => { e.preventDefault(); if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`); }}
            className="flex items-center gap-2 rounded-2xl bg-white/8 backdrop-blur-xl border border-white/12 p-2 shadow-2xl"
          >
            <div className="flex flex-1 items-center gap-3 px-4">
              <Search className="h-5 w-5 text-white/40 flex-shrink-0" />
              <input
                type="text"
                placeholder="iPhone 15, Toyota Camry, 3-bed Lagos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder:text-white/35 text-base focus:outline-none"
              />
              <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/6 px-2.5 py-1 text-xs text-white/40">
                <Sparkles className="h-3 w-3 text-amber-400" />
                AI Search
              </div>
            </div>
            <Button size="md" className="flex-shrink-0 rounded-xl" type="submit">
              Search
            </Button>
          </form>

          {/* Quick chips */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {['iPhone 15', 'Toyota Camry', '3-bed Lagos', 'MacBook Pro', 'Fashion'].map((chip) => (
              <button
                key={chip}
                onClick={() => router.push(`/search?q=${encodeURIComponent(chip)}`)}
                className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs text-white/55 hover:bg-white/12 hover:text-white/80 transition-all"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <Button size="lg" variant="gold" asChild>
            <Link href={ROUTES.register} className="gap-2">
              Start selling free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="glass" asChild>
            <Link href={ROUTES.listings} className="gap-2">
              Browse listings <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-white/40">
          {['Zero listing fees', 'Escrow on every deal', 'AI-powered matching', '12 African markets'].map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* ── Slide indicator dots ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {BG_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setBgIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === bgIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}
          />
        ))}
      </div>
    </section>
  );
}
