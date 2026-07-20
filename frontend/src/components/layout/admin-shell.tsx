'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, DollarSign, Users, Store, Package,
  ListChecks, AlertTriangle,
  CreditCard, Crown, Megaphone, Image, FileText, Bell,
  Mail, MessageSquare, MapPin, Settings, BarChart3,
  ClipboardList, LogOut, Menu, X, ChevronRight,
  TrendingUp, UserCog, Home, Car, Briefcase,
  Tag, Globe, Download, User, Star, Smartphone, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth/auth-provider';
import { getRefreshToken } from '@/lib/auth/token-refresh';
import { authApi } from '@/lib/api/endpoints/auth';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { VelontriLogo } from '@/components/ui/velontri-logo';

interface NavGroup {
  label: string;
  items: { icon: typeof LayoutDashboard; label: string; href: string }[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'DASHBOARD',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',           href: ROUTES.admin.overview },
      { icon: TrendingUp,      label: 'Business Overview',   href: ROUTES.admin.businessOverview },
    ],
  },
  {
    label: 'REVENUE',
    items: [
      { icon: CreditCard,      label: 'Payments',            href: ROUTES.admin.payments },
      { icon: DollarSign,      label: 'Revenue Analytics',   href: ROUTES.admin.revenue },
    ],
  },
  {
    label: 'SALES',
    items: [
      { icon: BarChart3,       label: "Today's Sales",       href: ROUTES.admin.sales },
      { icon: BarChart3,       label: 'Sales Analytics',      href: ROUTES.admin.sales },
    ],
  },
  {
    label: 'USERS',
    items: [
      { icon: Users,           label: 'Total Users',          href: ROUTES.admin.users },
      { icon: Users,           label: 'Verified Users',       href: ROUTES.admin.verifiedUsers },
      { icon: Users,           label: 'Sellers',             href: ROUTES.admin.sellers },
    ],
  },
  {
    label: 'STORES & LISTINGS',
    items: [
      { icon: Store,           label: 'Stores',               href: ROUTES.admin.stores },
      { icon: Package,         label: 'Listings',             href: ROUTES.admin.listings },
      { icon: Star,            label: 'Featured Listings',   href: ROUTES.admin.featuredListings },
    ],
  },
  {
    label: 'CATEGORIES',
    items: [
      { icon: ListChecks,      label: 'Categories',          href: ROUTES.admin.categories },
      { icon: ListChecks,      label: 'Subcategories',       href: ROUTES.admin.subcategories },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { icon: Package,         label: 'Products',            href: ROUTES.admin.products },
      { icon: Car,             label: 'Vehicles',             href: ROUTES.admin.vehicles },
      { icon: Home,            label: 'Properties',          href: ROUTES.admin.properties },
      { icon: Briefcase,       label: 'Services',            href: ROUTES.admin.services },
      { icon: Briefcase,       label: 'Jobs',                href: ROUTES.admin.jobs },
    ],
  },
  {
    label: 'MODERATORS',
    items: [
      { icon: UserCog,         label: 'Moderators',          href: ROUTES.admin.moderators },
      { icon: UserCog,         label: 'Create Moderator',    href: ROUTES.admin.moderators },
    ],
  },
  {
    label: 'SUBSCRIPTIONS',
    items: [
      { icon: Crown,           label: 'Subscriptions',       href: ROUTES.admin.subscriptions },
      { icon: Crown,           label: 'Subscription Plans',  href: ROUTES.admin.plans },
    ],
  },
  {
    label: 'MARKETING',
    items: [
      { icon: Megaphone,       label: 'Advertisements',      href: ROUTES.admin.promotions },
      { icon: Star,            label: 'Featured Ads',         href: ROUTES.admin.featuredListings },
      { icon: Tag,             label: 'Coupons',             href: ROUTES.admin.coupons },
      { icon: Megaphone,       label: 'Promotions',          href: ROUTES.admin.promotions },
    ],
  },
  {
    label: 'HOMEPAGE',
    items: [
      { icon: Image,           label: 'Homepage Manager',    href: ROUTES.admin.homepage },
      { icon: Image,           label: 'Banner Manager',      href: ROUTES.admin.banners },
      { icon: Image,           label: 'Homepage Sections',   href: ROUTES.admin.homepage },
    ],
  },
  {
    label: 'CMS',
    items: [
      { icon: FileText,        label: 'CMS',                 href: ROUTES.admin.cms },
      { icon: FileText,        label: 'Blog',                href: ROUTES.admin.blog },
    ],
  },
  {
    label: 'REVIEWS & REPORTS',
    items: [
      { icon: Star,            label: 'Reviews',             href: ROUTES.admin.reviews },
      { icon: TrendingUp,      label: 'Reports',             href: ROUTES.admin.businessReports },
      { icon: AlertTriangle,   label: 'Disputes',            href: ROUTES.admin.disputes },
      { icon: MessageSquare,   label: 'Support Tickets',     href: ROUTES.admin.tickets },
    ],
  },
  {
    label: 'NOTIFICATIONS',
    items: [
      { icon: Mail,            label: 'Email Campaigns',     href: ROUTES.admin.emailCampaigns },
      { icon: MessageSquare,   label: 'SMS Campaigns',       href: ROUTES.admin.smsCampaigns },
      { icon: Smartphone,      label: 'Push Notifications',  href: ROUTES.admin.pushNotifications },
    ],
  },
  {
    label: 'LOCATIONS',
    items: [
      { icon: MapPin,          label: 'Countries',           href: ROUTES.admin.countries },
      { icon: MapPin,          label: 'States',              href: ROUTES.admin.states },
      { icon: MapPin,          label: 'Cities',              href: ROUTES.admin.cities },
    ],
  },
  {
    label: 'CONFIGURATION',
    items: [
      { icon: DollarSign,      label: 'Currencies',          href: ROUTES.admin.currencies },
      { icon: Globe,           label: 'Languages',           href: ROUTES.admin.languages },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      { icon: TrendingUp,      label: 'Business Reports',    href: ROUTES.admin.businessReports },
      { icon: BarChart3,       label: 'Sales Reports',       href: ROUTES.admin.salesReports },
      { icon: DollarSign,      label: 'Revenue Reports',     href: ROUTES.admin.revenueReports },
      { icon: Download,        label: 'Export Reports',      href: ROUTES.admin.exportReports },
    ],
  },
  {
    label: 'AUDIT',
    items: [
      { icon: ClipboardList,   label: 'Audit Logs',          href: ROUTES.admin.audit },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { icon: Settings,        label: 'Business Settings',    href: ROUTES.admin.platformSettings },
      { icon: Settings,        label: 'Platform Settings',    href: ROUTES.admin.settings },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { icon: User,            label: 'Profile',             href: ROUTES.admin.profile },
      { icon: Shield,          label: 'Security',            href: '/admin/security' },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { logout: authLogout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function logout() {
    try { const rt = getRefreshToken(); if (rt) await authApi.logout(rt); } catch (_) {}
    authLogout(); window.location.href = '/';
  }

  const sidebar = (
    <div className={cn('flex h-full flex-col bg-[#0f172a] transition-all duration-300', collapsed ? 'w-16' : 'w-64')}>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-white/8 px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2 no-underline">
            <VelontriLogo size={30} showWordmark wordmarkSize="sm"
              wordmarkClassName="text-white" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">Business Owner</p>
          </Link>
        )}
        <button onClick={() => setCollapsed(v => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white/80 transition-colors ml-auto">
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', !collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {ADMIN_NAV.map(({ label, items }) => (
          <div key={label}>
            {!collapsed && (
              <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-widest text-white/30">
                {label}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map(({ icon: Icon, label: itemLabel, href }) => {
                const active = (pathname as string) === href || pathname.startsWith(href + '/');
                return (
                  <Link key={href} href={href} title={collapsed ? itemLabel : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium transition-all',
                      active
                        ? 'bg-indigo-600/20 text-indigo-400'
                        : 'text-white/50 hover:bg-white/6 hover:text-white/90',
                      collapsed && 'justify-center',
                    )}>
                    <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-indigo-400' : '')} strokeWidth={active ? 2 : 1.75} />
                    {!collapsed && <span className="truncate">{itemLabel}</span>}
                    {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/8 p-3">
        <div className={cn('flex items-center gap-3 rounded-xl px-2 py-2', collapsed ? 'justify-center' : '')}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/30 text-xs font-bold text-indigo-400 ring-1 ring-indigo-500/30">
            SA
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">Super Admin</p>
                <p className="text-[10px] text-white/40">Business Owner</p>
              </div>
              <button onClick={logout}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:bg-red-500/20 hover:text-red-400 transition-all">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden md:block flex-shrink-0">{sidebar}</aside>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 md:hidden">{sidebar}</aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center justify-between
          border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(v => !v)} className="md:hidden p-2 text-slate-500">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1.5">
              <Crown className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[12px] font-bold text-indigo-700">Business Owner Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" />
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-indigo-200">
              SA
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
