'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlass, CaretDown, CaretRight, MapPin, Shield, SealCheck, Lightning, TrendUp, Sparkle, Star, Quotes, List, X, ShoppingBag, Car, House, DeviceMobile, TShirt, Briefcase, Wrench } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { listingsApi, listingKeys } from '@/lib/api/endpoints/listings';
import { ROUTES } from '@/config/routes';
import { ListingImage } from '@/components/ui/listing-image';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { VelontriLogo } from '@/components/ui/velontri-logo';
import { AutoScrollRow } from '@/components/marketplace/auto-scroll-row';
import { apiClient } from '@/lib/api/client';
import { ComingSoonModal } from '@/components/ui/coming-soon-modal';

/* ── Scroll reveal ─────────────────────────────────── */
function useReveal() {
 useEffect(() => {
 const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
 const io = new IntersectionObserver(
 (entries) =>
 entries.forEach((e) => {
 if (!e.isIntersecting) return;
 const el = e.target as HTMLElement;
 const d = parseInt(el.dataset.delay ?? '0', 10);
 setTimeout(() => el.classList.add('vr-in'), d);
 io.unobserve(el);
 }),
 { threshold: 0.08 },
 );
 els.forEach((el) => io.observe(el));
 return () => io.disconnect();
 }, []);
}

/* ── Data ──────────────────────────────────────────── */
const NAV_LINKS = [
 ['Browse', ROUTES.listings],
 ['Vehicles', '/listings?listing_type=vehicle'],
 ['Property', '/listings?listing_type=property'],
 ['Electronics', '/listings?category=Electronics'],
 ['Fashion', '/listings?category=Fashion'],
 ['Plans', '/plans'],
] as const;

const STORAGE_KEY = 'velontri_homepage_sections';

function getSectionVisibility(): Record<string, boolean> {
 if (typeof window === 'undefined') return {};
 try {
 const stored = localStorage.getItem(STORAGE_KEY);
 if (stored) {
 const sections = JSON.parse(stored) as Array<{ id: string; enabled: boolean }>;
 const map: Record<string, boolean> = {};
 for (const s of sections) map[s.id] = s.enabled;
 return map;
 }
 } catch {}
 return {};
}


/* ── African locations ─────────────────────────────────── */
const AFRICA_LOCATIONS = [
 { label: '🌍 All Africa', value: '' },
  // Nigeria
 { label: '🇳🇬 Lagos', value: 'Lagos' },
 { label: '🇳🇬 Abuja', value: 'Abuja' },
 { label: '🇳🇬 Port Harcourt', value: 'Port Harcourt' },
 { label: '🇳🇬 Kano', value: 'Kano' },
 { label: '🇳🇬 Ibadan', value: 'Ibadan' },
 { label: '🇳🇬 Abeokuta', value: 'Abeokuta' },
 { label: '🇳🇬 Enugu', value: 'Enugu' },
 { label: '🇳🇬 Benin City', value: 'Benin City' },
 { label: '🇳🇬 Kaduna', value: 'Kaduna' },
 { label: '🇳🇬 Warri', value: 'Warri' },
  // Ghana
 { label: '🇬🇭 Accra', value: 'Accra' },
 { label: '🇬🇭 Kumasi', value: 'Kumasi' },
 { label: '🇬🇭 Tamale', value: 'Tamale' },
  // Kenya
 { label: '🇰🇪 Nairobi', value: 'Nairobi' },
 { label: '🇰🇪 Mombasa', value: 'Mombasa' },
 { label: '🇰🇪 Kisumu', value: 'Kisumu' },
  // South Africa
 { label: '🇿🇦 Johannesburg', value: 'Johannesburg' },
 { label: '🇿🇦 Cape Town', value: 'Cape Town' },
 { label: '🇿🇦 Durban', value: 'Durban' },
 { label: '🇿🇦 Pretoria', value: 'Pretoria' },
  // Tanzania
 { label: '🇹🇿 Dar es Salaam', value: 'Dar es Salaam' },
 { label: '🇹🇿 Dodoma', value: 'Dodoma' },
  // Uganda
 { label: '🇺🇬 Kampala', value: 'Kampala' },
  // Rwanda
 { label: '🇷🇼 Kigali', value: 'Kigali' },
  // Cameroon
 { label: '🇨🇲 Douala', value: 'Douala' },
 { label: '🇨🇲 Yaoundé', value: 'Yaoundé' },
  // Senegal
 { label: '🇸🇳 Dakar', value: 'Dakar' },
  // Côte d'Ivoire
 { label: '🇨🇮 Abidjan', value: 'Abidjan' },
  // Ethiopia
 { label: '🇪🇹 Addis Ababa', value: 'Addis Ababa' },
  // Egypt
 { label: '🇪🇬 Cairo', value: 'Cairo' },
 { label: '🇪🇬 Alexandria', value: 'Alexandria' },
  // Morocco
 { label: '🇲🇦 Casablanca', value: 'Casablanca' },
 { label: '🇲🇦 Rabat', value: 'Rabat' },
  // Angola
 { label: '🇦🇴 Luanda', value: 'Luanda' },
  // Zambia
 { label: '🇿🇲 Lusaka', value: 'Lusaka' },
  // Zimbabwe
 { label: '🇿🇼 Harare', value: 'Harare' },
] as const;
const REVIEWS = [
 {
 q: 'I listed my iPhone and got a WhatsApp message within 10 minutes. The buyer came, inspected it, and paid cash. Simple and fast.',
 name: 'Chukwuemeka Nwosu', role: 'Electronics Seller', city: 'Enugu, Nigeria',
 av: 'CN', grad: 'linear-gradient(135deg,#f43f5e,#e11d48)',
 metric: 'Sold in under 1 hour',
 },
 {
 q: 'I found a buyer for my car without any agent fee. Just posted it, shared my WhatsApp, and closed the deal myself. Velontri is the real deal.',
 name: 'Kwame Asante', role: 'Vehicle Seller', city: 'Kumasi, Ghana',
 av: 'KA', grad: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
 metric: 'Zero agent commission',
 },
 {
 q: 'I upgraded to the Starter plan and posted 15 more items. My store now gets buyers from across Nigeria every week.',
 name: 'Uchenna Obi', role: 'Fashion & Accessories', city: 'Abuja, Nigeria',
 av: 'UO', grad: 'linear-gradient(135deg,#10b981,#047857)',
 metric: '15 extra listings, more sales',
 },
];

