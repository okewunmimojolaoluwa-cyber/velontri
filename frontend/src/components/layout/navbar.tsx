'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, X, ChevronDown, LogOut, LayoutDashboard, User, CreditCard, Store } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES, resolveHomePath } from '@/config/routes';
import { clearTokens, getRefreshToken } from '@/lib/auth/token-refresh';
import { authApi } from '@/lib/api/endpoints/auth';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { VelontriLogo } from '@/components/ui/velontri-logo';

const NAV_LINKS = [
  { label: 'Browse',  href: ROUTES.listings },
  { label: 'Search',  href: ROUTES.search },
  { label: 'Pricing', href: '/subscriptions/tiers' },
];

export function Navbar() {
  const { session, logout: authLogout } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Use mounted state so SSR always renders guest state — prevents hydration mismatch
  const isAuth = mounted && session?.isAuthenticated;
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const isHomePage = (pathname as string) === ROUTES.home;
  const transparent = isHomePage && !scrolled && !menuOpen;

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', fn, { passive: true });
    fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { setMenuOpen(false); setUserOpen(false); }, [pathname]);

  async function logout() {
    try { const rt = getRefreshToken(); if (rt) await authApi.logout(rt); } catch (_) {}
    authLogout(); window.location.href = '/';
  }

  const dashPath = session ? resolveHomePath(session.role) : ROUTES.dashboard;
  const initials = session?.userId?.slice(0, 2).toUpperCase() ?? 'V';
  const roleName = session?.role ?? 'account';

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-out',
          transparent
            ? 'bg-transparent'
            : 'bg-[hsl(var(--background)/0.94)] backdrop-blur-xl border-b border-[hsl(var(--border)/0.8)] shadow-[0_1px_0_0_hsl(var(--border)/0.6)]',
        )}
      >
        <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">

          {/* ── Logo ── */}
          <Link href="/" className="flex flex-shrink-0 items-center gap-2.5 no-underline" aria-label="Velontri home">
            <VelontriLogo size={34} showWordmark wordmarkSize="md"
              wordmarkClassName={cn(
                'transition-colors',
                transparent ? 'text-white' : 'text-[hsl(var(--foreground))]',
              )} />
          </Link>

          {/* ── Desktop centre nav ── */}
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {NAV_LINKS.map(({ label, href }) => {
              const active = (pathname as string) === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'relative rounded-lg px-3.5 py-2 text-[0.8125rem] font-medium transition-colors',
                    transparent
                      ? active
                        ? 'text-white'
                        : 'text-white/65 hover:text-white'
                      : active
                        ? 'text-[hsl(var(--foreground))] bg-[hsl(var(--muted))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
                  )}
                >
                  {label}
                  {active && !transparent && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-[hsl(var(--primary))]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Desktop right actions ── */}
          <div className="hidden items-center gap-2 md:flex">
            {/* Theme toggle — always visible */}
            <ThemeToggle variant="icon" className={transparent ? 'bg-white/10 text-white hover:bg-white/20' : ''} />

            {isAuth ? (
              <>
                {/* Sell CTA */}
                <Link
                  href={ROUTES.user.create}
                  className={cn(
                    'rounded-lg px-4 py-2 text-[0.8125rem] font-semibold transition-colors',
                    transparent
                      ? 'border border-white/25 text-white/80 hover:bg-white/10 hover:text-white'
                      : 'border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
                  )}
                >
                  + List item
                </Link>

                {/* User dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserOpen((v) => !v)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
                      transparent
                        ? 'text-white/80 hover:bg-white/10 hover:text-white'
                        : 'hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
                    )}
                    aria-expanded={userOpen}
                    aria-haspopup="true"
                  >
                    {/* Avatar */}
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-white">
                      {initials}
                    </span>
                    <span className="capitalize">{roleName}</span>
                    <ChevronDown className={cn('h-3 w-3 opacity-50 transition-transform duration-200', userOpen && 'rotate-180')} />
                  </button>

                  {userOpen && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                      {/* Menu */}
                      <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-52 overflow-hidden rounded-2xl border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--popover))] shadow-xl">
                        {[
                          { icon: LayoutDashboard, label: 'Dashboard',  href: dashPath },
                          { icon: Store,           label: 'My listings', href: ROUTES.user.listings },
                          { icon: User,            label: 'Profile',     href: ROUTES.user.profile },
                          { icon: CreditCard,      label: 'Plans',       href: ROUTES.user.subscription },
                        ].map(({ icon: Icon, label, href }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setUserOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                          >
                            <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            {label}
                          </Link>
                        ))}
                        <div className="mx-4 border-t border-[hsl(var(--border))]" />
                        <button
                          onClick={logout}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/5"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href={ROUTES.login}
                  className={cn(
                    'rounded-lg px-4 py-2 text-[0.8125rem] font-medium transition-colors',
                    transparent
                      ? 'text-white/70 hover:text-white'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                  )}
                >
                  Sign in
                </Link>
                <Link
                  href={ROUTES.register}
                  className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-[0.8125rem] font-semibold text-white shadow-sm transition-colors hover:bg-[hsl(var(--primary-hover))]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn('rounded-lg p-2 transition-colors md:hidden', transparent ? 'text-white hover:bg-white/10' : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]')}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* ── Mobile drawer ── */}
        {menuOpen && (
          <div className="border-t border-[hsl(var(--border)/0.6)] bg-[hsl(var(--background)/0.98)] backdrop-blur-xl md:hidden">
            <div className="mx-auto max-w-7xl space-y-1 px-5 py-4">
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="block rounded-lg px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                >
                  {label}
                </Link>
              ))}

              <div className="pt-3 border-t border-[hsl(var(--border)/0.6)]">
                {/* Theme toggle in mobile drawer */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Appearance</span>
                  <ThemeToggle variant="switch" />
                </div>
                {isAuth ? (
                  <div className="flex gap-2">
                    <Link
                      href={dashPath}
                      className="flex-1 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-center text-sm font-semibold text-white"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={logout}
                      className="rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-destructive transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Link
                      href={ROUTES.login}
                      className="flex-1 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-center text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      Sign in
                    </Link>
                    <Link
                      href={ROUTES.register}
                      className="flex-1 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                    >
                      Get started
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Push page content below fixed nav — only on non-hero pages */}
      {!isHomePage && <div className="h-16" />}
    </>
  );
}
