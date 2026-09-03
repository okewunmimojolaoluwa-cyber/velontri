'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, ChatCircle, Heart, ShoppingBag, Storefront, Package, ArrowRight, Star, Sparkle, CaretRight, ChartBar, Gear, CreditCard, ShareNetwork, Copy, Check, WhatsappLogo, TwitterLogo, TelegramLogo, FacebookLogo, LinkedinLogo } from '@phosphor-icons/react';
import {
 AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/features/auth/auth-provider';
import { sellerApi } from '@/lib/api/endpoints/seller';
import { usersApi, userKeys } from '@/lib/api/endpoints/users';
import { ROUTES } from '@/config/routes';

/* ── Helpers ─────────────────────────────────────────────── */
const SPARKLINE = Array.from({ length: 7 }, (_, i) => ({
 d: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
 v: 0,
}));

function getGreeting() {
 const h = new Date().getHours();
 if (h < 12) return 'Good morning';
 if (h < 17) return 'Good afternoon';
 return 'Good evening';
}

/* ── Page ─────────────────────────────────────────────────── */
export default function DashboardPage() {
 const { session } = useAuth();
 const uid = session.userId;
 const [copied, setCopied] = useState(false);

 const { data: listingsData } = useQuery({
 queryKey: [uid, 'seller', 'listings', { page: 1, page_size: 1 }],
 queryFn: () => sellerApi.getMyListings({ page: 1, page_size: 1 }),
 enabled: !!session.isAuthenticated,
 });

 const { data: profileData } = useQuery({
 queryKey: userKeys.profile(),
 queryFn: () => usersApi.getProfile(),
 enabled: !!session.isAuthenticated,
 staleTime: 5 * 60 * 1000,
 });

  // Fetch reviews count (received reviews)
 const { data: reviewsData } = useQuery({
 queryKey: [uid, 'reviews', 'received'],
 queryFn: async () => {
 const { apiClient } = await import('@/lib/api/client');
 return apiClient.get<any>('/reviews?type=received&page=1&page_size=1').then(r => r.data);
 },
 enabled: !!session.isAuthenticated,
 staleTime: 5 * 60 * 1000,
 });

  // Fetch messages count (conversations)
 const { data: messagesData } = useQuery({
 queryKey: [uid, 'conversations'],
 queryFn: async () => {
 const { apiClient } = await import('@/lib/api/client');
 return apiClient.get<any>('/chat/conversations').then(r => r.data);
 },
 enabled: !!session.isAuthenticated,
 staleTime: 5 * 60 * 1000,
 });

  // Fetch saved listings count
 const { data: savedData } = useQuery({
 queryKey: [uid, 'saved'],
 queryFn: async () => {
 const { apiClient } = await import('@/lib/api/client');
 return apiClient.get<any>('/saved').then(r => r.data);
 },
 enabled: !!session.isAuthenticated,
 staleTime: 5 * 60 * 1000,
 });

 const totalListings = listingsData?.meta?.total ?? 0;
 const totalReviews = reviewsData?.meta?.total ?? (Array.isArray(reviewsData?.data) ? reviewsData.data.length : 0);
 const totalMessages = Array.isArray(messagesData?.data) ? messagesData.data.length : 0;
 const totalSaved = Array.isArray(savedData?.data) ? savedData.data.length : 0;
 const fullName = profileData?.data?.full_name ?? '';
 const firstName = fullName.split(' ')[0] || 'there';

  /* ── KPI definitions ────────────────────────────────────── */
 const KPI = [
 {
 icon: Package, label: 'Listings', href: ROUTES.user.listings,
 value: totalListings.toLocaleString(),
 color: '#4F46E5', bg: '#eef2ff',
 },
 {
 icon: Star, label: 'Reviews', href: ROUTES.user.reviews,
 value: totalReviews.toLocaleString(),
 color: '#7C3AED', bg: '#f5f3ff',
 },
 {
 icon: ChatCircle, label: 'Messages', href: ROUTES.user.messages,
 value: totalMessages.toLocaleString(),
 color: '#0891B2', bg: '#ecfeff',
 },
 {
 icon: Heart, label: 'Saved', href: ROUTES.user.saved,
 value: totalSaved.toLocaleString(),
 color: '#DB2777', bg: '#fce7f3',
 },
 ];

  /* ── Quick actions ──────────────────────────────────────── */
 const QUICK = [
 { icon: Plus, label: 'Post listing', href: ROUTES.user.create, primary: true },
 { icon: ShoppingBag, label: 'Browse', href: ROUTES.listings, primary: false },
 { icon: ChatCircle, label: 'Messages', href: ROUTES.user.messages, primary: false },
 { icon: Storefront, label: 'My Storefront', href: ROUTES.user.store, primary: false },
 { icon: ChartBar, label: 'Analytics', href: ROUTES.user.storeAnalytics, primary: false },
 { icon: CreditCard, label: 'Plans', href: ROUTES.user.subscription, primary: false },
 { icon: Heart, label: 'Saved', href: ROUTES.user.saved, primary: false },
 { icon: Gear, label: 'Gear', href: ROUTES.user.settings, primary: false },
 ];

 return (
 <div className="space-y-5">

      {/* ── Greeting banner ─────────────────────────────── */}
 <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-200">
 <p className="text-[13px] font-medium opacity-80 mb-0.5">{getGreeting()}</p>
 <h1 className="text-[22px] font-black capitalize leading-tight">
 {firstName}!
 </h1>
 </div>

      {/* ── Onboarding banner (first-time users only) ─── */}
 {totalListings === 0 && (
 <div className="overflow-hidden rounded-2xl border border-indigo-100
 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
 <div className="flex items-start gap-3">
 <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center
 rounded-2xl bg-indigo-600 shadow-sm">
 <Sparkle className="h-5 w-5 text-white" />
 </div>
 <div className="flex-1 min-w-0">
 <h2 className="text-[15px] font-black text-slate-900 mb-1">
 Welcome to Velontri!
 </h2>
 <p className="text-[13px] text-slate-600 mb-3 leading-relaxed">
 Connect with buyers across Africa. Post your first listing and reach millions of people.
 </p>
 <div className="flex flex-wrap gap-2">
 <Link href={ROUTES.user.create}
 className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4
 text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
 <Plus className="h-3.5 w-3.5" /> Post listing
 </Link>
 <Link href={ROUTES.listings}
 className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200
 bg-white px-4 text-[13px] font-semibold text-slate-700 no-underline
 hover:bg-slate-50 transition-colors">
 Browse listings
 </Link>
 </div>
 </div>
 </div>
 </div>
 )}

      {/* ── KPI cards ───────────────────────────────────── */}
 <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
 {KPI.map(({ icon: Icon, label, value, color, bg, href }) => (
 <Link key={label} href={href}
 className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4
 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]">
 <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
 style={{ background: color }} />
 <div className="flex items-start justify-between mb-2">
 <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
 {label}
 </p>
 <div className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
 style={{ background: bg }}>
 <Icon className="h-3.5 w-3.5" style={{ color }} />
 </div>
 </div>
 <p className="text-[1.25rem] font-black text-slate-900 tracking-tight leading-none">
 {value}
 </p>
 </Link>
 ))}
 </div>

      {/* ── Quick actions ────────────────────────────────── */}
 <div>
 <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
 Quick actions
 </p>
 <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
 {QUICK.map(({ icon: Icon, label, href, primary }) => (
 <Link key={href} href={href}
 className={`flex flex-col items-center gap-2 rounded-2xl py-3 px-1 text-center
 text-[10px] font-semibold no-underline transition-all hover:-translate-y-0.5 active:scale-95
 ${primary
 ? 'bg-indigo-600 text-white hover:bg-indigo-700'
 : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
 }`}>
 <Icon className="h-5 w-5" />
 <span className="leading-tight">{label}</span>
 </Link>
 ))}
 </div>
 </div>

      {/* ── Invite Friends Section ──────────────────────── */}
 <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 sm:p-5 shadow-sm">
 <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
 <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-600 shadow-md">
 <ShareNetwork className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
 </div>
 <div className="flex-1 min-w-0 w-full">
 <h2 className="text-[15px] sm:text-[16px] font-black text-slate-900 mb-1">
 Invite friends to Velontri
 </h2>
 <p className="text-[12px] sm:text-[13px] text-slate-600 mb-3 sm:mb-4 leading-relaxed">
 Share Velontri with your friends and help them discover Africa&apos;s marketplace.
 </p>

            {/* Copy Link Input */}
 <div className="flex flex-col sm:flex-row gap-2 mb-3 sm:mb-4">
 <div className="flex-1 flex items-center gap-2 h-10 sm:h-11 rounded-xl border-2 border-slate-200 bg-white px-2.5 sm:px-3">
 <input
 type="text"
 readOnly
 value={typeof window !== 'undefined' ? `${window.location.origin}?ref=${uid}` : ''}
 className="flex-1 bg-transparent text-[11px] sm:text-[13px] text-slate-600 outline-none select-all"
 onClick={(e) => e.currentTarget.select()}
 />
 </div>
 <button
 onClick={() => {
 const link = typeof window !== 'undefined' ? `${window.location.origin}?ref=${uid}` : '';
 navigator.clipboard.writeText(link);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }}
 className="flex h-10 sm:h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 sm:px-5
 text-[12px] sm:text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors w-full sm:w-auto"
 >
 {copied ? (
 <>
 <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
 Copied!
 </>
 ) : (
 <>
 <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
 Copy Link
 </>
 )}
 </button>
 </div>

            {/* Social Share Buttons */}
 <div>
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 sm:mb-2.5">
 Share via
 </p>
 <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
 {[
 {
 name: 'WhatsApp',
 icon: WhatsappLogo,
 color: '#25D366',
 url: `https://wa.me/?text=${encodeURIComponent(`Check out Velontri - Africa's marketplace for buying and selling! ${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${uid}`)}`,
 },
 {
 name: 'Twitter',
 icon: TwitterLogo,
 color: '#1DA1F2',
 url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out Velontri - Africa's marketplace for buying and selling!`)}&url=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}?ref=${uid}` : '')}`,
 },
 {
 name: 'Facebook',
 icon: FacebookLogo,
 color: '#1877F2',
 url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}?ref=${uid}` : '')}`,
 },
 {
 name: 'Telegram',
 icon: TelegramLogo,
 color: '#0088cc',
 url: `https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}?ref=${uid}` : '')}&text=${encodeURIComponent('Check out Velontri - Africa\'s marketplace!')}`,
 },
 {
 name: 'LinkedIn',
 icon: LinkedinLogo,
 color: '#0A66C2',
 url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}?ref=${uid}` : '')}`,
 },
 ].map(({ name, icon: Icon, color, url }) => (
 <a
 key={name}
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center justify-center sm:justify-start gap-2 h-9 sm:h-10 rounded-xl border-2 border-slate-200
 bg-white px-3 sm:px-4 text-[11px] sm:text-[12px] font-semibold text-slate-700 no-underline
 hover:border-slate-300 hover:shadow-sm transition-all active:scale-95"
 style={{ ['--share-color' as any]: color }}
 onMouseEnter={(e) => {
 e.currentTarget.style.borderColor = color;
 e.currentTarget.style.color = color;
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.borderColor = '#e2e8f0';
 e.currentTarget.style.color = '#334155';
 }}
 >
 <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" style={{ color }} />
 <span className="truncate">{name}</span>
 </a>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>

      {/* ── Pulse chart ─────────────────────────────── */}
 <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="text-[14px] font-bold text-slate-900">Pulse this week</h2>
 <p className="text-[11px] text-slate-400 mt-0.5">Views on your listings</p>
 </div>
 <Link href={ROUTES.user.storeAnalytics}
 className="flex items-center gap-1 text-[12px] font-semibold text-indigo-600
 no-underline hover:underline">
 Analytics <CaretRight className="h-3.5 w-3.5" />
 </Link>
 </div>
 <div className="h-36">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={SPARKLINE} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
 <defs>
 <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.18} />
 <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
 <XAxis dataKey="d" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
 <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
 <Tooltip contentStyle={{
 background: '#fff', border: '1px solid #e2e8f0',
 borderRadius: 10, fontSize: 12,
 }} />
 <Area type="monotone" dataKey="v" stroke="#4F46E5"
 fill="url(#dashGrad)" dot={false} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>

      {/* ── Get-started cards (new users) ────────────────── */}
 {totalListings === 0 && (
 <div>
 <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
 Get started
 </p>
 <div className="grid gap-3 sm:grid-cols-3">
 {[
 {
 icon: Plus, title: 'Post your first listing',
 desc: 'Reach buyers across Africa in minutes.',
 href: ROUTES.user.create, cta: 'Post now',
 },
 {
 icon: Storefront, title: 'Open your store',
 desc: 'Build a trusted brand on Velontri.',
 href: ROUTES.user.store, cta: 'Create store',
 },
 {
 icon: CreditCard, title: 'See subscription plans',
 desc: 'Post more listings with a plan upgrade.',
 href: ROUTES.user.subscription, cta: 'View plans',
 },
 ].map(({ icon: Icon, title, desc, href, cta }) => (
 <div key={title}
 className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
 <Icon className="h-[18px] w-[18px] text-indigo-600" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[13px] font-bold text-slate-900 leading-snug">{title}</p>
 <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{desc}</p>
 <Link href={href}
 className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold
 text-indigo-600 no-underline hover:text-indigo-700">
 {cta} <ArrowRight className="h-3 w-3" />
 </Link>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 </div>
 );
}