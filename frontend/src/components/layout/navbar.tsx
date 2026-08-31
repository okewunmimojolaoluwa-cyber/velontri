'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, X, CaretDown, SignOut, SquaresFour, User, CreditCard, Storefront, Plus, Bell } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES, resolveHomePath } from '@/config/routes';
import { getRefreshToken } from '@/lib/auth/token-refresh';
import { authApi } from '@/lib/api/endpoints/auth';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { VelontriLogo } from '@/components/ui/velontri-logo';
import { useUnreadCount } from '@/lib/hooks/use-notifications';

/* ── Nav items — visible to all guests ── */
const NAV_LINKS = [
 { label: 'Browse', href: ROUTES.listings },
 { label: 'Vehicles', href: '/listings?listing_type=vehicle' },
 { label: 'Property', href: '/listings?listing_type=property' },
 { label: 'Electronics',href: '/listings?category=Electronics' },
 { label: 'Pricing', href: '/subscriptions/tiers' },
] as const;

export function Navbar() {
 const { session, logout: authLogout } = useAuth();
 const [mounted, setMounted] = useState(false);
 useEffect(() => { setMounted(true); }, []);
 const isAuth = mounted && session?.isAuthenticated;

 const pathname = usePathname();
 const [scrolled, setScrolled] = useState(false);
 const [menuOpen, setMenuOpen] = useState(false);
 const [userOpen, setUserOpen] = useState(false);
 const userRef = useRef<HTMLDivElement>(null);

 const isHomePage = pathname === ROUTES.home;
 const transparent = isHomePage && !scrolled && !menuOpen;

  /* Scroll listener */
 useEffect(() => {
 const fn = () => setScrolled(window.scrollY > 40);
 window.addEventListener('scroll', fn, { passive: true });
 fn();
 return () => window.removeEventListener('scroll', fn);
 }, []);

  /* Close everything on route change */
 useEffect(() => { setMenuOpen(false); setUserOpen(false); }, [pathname]);

  /* Close user dropdown on outside click */
 useEffect(() => {
 if (!userOpen) return;
 const fn = (e: MouseEvent) => {
 if (userRef.current && !userRef.current.contains(e.target as Node)) {
 setUserOpen(false);
 }
 };
 document.addEventListener('mousedown', fn);
 return () => document.removeEventListener('mousedown', fn);
 }, [userOpen]);

 async function logout() {
 try { const rt = getRefreshToken(); if (rt) await authApi.logout(rt); } catch (_) {}
 authLogout();
 window.location.href = '/';
 }

 const dashPath = session ? resolveHomePath(session.role) : ROUTES.dashboard;
 const initials = (session?.userId?.slice(0, 2) ?? 'V').toUpperCase();
 const roleName = session?.role ?? 'account';
 const unreadCount = useUnreadCount();

  /* ── Active link check ── */
 function isActive(href: string) {
 if (href === ROUTES.listings) return pathname === ROUTES.listings;
 return pathname.startsWith(href.split('?')[0]);
 }

 return (
 <>
 <header
 className={cn(
 'fixed inset-x-0 top-0 z-50 transition-all duration-300',
 transparent
 ? 'bg-transparent'
 : 'bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.07)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]',
 )}
 >
 <div className="mx-auto flex h-[62px] max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-10">

          {/* ── Logo ─────────────────────────────── */}
 <Link
 href="/"
 className="flex flex-shrink-0 items-center gap-2.5 no-underline"
 aria-label="Velontri home"
 >
 <VelontriLogo
 size={32}
 showWordmark
 wordmarkSize="md"
 wordmarkClassName={cn(
 'transition-colors font-black tracking-tight',
 transparent ? 'text-white' : 'text-slate-900 dark:text-white',
 )}
 />
 </Link>

          {/* ── Divider (desktop) ─────────────────── */}
 <div className={cn(
 'hidden md:block h-5 w-px flex-shrink-0 transition-colors',
 transparent ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700',
 )} />

          {/* ── Desktop nav links ─────────────────── */}
 <nav className="hidden md:flex items-center gap-0" aria-label="Primary navigation">
 {NAV_LINKS.map(({ label, href }) => {
 const active = isActive(href);
 return (
 <Link
 key={href}
 href={href}
 className={cn(
 'relative flex items-center px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors duration-150',
 transparent
 ? active
 ? 'text-white'
 : 'text-white/60 hover:text-white hover:bg-white/10'
 : active
 ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800'
 : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60',
 )}
 >
 {label}
 {active && !transparent && (
 <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-[2px] w-3.5 rounded-full bg-indigo-500" />
 )}
 </Link>
 );
 })}
 </nav>

          {/* ── Spacer ───────────────────────────── */}
 <div className="flex-1" />

          {/* ── Desktop right ─────────────────────── */}
 <div className="hidden md:flex items-center gap-1.5">

 <ThemeToggle
 variant="icon"
 className={cn(
 'rounded-lg',
 transparent ? 'text-white/70 hover:bg-white/10 hover:text-white' : '',
 )}
 />

 {isAuth ? (
 <>
                {/* Post listing CTA */}
 <Link
 href={ROUTES.user.create}
 className={cn(
 'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors',
 transparent
 ? 'text-white/80 border border-white/20 hover:bg-white/10 hover:text-white hover:border-white/40'
 : 'text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
 )}
 >
 <Plus className="h-3.5 w-3.5" />
 Post listing
 </Link>

                {/* Bell / notifications */}
 <Link
 href={ROUTES.user.notifications}
 aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
 className={cn(
 'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
 transparent
 ? 'text-white/70 hover:bg-white/10 hover:text-white'
 : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
 )}
 >
 <Bell className="h-4.5 w-4.5" />
 {unreadCount > 0 && (
 <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-1 ring-white dark:ring-slate-900 tabular-nums">
 {unreadCount > 9 ? '9+' : unreadCount}
 </span>
 )}
 </Link>

                {/* User dropdown */}
 <div className="relative" ref={userRef}>
 <button
 onClick={() => setUserOpen(v => !v)}
 aria-expanded={userOpen}
 aria-haspopup="true"
 className={cn(
 'flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition-all duration-150',
 transparent
 ? 'text-white/80 hover:bg-white/10'
 : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200',
 )}
 >
                    {/* Avatar circle */}
 <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white shadow-sm flex-shrink-0">
 {initials}
 </span>
 <span className="capitalize hidden lg:block">{roleName}</span>
 <CaretDown className={cn(
 'h-3.5 w-3.5 opacity-40 transition-transform duration-200',
 userOpen ? 'rotate-180' : '',
 transparent ? 'text-white' : 'text-slate-500',
 )} />
 </button>

                  {/* Dropdown panel */}
 {userOpen && (
 <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-2xl shadow-black/10 dark:shadow-black/40">
                      {/* Account info header */}
 <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
 <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Account</p>
 <p className="text-[13px] font-bold text-slate-900 dark:text-white capitalize mt-0.5">{roleName}</p>
 </div>

 <div className="py-1.5">
 {[
 { icon: SquaresFour, label: 'Dashboard', href: dashPath },
 { icon: Storefront, label: 'My listings', href: ROUTES.user.listings },
 { icon: User, label: 'Profile', href: ROUTES.user.profile },
 { icon: CreditCard, label: 'Plans', href: ROUTES.user.subscription },
 ].map(({ icon: Icon, label, href }) => (
 <Link
 key={href}
 href={href}
 onClick={() => setUserOpen(false)}
 className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
 >
 <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
 {label}
 </Link>
 ))}
 </div>

 <div className="border-t border-slate-100 dark:border-slate-800 py-1.5">
 <button
 onClick={logout}
 className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
 >
 <SignOut className="h-4 w-4 flex-shrink-0" />
 Sign out
 </button>
 </div>
 </div>
 )}
 </div>
 </>
 ) : (
 <>
 <Link
 href={ROUTES.login}
 className={cn(
 'rounded-lg px-4 py-2 text-[13px] font-medium transition-colors',
 transparent
 ? 'text-white/70 hover:text-white hover:bg-white/10'
 : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800',
 )}
 >
 Sign in
 </Link>

                {/* Divider */}
 <div className={cn('h-4 w-px', transparent ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700')} />

 <Link
 href={ROUTES.register}
 className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:-translate-y-px active:translate-y-0"
 >
 Get started
 </Link>
 </>
 )}
 </div>

          {/* ── Mobile hamburger ─────────────────── */}
 <button
 onClick={() => setMenuOpen(v => !v)}
 aria-label={menuOpen ? 'Close menu' : 'Open menu'}
 aria-expanded={menuOpen}
 className={cn(
 'md:hidden flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 active:scale-95',
 transparent
 ? 'text-white hover:bg-white/10'
 : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
 )}
 >
 {menuOpen
 ? <X className="h-5 w-5" />
 : <List className="h-5 w-5" />
 }
 </button>
 </div>

        {/* ── Mobile drawer ───────────────────── */}
 <div
 className={cn(
 'md:hidden overflow-hidden transition-all duration-300',
 menuOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0',
 )}
 style={{ transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}
 >
 <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 pb-6 pt-3">
            {/* Nav links */}
 <div className="space-y-0.5 mb-4">
 {NAV_LINKS.map(({ label, href }) => {
 const active = isActive(href);
 return (
 <Link
 key={href}
 href={href}
 className={cn(
 'flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium transition-colors',
 active
 ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60',
 )}
 >
 {active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
 {label}
 </Link>
 );
 })}
 </div>

            {/* Theme */}
 <div className="flex items-center justify-between px-4 py-2.5 mb-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
 <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Appearance</span>
 <ThemeToggle variant="switch" />
 </div>

            {/* Auth actions */}
 {isAuth ? (
 <div className="flex gap-2">
 <Link
 href={dashPath}
 className="flex-1 rounded-xl bg-indigo-600 py-3 text-center text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors"
 >
 Dashboard
 </Link>
 <button
 onClick={logout}
 className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
 >
 Sign out
 </button>
 </div>
 ) : (
 <div className="flex gap-2">
 <Link
 href={ROUTES.login}
 className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-3 text-center text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
 >
 Sign in
 </Link>
 <Link
 href={ROUTES.register}
 className="flex-1 rounded-xl bg-indigo-600 py-3 text-center text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors"
 >
 Get started
 </Link>
 </div>
 )}
 </div>
 </div>
 </header>

      {/* ── Spacer — push content below fixed navbar on non-hero pages ── */}
 {!isHomePage && <div className="h-[62px]" />}
 </>
 );
}