/* ── Price formatter ───────────────────────────────── */
function fmtPrice(price: number, currency = 'NGN') {
 try {
 return new Intl.NumberFormat('en-NG', {
 style: 'currency', currency, maximumFractionDigits: 0,
 }).format(price);
 } catch {
 return `${currency} ${price.toLocaleString()}`;
 }
}

/* ── Listing card skeleton ─────────────────────────── */
function CardSkeleton() {
 return (
 <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white animate-pulse">
 <div className="aspect-card bg-slate-100" />
 <div className="p-4 space-y-2">
 <div className="h-3.5 w-3/4 rounded-lg bg-slate-100" />
 <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
 <div className="h-4 w-1/3 rounded-lg bg-slate-100" />
 </div>
 </div>
 );
}

/* ════════════════════════════════════════════════════
 COMPONENT
═══════════════════════════════════════════════════ */
export default function HomePage() {
 useReveal();
 const [query, setQuery] = useState('');
 const [cat, setCat] = useState('All');
 const [open, setOpen] = useState(false);
 const [appStore, setAppStore] = useState<'google' | 'apple' | null>(null);
 const [location, setLocation] = useState('');
 const [locOpen, setLocOpen] = useState(false);
 const [acOpen, setAcOpen] = useState(false);
 const [acSugg, setAcSugg] = useState<string[]>([]);
 const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const searchWrapRef = useRef<HTMLDivElement>(null);

  // Read homepage section visibility from admin settings
 const [sectionVis, setSectionVis] = useState<Record<string, boolean>>({});
 useEffect(() => {
 setSectionVis(getSectionVisibility());
 }, []);

  // Helper: is section visible (default true if not configured)
 const isVisible = (id: string) => sectionVis[id] !== false;

  /* Fetch ALL active listings — shown first on every visit, no auth needed */
 const { data: allData, isLoading: allLoading } = useQuery({
 queryKey: listingKeys.list({ page: 1, page_size: 12 }),
 queryFn: () => listingsApi.browse({ page: 1, page_size: 12 }),
 staleTime: 0,
 refetchOnWindowFocus: false,
 });

  /* Fetch real listings for each section — no stale time so they load fresh */
 const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
 queryKey: listingKeys.list({ listing_type: 'vehicle', page: 1, page_size: 8 }),
 queryFn: () => listingsApi.browse({ listing_type: 'vehicle', page: 1, page_size: 8 }),
 staleTime: 0,
 refetchOnWindowFocus: false,
 });

 const { data: electronicsData, isLoading: electronicsLoading } = useQuery({
 queryKey: listingKeys.list({ category: 'Electronics', page: 1, page_size: 8 }),
 queryFn: () => listingsApi.browse({ category: 'Electronics', page: 1, page_size: 8 }),
 staleTime: 0,
 refetchOnWindowFocus: false,
 });

 const { data: propertyData, isLoading: propertyLoading } = useQuery({
 queryKey: listingKeys.list({ listing_type: 'property', page: 1, page_size: 8 }),
 queryFn: () => listingsApi.browse({ listing_type: 'property', page: 1, page_size: 8 }),
 staleTime: 0,
 refetchOnWindowFocus: false,
 });

 const vehicles = Array.isArray(vehiclesData?.data) ? vehiclesData.data : [];
 const electronics = Array.isArray(electronicsData?.data) ? electronicsData.data : [];
 const properties = Array.isArray(propertyData?.data) ? propertyData.data : [];
 const allListings = Array.isArray(allData?.data) ? allData.data : [];

  /* close drawer on resize ≥ 768 px */
 useEffect(() => {
 const fn = () => { if (window.innerWidth >= 768) setOpen(false); };
 window.addEventListener('resize', fn);
 return () => window.removeEventListener('resize', fn);
 }, []);

  /* close location dropdown on outside click */
 useEffect(() => {
 if (!locOpen) return;
 const fn = (e: MouseEvent) => {
 const target = e.target as HTMLElement;
 if (!target.closest('[data-loc-picker]')) setLocOpen(false);
 };
 document.addEventListener('mousedown', fn);
 return () => document.removeEventListener('mousedown', fn);
 }, [locOpen]);

  /* close autocomplete on outside click */
 useEffect(() => {
 if (!acOpen) return;
 const fn = (e: MouseEvent) => {
 if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
 setAcOpen(false);
 }
 };
 document.addEventListener('mousedown', fn);
 return () => document.removeEventListener('mousedown', fn);
 }, [acOpen]);

  /* debounced autocomplete fetch */
 useEffect(() => {
 if (acTimer.current) clearTimeout(acTimer.current);
 const trimmed = query.trim();
 if (trimmed.length < 2) { setAcSugg([]); return; }
 acTimer.current = setTimeout(async () => {
 try {
 const res = await apiClient.get('/search/autocomplete', { params: { q: trimmed } });
 setAcSugg((res as any)?.data?.data?.suggestions ?? []);
 } catch { setAcSugg([]); }
 }, 280);
 return () => { if (acTimer.current) clearTimeout(acTimer.current); };
 }, [query]);

 return (
 <div className="min-h-screen overflow-x-hidden bg-[#F8F9FA] text-slate-900">

 {/* ══════════════════════════════════════════
 NAVBAR classic, polished
 ══════════════════════════════════════════ */}
 <header className="sticky top-0 z-50 bg-white/96 dark:bg-slate-950/96 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.07)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
 <div className="mx-auto flex h-[62px] max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-10">

          {/* Logo */}
 <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
 <VelontriLogo size={32} showWordmark wordmarkSize="md"
 wordmarkClassName="text-slate-900 dark:text-white font-black tracking-tight" />
 </Link>

          {/* Divider */}
 <div className="hidden md:block h-5 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

          {/* Desktop nav */}
 <nav className="hidden md:flex items-center gap-0" aria-label="Primary navigation">
 {NAV_LINKS.map(([l, h]) => (
 <Link key={l} href={h}
 className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 no-underline
 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white">
 {l}
 </Link>
 ))}
 </nav>

          {/* Spacer */}
 <div className="flex-1" />

          {/* Desktop actions */}
 <div className="hidden md:flex shrink-0 items-center gap-1.5">
 <ThemeToggle variant="icon" />
 <Link href={ROUTES.login}
 className="rounded-lg px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 no-underline
 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white">
 Sign in
 </Link>
            {/* Divider */}
 <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
 <Link href={ROUTES.register}
 className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white no-underline
 shadow-sm shadow-indigo-500/20 transition-all hover:bg-indigo-700 hover:shadow-indigo-500/30 hover:-translate-y-px active:translate-y-0">
 Get started
 </Link>
 </div>

          {/* Hamburger — mobile only */}
 <button
 onClick={() => setOpen((v) => !v)}
 aria-label={open ? 'Close menu' : 'Open menu'}
 aria-expanded={open}
 className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800
 transition-all duration-200 active:scale-95"
 >
 {open ? <X size={20} /> : <List size={20} />}
 </button>
 </div>

        {/* Mobile drawer */}
 <div
 className="md:hidden overflow-hidden transition-all duration-300"
 style={{
 maxHeight: open ? 500 : 0,
 transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
 }}
 >
 <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 pb-6 pt-3 space-y-0.5">
 {NAV_LINKS.map(([l, h]) => (
 <Link key={l} href={h} onClick={() => setOpen(false)}
 className="flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium
 text-slate-600 dark:text-slate-300 no-underline transition-colors
 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white">
 <CaretRight size={14} className="text-slate-300 dark:text-slate-600" />
 {l}
 </Link>
 ))}
 <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
 <div className="flex items-center justify-between px-4 py-2.5 mb-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
 <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Appearance</span>
 <ThemeToggle variant="switch" />
 </div>
 <div className="flex gap-2">
 <Link href={ROUTES.login} onClick={() => setOpen(false)}
 className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-3 text-center
 text-[13px] font-semibold text-slate-700 dark:text-slate-200 no-underline
 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
 Sign in
 </Link>
 <Link href={ROUTES.register} onClick={() => setOpen(false)}
 className="flex-1 rounded-xl bg-indigo-600 py-3 text-center
 text-[13px] font-bold text-white no-underline transition-colors hover:bg-indigo-700">
 Get started
 </Link>
 </div>
 </div>
 </div>
 </div>
 </header>

 {/* ══════════════════════════════════════════
 HERO
 ══════════════════════════════════════════ */}
 <section className="border-b border-slate-200 bg-white">
 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
 <div className="grid grid-cols-1 items-start gap-10 py-12 lg:grid-cols-2 lg:gap-14 lg:py-0">

            {/* LEFT */}
 <div className="lg:py-16">
 <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5">
 <TrendUp size={11} className="text-indigo-600" />
 <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
 Africa&apos;s #1 Marketplace
 </span>
 </div>

 <h1 className="mb-4 font-black leading-[1.03] text-slate-900"
 style={{ fontSize: 'clamp(2rem,4.5vw,3.75rem)', letterSpacing: '-0.04em' }}>
 The Definitive<br />
 <span className="text-indigo-600">Marketplace.</span>
 </h1>

 <p className="mb-7 max-w-md leading-relaxed text-slate-500"
 style={{ fontSize: 'clamp(14px,1.5vw,16px)' }}>
 Property · Vehicles · Electronics · Fashion · Jobs · Services.<br className="hidden sm:block" />
 Millions of premium listings. 12 African countries.
 </p>

              {/* Search bar */}
 <div ref={searchWrapRef} className="mb-4 relative">
 <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-slate-200
 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.07)] transition-colors focus-within:border-indigo-400">

                  {/* Location selector */}
 <div className="relative hidden sm:flex" data-loc-picker>
 <button
 type="button"
 onClick={() => setLocOpen(v => !v)}
 className="flex items-center gap-1.5 border-r border-slate-200 px-3.5
 text-slate-500 hover:bg-slate-50 transition-colors whitespace-nowrap text-[12px]
 min-w-[110px] max-w-[140px] truncate"
 >
 <MapPin size={13} className="flex-shrink-0 text-indigo-500" />
 <span className="truncate">{location || 'All Africa'}</span>
 <CaretDown size={12} className="flex-shrink-0 text-slate-300 ml-auto" />
 </button>
 {locOpen && (
 <div className="absolute left-0 top-full z-50 mt-1 w-56 max-h-72 overflow-y-auto
 rounded-xl border border-slate-200 bg-white shadow-xl"
 style={{ scrollbarWidth: 'thin' }}>
 {AFRICA_LOCATIONS.map(loc => (
 <button key={loc.value} type="button"
 onClick={() => { setLocation(loc.value); setLocOpen(false); }}
 className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors
 hover:bg-indigo-50 hover:text-indigo-700
 ${location === loc.value ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-700'}`}>
 {loc.label}
 </button>
 ))}
 </div>
 )}
 </div>

 <input
 type="text"
 value={query}
 onChange={e => { setQuery(e.target.value); setAcOpen(true); }}
 onFocus={() => { if (query.trim().length >= 2) setAcOpen(true); }}
 onKeyDown={e => {
 if (e.key === 'Enter' && query.trim()) {
 setAcOpen(false);
 const loc = location ? `&city=${encodeURIComponent(location)}` : '';
 window.location.href = `/search?q=${encodeURIComponent(query.trim())}${loc}`;
 }
 if (e.key === 'Escape') setAcOpen(false);
 }}
 placeholder="Search cars, phones, properties, jobs…"
 className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-[14px] text-slate-800
 placeholder-slate-400 outline-none"
 />
 <Link
 href={
 query.trim()
 ? `/search?q=${encodeURIComponent(query.trim())}${location ? `&city=${encodeURIComponent(location)}` : ''}`
 : `${ROUTES.search}${location ? `?city=${encodeURIComponent(location)}` : ''}`
 }
 onClick={() => setAcOpen(false)}
 className="m-1.5 flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600
 px-4 text-[13px] font-bold text-white no-underline transition-colors hover:bg-indigo-700">
 <MagnifyingGlass size={13} />
 <span className="hidden sm:inline">Search</span>
 </Link>
 </div>

                {/* Autocomplete dropdown */}
 {acOpen && acSugg.length > 0 && (
 <div className="absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden rounded-2xl
 border border-slate-200 bg-white shadow-xl">
 {acSugg.slice(0, 8).map(s => (
 <button key={s}
 onMouseDown={e => e.preventDefault()} // prevent input blur before click
 onClick={() => {
 setQuery(s);
 setAcOpen(false);
 const loc = location ? `&city=${encodeURIComponent(location)}` : '';
 window.location.href = `/search?q=${encodeURIComponent(s)}${loc}`;
 }}
 className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px]
 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
 <MagnifyingGlass className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
 <span dangerouslySetInnerHTML={{
 __html: s.replace(
 new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
 '<strong>$1</strong>'
 )
 }} />
 </button>
 ))}
 </div>
 )}
 </div>

              {/* Category pills — navigate to filtered listings */}
 <div className="mb-8 flex flex-wrap gap-2">
 {([
 { label: 'All', href: '/listings', Icon: ShoppingBag },
 { label: 'Vehicles', href: '/listings?listing_type=vehicle', Icon: Car },
 { label: 'Property', href: '/listings?listing_type=property', Icon: House },
 { label: 'Electronics', href: '/listings?category=Electronics', Icon: DeviceMobile },
 { label: 'Fashion', href: '/listings?category=Fashion', Icon: TShirt },
 { label: 'Jobs', href: '/listings?listing_type=job', Icon: Briefcase },
 { label: 'Services', href: '/listings?listing_type=service', Icon: Wrench },
 ] as const).map(({ label, href, Icon }) => (
 <Link
 key={label}
 href={href}
 className="flex items-center gap-1.5 cursor-pointer rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all no-underline
 border-slate-200 bg-white text-slate-600
 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700
 active:scale-[0.97]">
 <Icon className="h-3.5 w-3.5 flex-shrink-0" />
 {label}
 </Link>
 ))}
 </div>

              {/* Stats */}
 <div className="border-t border-slate-100 pt-5 mt-2">
                {/* Mobile: 2×2 stat grid — clean text, no emoji */}
 <div className="grid grid-cols-2 gap-3 sm:hidden">
 {[
 { v: 'Growing', l: 'Community', accent: '#4F46E5' },
 { v: '12', l: 'Countries', accent: '#059669' },
 { v: 'Free', l: 'To list', accent: '#0369A1' },
 { v: '0%', l: 'Commissions', accent: '#D97706' },
 ].map(({ v, l, accent }) => (
 <div key={l} className="rounded-xl border border-slate-100 bg-slate-50 py-4 px-3">
 <p className="font-black leading-none"
 style={{ fontSize: '1.5rem', letterSpacing: '-0.03em', color: accent }}>
 {v}
 </p>
 <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-1">{l}</p>
 </div>
 ))}
 </div>

                {/* Desktop: horizontal bar with dividers */}
 <div className="hidden sm:grid grid-cols-4 gap-0">
 {[
 { v: 'Early', l: 'Join now free', accent: '#4F46E5' },
 { v: '12', l: 'Countries', accent: '#059669' },
 { v: 'Free', l: 'To list', accent: '#0369A1' },
 { v: '100%', l: 'No commissions', accent: '#D97706' },
 ].map(({ v, l, accent }, i) => (
 <div key={l}
 className={`flex flex-col gap-1.5 py-4 ${i > 0 ? 'pl-5 border-l border-slate-100' : ''}`}>
 <p className="font-black leading-none"
 style={{ fontSize: 'clamp(1.25rem,2.2vw,1.6rem)', letterSpacing: '-0.03em', color: accent }}>
 {v}
 </p>
 <p className="text-[12px] font-medium text-slate-400 uppercase tracking-[0.06em]">{l}</p>
 </div>
 ))}
 </div>
 </div>
 </div>

            {/* RIGHT — masonry collage, desktop only */}
 <div
 className="hidden lg:grid grid-cols-2 gap-2.5"
 style={{ gridTemplateRows: '200px 200px 140px', minHeight: 560 }}
 >
 <div className="row-span-2 relative overflow-hidden rounded-2xl bg-slate-100">
 <img src="https://images.unsplash.com/photo-1612825173281-9a193378527e?w=600&q=88&fit=crop"
 alt="" fetchPriority="high"
 className="absolute inset-0 h-full w-full object-cover" />
 <div className="absolute bottom-3 left-3 rounded-lg bg-black/65 px-2.5 py-1.5 backdrop-blur-sm">
 <p className="text-[11px] font-bold text-white">Premium Vehicles</p>
 </div>
 </div>
 <div className="relative overflow-hidden rounded-2xl bg-slate-100">
 <img src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=88&fit=crop"
 alt="" className="absolute inset-0 h-full w-full object-cover" />
 <div className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-1 backdrop-blur-sm">
 <p className="text-[10px] font-bold text-white">Electronics</p>
 </div>
 </div>
 <div className="relative overflow-hidden rounded-2xl bg-slate-100">
 <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&q=88&fit=crop"
 alt="" className="absolute inset-0 h-full w-full object-cover" />
 <div className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-1 backdrop-blur-sm">
 <p className="text-[10px] font-bold text-white">Properties</p>
 </div>
 </div>
 <div className="relative overflow-hidden rounded-2xl bg-slate-100">
 <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=88&fit=crop"
 alt="" className="absolute inset-0 h-full w-full object-cover" />
 </div>
 <div className="relative overflow-hidden rounded-2xl bg-slate-100">
 <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=88&fit=crop"
 alt="" className="absolute inset-0 h-full w-full object-cover" />
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* ══════════════════════════════════════════
 LATEST LISTINGS all active, shown first on every visit
 ══════════════════════════════════════════ */}
 <section className="border-b border-slate-200 bg-white py-12 sm:py-16">
 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
 <div className="mb-7 flex items-end justify-between">
 <div>
 <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
 <TrendUp size={11} className="text-indigo-600" />
 {allLoading ? 'Loading…' : `${allData?.meta?.total ?? allListings.length} Active Listings`}
 </div>
 <h2 className="font-black leading-tight text-slate-900"
 style={{ fontSize: 'clamp(1.4rem,2.5vw,2rem)', letterSpacing: '-0.03em' }}>
 Latest Listings
 </h2>
 </div>
 <Link href={ROUTES.listings}
 className="flex items-center gap-1 text-[13px] font-semibold text-indigo-600
 no-underline transition-all hover:gap-2">
 Browse all <CaretRight size={14} />
 </Link>
 </div>

 {allLoading ? (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
 {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
 </div>
 ) : allListings.length === 0 ? (
 <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
 <p className="text-[15px] font-semibold text-slate-400 mb-3">No listings yet be the first!</p>
 <Link href={ROUTES.register}
 className="inline-flex items-center gap-2 h-10 rounded-xl bg-indigo-600 px-6
 text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
 Post a listing free
 </Link>
 </div>
 ) : (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
 {allListings.map((listing) => {
 const typeEmoji: Record<string, string> = {
 vehicle: '🚗', property: '🏠', electronics: '📱',
 fashion: '👗', job: '💼', service: '🔧', physical: '📦',
 };
 const emoji = typeEmoji[listing.listing_type?.toLowerCase() ?? ''] ?? '📦';
 return (
 <Link
 key={listing.id}
 href={`/listings/${listing.id}`}
 className="group block overflow-hidden rounded-2xl border border-slate-200
 bg-white shadow-sm no-underline transition-all duration-200
 hover:-translate-y-1 hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.13)]"
 >
                    {/* Image */}
 <div className="relative overflow-hidden bg-slate-100" style={{ aspectRatio: '4/3' }}>
 {listing.image_url ? (
 <img
 src={listing.image_url}
 alt={listing.title}
 className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
 loading="lazy"
 />
 ) : (
 <div className="flex h-full w-full items-center justify-center bg-slate-50">
 <span className="text-5xl select-none">{emoji}</span>
 </div>
 )}
 {listing.condition && (
 <span className="absolute top-2 left-2 rounded-full bg-indigo-600 px-2.5 py-1
 text-[9px] font-black uppercase tracking-wide text-white z-10 capitalize">
 {listing.condition === 'new' ? 'Brand New' : listing.condition}
 </span>
 )}
 </div>

                    {/* Body */}
 <div className="p-3.5">
 <p className="text-[13px] font-bold leading-snug text-slate-900 line-clamp-2 mb-2 min-h-[2.4rem]">
 {listing.title}
 </p>
 <div className="flex items-center justify-between">
 <p className="text-[15px] font-black tracking-tight text-indigo-600">
 {fmtPrice(listing.price, listing.currency)}
 </p>
 {listing.city && (
 <span className="flex items-center gap-1 text-[10px] text-slate-400">
 <MapPin size={9} />{listing.city}
 </span>
 )}
 </div>
 {listing.category && (
 <p className="mt-1.5 text-[10px] font-semibold text-slate-400 capitalize">
 {listing.listing_type ?? listing.category}
 </p>
 )}
 </div>
 </Link>
 );
 })}
 </div>
 )}

          {/* "See all" link if there are more */}
 {!allLoading && (allData?.meta?.total ?? 0) > 12 && (
 <div className="mt-8 text-center">
 <Link href={ROUTES.listings}
 className="inline-flex items-center gap-2 h-11 rounded-xl border-2 border-indigo-200
 bg-indigo-50 px-8 text-[14px] font-bold text-indigo-600 no-underline
 hover:bg-indigo-100 hover:border-indigo-300 transition-all">
 View all {allData?.meta?.total?.toLocaleString()} listings <CaretRight size={16} />
 </Link>
 </div>
 )}
 </div>
 </section>

 {/* ══════════════════════════════════════════
 VEHICLES real API data
 ══════════════════════════════════════════ */}
 {isVisible('vehicles') && (
 <section className="border-b border-slate-200 bg-[#F8F9FA] py-12 sm:py-16">
 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

 <div data-reveal data-delay="0"
 className="vr-out mb-7 flex items-end justify-between">
 <div>
 <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
 <Lightning size={11} className="text-indigo-600" />
 {vehiclesLoading ? 'Loading…' : `${vehiclesData?.meta?.total ?? vehicles.length} Listings`}
 </div>
 <h2 className="font-black leading-tight text-slate-900"
 style={{ fontSize: 'clamp(1.4rem,2.5vw,2rem)', letterSpacing: '-0.03em' }}>
 Vehicles
 </h2>
 </div>
 <Link href="/listings?listing_type=vehicle"
 className="flex items-center gap-1 text-[13px] font-semibold text-indigo-600
 no-underline transition-all hover:gap-2">
 Browse all <CaretRight size={14} />
 </Link>
 </div>

 {vehiclesLoading ? (
 <div className="flex gap-4 overflow-hidden">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="flex-shrink-0 w-64"><CardSkeleton /></div>
 ))}
 </div>
 ) : vehicles.length === 0 ? (
 <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
 <p className="text-[14px] font-semibold text-slate-400">No vehicle listings yet.</p>
 <Link href={ROUTES.register}
 className="mt-3 inline-block text-[13px] font-bold text-indigo-600 no-underline hover:underline">
 Post the first one →
 </Link>
 </div>
 ) : (
 <AutoScrollRow speed={50}>
 {vehicles.map((car) => (
 <Link
 key={car.id}
 href={`/listings/${car.id}`}
 className="flex-shrink-0 w-[260px] block cursor-pointer overflow-hidden rounded-2xl
 border border-slate-200 bg-white transition-all duration-200
 hover:-translate-y-1 no-underline
 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.14)]">
 <div className="relative">
 <ListingImage src={car.image_url} alt={car.title} type="vehicle" ratio="4/3" />
 <span className="absolute left-2.5 top-2.5 rounded-full bg-indigo-600 px-2.5 py-1
 text-[10px] font-black uppercase tracking-wide text-white capitalize z-10">
 {car.condition ?? 'Used'}
 </span>
 </div>
 <div className="p-4">
 <p className="mb-1.5 text-[13px] font-bold leading-tight text-slate-900 line-clamp-2 min-h-[2.5rem]">{car.title}</p>
 <div className="mb-3 flex items-center justify-between">
 <span className="text-[16px] font-black tracking-tight text-slate-900">
 {fmtPrice(car.price, car.currency)}
 </span>
 {car.city && (
 <span className="flex items-center gap-1 text-[11px] text-slate-400">
 <MapPin size={10} />{car.city}
 </span>
 )}
 </div>
 <div className="block w-full rounded-lg bg-indigo-50 py-2.5 text-center
 text-[12px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100">
 View Details →
 </div>
 </div>
 </Link>
 ))}
 </AutoScrollRow>
 )}
 </div>
 </section>
      )} {/* end vehicles */}

 {/* ══════════════════════════════════════════
 ELECTRONICS real API data
 ══════════════════════════════════════════ */}
 {isVisible('electronics') && (
 <section className="border-b border-slate-200 bg-white py-12 sm:py-16">
 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

 <div data-reveal data-delay="0"
 className="vr-out mb-7 flex items-end justify-between">
 <div>
 <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
 <Sparkle size={11} className="text-violet-600" />
 {electronicsLoading ? 'Loading…' : `${electronicsData?.meta?.total ?? electronics.length} Listings`}
 </div>
 <h2 className="font-black leading-tight text-slate-900"
 style={{ fontSize: 'clamp(1.4rem,2.5vw,2rem)', letterSpacing: '-0.03em' }}>
 Electronics &amp; Tech
 </h2>
 </div>
 <Link href="/listings?category=Electronics"
 className="flex items-center gap-1 text-[13px] font-semibold text-violet-600
 no-underline transition-all hover:gap-2">
 Browse all <CaretRight size={14} />
 </Link>
 </div>

 {electronicsLoading ? (
 <div className="flex gap-4 overflow-hidden">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="flex-shrink-0 w-64"><CardSkeleton /></div>
 ))}
 </div>
 ) : electronics.length === 0 ? (
 <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
 <p className="text-[14px] font-semibold text-slate-400">No electronics listings yet.</p>
 <Link href={ROUTES.register}
 className="mt-3 inline-block text-[13px] font-bold text-violet-600 no-underline hover:underline">
 Post the first one →
 </Link>
 </div>
 ) : (
 <AutoScrollRow speed={38}>
 {electronics.map((item) => (
 <Link
 key={item.id}
 href={`/listings/${item.id}`}
 className="flex-shrink-0 w-[240px] block cursor-pointer overflow-hidden rounded-2xl
 border border-slate-200 bg-slate-50 transition-all duration-200
 hover:-translate-y-1 hover:shadow-md no-underline">
 <ListingImage src={item.image_url} alt={item.title} category="Electronics" ratio="4/3" />
 <div className="border-t border-slate-100 bg-white p-4">
 <p className="mb-1 text-[13px] font-bold leading-tight text-slate-900 line-clamp-2 min-h-[2.5rem]">{item.title}</p>
 <div className="flex items-center justify-between mt-2">
 <span className="text-[15px] font-black tracking-tight text-slate-900">
 {fmtPrice(item.price, item.currency)}
 </span>
 {item.city && (
 <span className="flex items-center gap-1 text-[11px] text-slate-400">
 <MapPin size={9} />{item.city}
 </span>
 )}
 </div>
 </div>
 </Link>
 ))}
 </AutoScrollRow>
 )}
 </div>
 </section>
      )} {/* end electronics */}

 {/* ══════════════════════════════════════════
 PROPERTY real API data
 ══════════════════════════════════════════ */}
 {isVisible('property') && (
 <section className="border-b border-slate-200 bg-[#F8F9FA] py-12 sm:py-16">
 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

 <div data-reveal data-delay="0"
 className="vr-out mb-7 flex items-end justify-between">
 <div>
 <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
 <Shield size={11} className="text-sky-600" />
 {propertyLoading ? 'Loading…' : `${propertyData?.meta?.total ?? properties.length} Listings`}
 </div>
 <h2 className="font-black leading-tight text-slate-900"
 style={{ fontSize: 'clamp(1.4rem,2.5vw,2rem)', letterSpacing: '-0.03em' }}>
 Real Estate &amp; Property
 </h2>
 </div>
 <Link href="/listings?listing_type=property"
 className="flex items-center gap-1 text-[13px] font-semibold text-sky-600
 no-underline transition-all hover:gap-2">
 Browse all <CaretRight size={14} />
 </Link>
 </div>

 {propertyLoading ? (
 <div className="flex gap-4 overflow-hidden">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="flex-shrink-0 w-72"><CardSkeleton /></div>
 ))}
 </div>
 ) : properties.length === 0 ? (
 <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
 <p className="text-[14px] font-semibold text-slate-400">No property listings yet.</p>
 <Link href={ROUTES.register}
 className="mt-3 inline-block text-[13px] font-bold text-sky-600 no-underline hover:underline">
 Post the first one →
 </Link>
 </div>
 ) : (
 <AutoScrollRow speed={32}>
 {properties.map((p) => (
 <Link
 key={p.id}
 href={`/listings/${p.id}`}
 className="flex-shrink-0 w-[280px] block cursor-pointer overflow-hidden rounded-2xl
 border border-slate-200 bg-white transition-all duration-200
 hover:-translate-y-1 hover:shadow-md no-underline">
 <ListingImage src={p.image_url} alt={p.title} type="property" ratio="4/3" />
 <div className="p-4">
 <p className="mb-1.5 text-[13px] font-bold leading-tight text-slate-900 line-clamp-2 min-h-[2.5rem]">{p.title}</p>
 {p.city && (
 <p className="mb-2 flex items-center gap-1 text-[11px] text-slate-400">
 <MapPin size={10} />{p.city}
 </p>
 )}
 <p className="text-[17px] font-black tracking-tight text-slate-900">
 {fmtPrice(p.price, p.currency)}
 </p>
 </div>
 </Link>
 ))}
 </AutoScrollRow>
 )}
 </div>
 </section>
      )} {/* end property */}

 {/* ══════════════════════════════════════════
 TESTIMONIALS static marketing copy
 ══════════════════════════════════════════ */}
 <section className="py-14 sm:py-20 bg-slate-900">
 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
 <div className="mb-12 text-center">
 <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-400">
 Success stories
 </p>
 <h2 className="font-black text-white"
 style={{ fontSize: 'clamp(1.6rem,2.8vw,2.25rem)', letterSpacing: '-0.03em' }}>
 Trusted by sellers across Africa
 </h2>
 </div>
 <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
 {REVIEWS.map(({ q, name, role, city, av, grad, metric }, i) => (
 <div key={name} data-reveal data-delay={String(i * 80)}
 className="vr-out flex flex-col gap-4 rounded-2xl p-6"
 style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.07)' }}>
 <div className="flex gap-0.5">
 {[1,2,3,4,5].map(s => (
 <Star key={s} size={13} className="fill-amber-400 text-amber-400" />
 ))}
 </div>
 <p className="flex-1 text-[14px] leading-relaxed text-slate-300">
 &ldquo;{q}&rdquo;
 </p>
 <p className="text-[11px] font-semibold text-indigo-400">{metric}</p>
 <div className="flex items-center gap-3 border-t border-white/10 pt-4">
 <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
 style={{ background: grad }}>
 {av}
 </div>
 <div>
 <p className="text-[13px] font-bold text-white">{name}</p>
 <p className="text-[11px] text-slate-500">{role} · {city}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ══════════════════════════════════════════
 WHY VELONTRI
 ══════════════════════════════════════════ */}
 <section className="border-b border-slate-200 bg-white py-14 sm:py-20">
 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
 <div className="mb-12 text-center">
 <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Why Velontri</p>
 <h2 className="font-black text-slate-900"
 style={{ fontSize: 'clamp(1.6rem,2.8vw,2.25rem)', letterSpacing: '-0.03em' }}>
 Built for Africa. Built for everyone.
 </h2>
 </div>
 <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
 {[
 {
 stat: 'Instant',
 label: 'WhatsApp contact',
 desc: 'Every listing has a WhatsApp button. One tap connects you directly with the seller.',
 },
 {
 stat: '12',
 label: 'African countries',
 desc: 'One account. Reach buyers in Nigeria, Ghana, Kenya, South Africa and 8 more markets.',
 },
 {
 stat: 'Free',
 label: 'To start selling',
 desc: 'Post up to 3 listings free. Upgrade for more. No commissions on your sales.',
 },
 {
 stat: 'Verified',
 label: 'Seller badges',
 desc: 'Sellers can verify their identity. Buyers see who they are dealing with before buying.',
 },
 ].map(({ stat, label, desc }) => (
 <div key={label} className="rounded-2xl border border-slate-100 bg-[#F8F9FA] p-6 space-y-3">
 <p className="text-[2.25rem] font-black text-slate-900 leading-none tracking-tight">{stat}</p>
 <p className="text-[13px] font-bold text-slate-700">{label}</p>
 <p className="text-[13px] text-slate-500 leading-relaxed">{desc}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ══════════════════════════════════════════
 SELLER CTA
 ══════════════════════════════════════════ */}
 <section className="relative overflow-hidden" style={{ minHeight: 460 }}>
 <img
 src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=88&fit=crop&crop=center"
 alt="" loading="lazy"
 className="absolute inset-0 h-full w-full object-cover object-center"
 style={{ filter: 'brightness(0.28) saturate(1.2)' }}
 />
 <div className="absolute inset-0"
 style={{ background: 'linear-gradient(100deg, rgba(20,18,62,0.96) 0%, rgba(49,46,129,0.80) 40%, rgba(79,70,229,0.45) 65%, rgba(0,0,0,0.25) 100%)' }} />
 <div className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
 <div className="max-w-xl">
 <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15
 bg-white/8 px-4 py-1.5 backdrop-blur-sm">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
 <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">For sellers</span>
 </div>
 <h2 className="mb-5 font-black leading-[1.04] text-white"
 style={{ fontSize: 'clamp(2rem,3.5vw,3.25rem)', letterSpacing: '-0.035em' }}>
 Grow your business<br />across Africa
 </h2>
 <p className="mb-8 leading-relaxed text-white/60"
 style={{ fontSize: 'clamp(15px,1.5vw,17px)', maxWidth: 420 }}>
 Join early and grow with us reaching buyers across 12 countries.
 Free to list. Chat buyers on WhatsApp instantly. Subscription plans that scale with you.
 </p>
 <div className="mb-8 flex flex-wrap gap-6">
 {[['Early','Access'],['12','Countries'],['Free','To list'],['WhatsApp','Direct contact']].map(([v, l]) => (
 <div key={l}>
 <p className="text-[1.25rem] font-black text-white leading-none"
 style={{ letterSpacing: '-0.02em' }}>{v}</p>
 <p className="text-[11px] text-white/45 mt-0.5">{l}</p>
 </div>
 ))}
 </div>
 <div className="flex flex-wrap gap-3">
 <Link href={ROUTES.register}
 className="inline-flex h-12 items-center rounded-xl bg-white px-7 text-[14px]
 font-black text-indigo-700 no-underline shadow-xl
 transition-all hover:bg-white/92 hover:shadow-2xl active:scale-[0.99]">
 Post a listing free
 </Link>
 <Link href="/plans"
 className="inline-flex h-12 items-center rounded-xl border border-white/25
 bg-white/10 px-7 text-[14px] font-semibold text-white no-underline
 backdrop-blur-sm transition-all hover:bg-white/18">
 View plans →
 </Link>
 </div>
 </div>
 </div>
 </section>

 {/* ══════════════════════════════════════════
 FOOTER
 ══════════════════════════════════════════ */}
 <footer className="relative overflow-hidden border-t border-slate-800/60">
        {/* World map background image */}
 <div className="pointer-events-none absolute inset-0" aria-hidden>
 <img
 src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=1920&q=85&fit=crop&crop=center"
 alt=""
 className="h-full w-full object-cover object-center"
 style={{ filter: 'brightness(0.15) saturate(0.5) sepia(0.3)' }}
 loading="lazy"
 />
          {/* Dark overlay so text stays readable */}
 <div className="absolute inset-0"
 style={{ background: 'linear-gradient(180deg, rgba(10,15,30,0.75) 0%, rgba(10,15,30,0.88) 60%, rgba(10,15,30,0.97) 100%)' }} />
          {/* Subtle indigo glow at center */}
 <div className="absolute inset-0 opacity-20"
 style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(79,70,229,0.4) 0%, transparent 70%)' }} />
 </div>
 <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

          {/* Top row — logo + tagline + CTA */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 pb-8 border-b border-slate-800/60">
 <div>
 <Link href="/" className="inline-flex items-center gap-2 no-underline mb-2">
 <VelontriLogo size={28} showWordmark wordmarkSize="md"
 wordmarkClassName="text-white" />
 </Link>
 <p className="text-[12px] text-slate-500 max-w-xs leading-relaxed">
 Africa's marketplace WhatsApp contact, no commissions, 12 countries.
 </p>
 </div>
 <div className="flex flex-wrap gap-2 flex-shrink-0">
 <Link href={ROUTES.register}
 className="h-9 rounded-xl bg-indigo-600 px-4 text-[12px] font-bold text-white
 no-underline hover:bg-indigo-700 transition-colors flex items-center">
 Post a listing free
 </Link>
 <Link href="/plans"
 className="h-9 rounded-xl border border-slate-700 px-4 text-[12px] font-semibold
 text-slate-400 no-underline hover:border-slate-500 hover:text-white
 transition-colors flex items-center">
 View plans
 </Link>
 </div>
 </div>

          {/* Link columns */}
 <div className="grid grid-cols-3 gap-6 py-8 border-b border-slate-800/60">
 <div>
 <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Marketplace</p>
 <ul className="space-y-2">
 {[
 ['Browse listings', ROUTES.listings],
 ['Vehicles', '/listings?listing_type=vehicle'],
 ['Property', '/listings?listing_type=property'],
 ['Electronics', '/listings?category=Electronics'],
 ['Fashion', '/listings?category=Fashion'],
 ].map(([l, h]) => (
 <li key={l}>
 <Link href={h}
 className="text-[12px] text-slate-500 no-underline hover:text-white transition-colors">
 {l}
 </Link>
 </li>
 ))}
 </ul>
 </div>
 <div>
 <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Sellers</p>
 <ul className="space-y-2">
 {[
 ['Post a listing', ROUTES.register],
 ['Dashboard', ROUTES.user.overview],
 ['Subscription plans','/plans'],
 ].map(([l, h]) => (
 <li key={l}>
 <Link href={h}
 className="text-[12px] text-slate-500 no-underline hover:text-white transition-colors">
 {l}
 </Link>
 </li>
 ))}
 </ul>
 </div>
 <div>
 <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Company</p>
 <ul className="space-y-2">
 {[
 ['About', '#'],
 ['Privacy', '#'],
 ['Terms', '#'],
 ].map(([l, h]) => (
 <li key={l}>
 <Link href={h}
 className="text-[12px] text-slate-500 no-underline hover:text-white transition-colors">
 {l}
 </Link>
 </li>
 ))}
 </ul>
 </div>
 </div>

          {/* App store buttons */}
 <div className="py-7 border-b border-slate-800/60">
 <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Get the app</p>
 <div className="flex flex-wrap gap-3">
              {/* Google Play */}
 <button
 onClick={() => setAppStore('google')}
 className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50
 px-4 py-2.5 transition-all hover:border-slate-500 hover:bg-slate-700/50
 hover:-translate-y-0.5 active:scale-95"
 >
 <svg viewBox="0 0 24 24" className="h-6 w-6 flex-shrink-0" fill="none">
 <path d="M3.18 23.76c.3.17.64.24.99.18l11.65-11.94L12.1 9.18 3.18 23.76z" fill="#EA4335"/>
 <path d="M20.57 10.31l-2.8-1.6-3.32 3.29 3.32 3.3 2.82-1.62a1.96 1.96 0 000-3.37z" fill="#FBBC04"/>
 <path d="M2.4.41a1.96 1.96 0 00-.4 1.22v20.74c0 .45.14.86.4 1.21l.07.07 11.62-11.62v-.28L2.47.34 2.4.41z" fill="#4285F4"/>
 <path d="M16.82 15.72L4.16 23.94c-.33.2-.68.26-1 .19l11.66-11.94 2 1.53z" fill="#34A853"/>
 </svg>
 <div className="text-left">
 <p className="text-[9px] text-slate-500 leading-none uppercase tracking-wide">Get it on</p>
 <p className="text-[13px] font-bold text-white leading-tight">Google Play</p>
 </div>
 </button>

              {/* App Store */}
 <button
 onClick={() => setAppStore('apple')}
 className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50
 px-4 py-2.5 transition-all hover:border-slate-500 hover:bg-slate-700/50
 hover:-translate-y-0.5 active:scale-95"
 >
 <svg viewBox="0 0 24 24" className="h-6 w-6 flex-shrink-0 fill-white">
 <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
 </svg>
 <div className="text-left">
 <p className="text-[9px] text-slate-500 leading-none uppercase tracking-wide">Download on the</p>
 <p className="text-[13px] font-bold text-white leading-tight">App Store</p>
 </div>
 </button>
 </div>
 </div>

          {/* Bottom bar */}
          {/* Desktop: copyright left | status centre-right | monogram far right */}
          {/* Mobile: copyright → status → monogram (stacked, monogram last) */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6
 text-[11px] text-slate-600">

            {/* Copyright */}
 <p className="order-1 sm:order-1">
 © {new Date().getFullYear()} Velontri Technologies Ltd. All rights reserved.
 </p>

            {/* Status */}
 <div className="order-2 sm:order-2 flex items-center gap-1.5">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
 <span>All systems operational · 🌍 12 countries</span>
 </div>

            {/* Gold monogram — desktop: far right | mobile: last item, centered */}
 <div className="order-3 sm:order-3 flex items-center justify-center sm:justify-end gap-2 opacity-30">
              {/* Circle with gold gradient border + M inside */}
 <div
 className="flex-shrink-0 flex items-center justify-center rounded-full"
 style={{
 width: 28,
 height: 28,
 background: 'linear-gradient(135deg, #c9a84c 0%, #f5d98b 40%, #b8860b 70%, #e4b84d 100%)',
 padding: 1.5,
 }}
 >
 <div className="w-full h-full rounded-full bg-[#0a0f1e] flex items-center justify-center">
 <span
 style={{
 fontFamily: 'Georgia, "Times New Roman", serif',
 fontSize: 13,
 fontWeight: 700,
 fontStyle: 'italic',
 background: 'linear-gradient(135deg, #c9a84c 0%, #f5d98b 45%, #e4b84d 100%)',
 WebkitBackgroundClip: 'text',
 WebkitTextFillColor: 'transparent',
 backgroundClip: 'text',
 letterSpacing: '-0.03em',
 lineHeight: 1,
 }}
 >
 M
 </span>
 </div>
 </div>
 <span className="text-[10px] tracking-wide" style={{ color: '#7a6030' }}>
 crafted by Mojolaoluwa....
 </span>
 </div>
 </div>
 </div>
 </footer>
 <ComingSoonModal store={appStore} onClose={() => setAppStore(null)} />
 </div>
 );
}