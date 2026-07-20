'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, PlusCircle, Package, Activity,
  Bookmark, Store, BarChart3,
  MessageCircle, Bell, User, Settings, Lock,
  HelpCircle, LogOut, Menu, X, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth/auth-provider';
import { getRefreshToken } from '@/lib/auth/token-refresh';
import { authApi } from '@/lib/api/endpoints/auth';
import { UserBottomNav } from './user-bottom-nav';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { VelontriLogo } from '@/components/ui/velontri-logo';

/* ── Navigation structure — one item per destination ─────────────── */
const NAV = [
  {
    label: 'MAIN',
    items: [
      { icon: LayoutDashboard, label: 'Overview',      href: ROUTES.user.overview },
    ],
  },
  {
    label: 'MARKETPLACE',
    items: [
      { icon: Package,         label: 'My Listings',  href: ROUTES.user.listings },
      { icon: Activity,        label: 'Activity',     href: ROUTES.user.orders },
      { icon: Bookmark,        label: 'Saved',        href: ROUTES.user.saved },
    ],
  },
  {
    label: 'MY STORE',
    items: [
      { icon: Store,           label: 'Store',        href: ROUTES.user.store },
      { icon: BarChart3,       label: 'Analytics',    href: ROUTES.user.storeAnalytics },
    ],
  },
  {
    label: 'MESSAGES',
    items: [
      { icon: MessageCircle,   label: 'Messages',     href: ROUTES.user.messages },
      { icon: Bell,            label: 'Notifications',href: ROUTES.user.notifications },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { icon: User,            label: 'Profile',      href: ROUTES.user.profile },
      { icon: Lock,            label: 'Security',     href: ROUTES.user.security },
      { icon: Settings,        label: 'Settings',     href: ROUTES.user.settings },
      { icon: CreditCard,      label: 'Subscription', href: ROUTES.user.subscription },
      { icon: HelpCircle,      label: 'Help',         href: ROUTES.user.help },
    ],
  },
];

/* ── Single nav link ──────────────────────────────────────────────── */
function NavItem({
  icon: Icon, label, href,
}: {
  icon: typeof LayoutDashboard; label: string; href: string;
}) {
  const pathname = usePathname() as string;
  // Mark active: exact match for overview, prefix match for sub-pages
  const active = href === ROUTES.user.overview
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all',
        active
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
      )}
    >
      <Icon
        className={cn(
          'h-[17px] w-[17px] flex-shrink-0 transition-colors',
          active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600',
        )}
        strokeWidth={active ? 2.2 : 1.75}
      />
      <span className="flex-1 truncate">{label}</span>
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
      )}
    </Link>
  );
}

/* ── Shell ────────────────────────────────────────────────────────── */
export function UserShell({ children }: { children: ReactNode }) {
  const { session, logout: authLogout } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const initials = session.userId?.slice(0, 2).toUpperCase() ?? 'VL';

  async function logout() {
    try {
      const rt = getRefreshToken();
      if (rt) await authApi.logout(rt);
    } catch (_) {}
    authLogout();
    window.location.href = '/';
  }

  /* ── Sidebar content ──────────────────────────────────────────── */
  const sidebar = (
    <div className="flex h-full w-[220px] flex-col bg-white dark:bg-[#0d1526] border-r border-slate-100 dark:border-slate-800">

      {/* Logo bar */}
      <div className="flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-slate-100 px-4">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <VelontriLogo size={30} showWordmark wordmarkSize="md" wordmarkClassName="text-slate-900 dark:text-white" />
        </Link>
      </div>

      {/* Post-a-listing CTA */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-slate-100">
        <Link
          href={ROUTES.user.create}
          className="flex w-full items-center justify-center gap-2 rounded-xl
            bg-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white
            no-underline shadow-sm shadow-indigo-200 hover:bg-indigo-700
            active:scale-[0.98] transition-all"
        >
          <PlusCircle className="h-4 w-4" strokeWidth={2.25} />
          Post a listing
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV.map(({ label, items }) => (
          <div key={label}>
            <p className="mb-1 px-3 text-[9px] font-extrabold uppercase tracking-[0.13em] text-slate-300">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(item => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-slate-100 p-3">
        <button
          onClick={logout}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5
            text-[13px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full
            bg-indigo-100 text-[11px] font-bold text-indigo-700">
            {initials}
          </div>
          <span className="flex-1 text-left truncate">My Account</span>
          <LogOut className="h-3.5 w-3.5 text-slate-300 group-hover:text-red-400 transition-colors" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] dark:bg-[#0b1120] dark:bg-[hsl(222_47%_5%)]">

      {/* Desktop sidebar - hide on mobile */}
      <aside className="hidden md:flex flex-shrink-0">{sidebar}</aside>

      {/* Mobile overlay drawer — shows when hamburger is tapped */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 md:hidden"
            style={{ animation: 'slideInLeft 240ms cubic-bezier(0.34,1.56,0.64,1)' }}>
            {sidebar}
          </aside>
        </>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Topbar — always visible */}
        <header className="flex h-14 flex-shrink-0 items-center gap-3
          border-b border-slate-200 bg-white dark:bg-[hsl(222_40%_8%)] dark:border-slate-800 px-4">

            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen(v => !v)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl
                transition-all active:scale-95 focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-indigo-500"
              style={{
                background: open
                  ? 'linear-gradient(135deg,#4F46E5,#7C3AED)'
                  : 'linear-gradient(135deg,#EEF2FF,#F5F3FF)',
              }}
            >
              {open
                ? <X className="h-4 w-4 text-white" />
                : <Menu className="h-4 w-4 text-indigo-600" />
              }
            </button>

            {/* Breadcrumb placeholder */}
            <div className="hidden md:block flex-1" />

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle variant="icon" />
              <Link
                href={ROUTES.user.notifications}
                className="flex h-8 w-8 items-center justify-center rounded-lg
                  text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors relative"
              >
                <Bell className="h-4 w-4" />
              </Link>
              <Link
                href={ROUTES.user.create}
                className="hidden sm:flex items-center gap-1.5 h-8 rounded-xl
                  bg-indigo-600 px-3.5 text-[12px] font-bold text-white
                  no-underline hover:bg-indigo-700 transition-colors"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Sell
              </Link>
              {/* Avatar — links to profile on desktop, opens menu on mobile */}
              <div className="relative">
                <Link href={ROUTES.user.profile} className="hidden md:flex">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center
                    text-[11px] font-bold text-indigo-700 ring-2 ring-white hover:ring-indigo-200
                    transition-all cursor-pointer">
                    {initials}
                  </div>
                </Link>
                {/* Mobile: avatar + logout button */}
                <div className="flex md:hidden items-center gap-1">
                  <Link href={ROUTES.user.profile}>
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center
                      text-[11px] font-bold text-indigo-700 ring-2 ring-white hover:ring-indigo-200
                      transition-all cursor-pointer">
                      {initials}
                    </div>
                  </Link>
                  <button
                    onClick={logout}
                    aria-label="Sign out"
                    className="flex h-8 w-8 items-center justify-center rounded-lg
                      text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Jiji-style mobile bottom nav */}
      <UserBottomNav />
    </div>
  );
}
