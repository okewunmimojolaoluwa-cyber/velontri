'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, MessageCircle, Heart, ShoppingBag, Store,
  Package, ArrowRight, Star, Sparkles,
  ChevronRight, BarChart3, Settings, CreditCard,
} from 'lucide-react';
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

  const totalListings = listingsData?.meta?.total ?? 0;
  const fullName  = profileData?.data?.full_name ?? '';
  const firstName = fullName.split(' ')[0] || 'there';

  /* ── KPI definitions ────────────────────────────────────── */
  const KPI = [
    {
      icon: Package,  label: 'Listings',  href: ROUTES.user.listings,
      value: totalListings.toLocaleString(),
      color: '#4F46E5', bg: '#eef2ff',
    },
    {
      icon: Star,     label: 'Reviews',   href: ROUTES.user.reviews,
      value: '—',
      color: '#7C3AED', bg: '#f5f3ff',
    },
    {
      icon: MessageCircle, label: 'Messages', href: ROUTES.user.messages,
      value: '—',
      color: '#0891B2', bg: '#ecfeff',
    },
    {
      icon: Heart,    label: 'Saved',     href: ROUTES.user.saved,
      value: '—',
      color: '#DB2777', bg: '#fce7f3',
    },
  ];

  /* ── Quick actions ──────────────────────────────────────── */
  const QUICK = [
    { icon: Plus,          label: 'Post listing', href: ROUTES.user.create,         primary: true  },
    { icon: ShoppingBag,   label: 'Browse',       href: ROUTES.listings,            primary: false },
    { icon: MessageCircle, label: 'Messages',     href: ROUTES.user.messages,       primary: false },
    { icon: Store,         label: 'My Store',     href: ROUTES.user.store,          primary: false },
    { icon: BarChart3,     label: 'Analytics',    href: ROUTES.user.storeAnalytics, primary: false },
    { icon: CreditCard,    label: 'Plans',        href: ROUTES.user.subscription,   primary: false },
    { icon: Heart,         label: 'Saved',        href: ROUTES.user.saved,          primary: false },
    { icon: Settings,      label: 'Settings',     href: ROUTES.user.settings,       primary: false },
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
              <Sparkles className="h-5 w-5 text-white" />
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
                <Icon className="h-3.5 w-3.5" style={{ color }} strokeWidth={2} />
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
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Activity chart ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">Activity this week</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Views on your listings</p>
          </div>
          <Link href={ROUTES.user.storeAnalytics}
            className="flex items-center gap-1 text-[12px] font-semibold text-indigo-600
              no-underline hover:underline">
            Analytics <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={SPARKLINE} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.18} />
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
              <Area type="monotone" dataKey="v" stroke="#4F46E5" strokeWidth={2}
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
                icon: Plus,      title: 'Post your first listing',
                desc: 'Reach buyers across Africa in minutes.',
                href: ROUTES.user.create,        cta: 'Post now',
              },
              {
                icon: Store,     title: 'Open your store',
                desc: 'Build a trusted brand on Velontri.',
                href: ROUTES.user.store,         cta: 'Create store',
              },
              {
                icon: CreditCard, title: 'See subscription plans',
                desc: 'Post more listings with a plan upgrade.',
                href: ROUTES.user.subscription,  cta: 'View plans',
              },
            ].map(({ icon: Icon, title, desc, href, cta }) => (
              <div key={title}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                  <Icon className="h-[18px] w-[18px] text-indigo-600" strokeWidth={1.75} />
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
