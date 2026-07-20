'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Heart, Plus, MessageCircle, LayoutDashboard, X } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils/cn';

const SELL_CATEGORIES = [
  { name: 'Electronics',          emoji: '📱', href: '/dashboard/listings/create?cat=Electronics' },
  { name: 'Vehicles',             emoji: '🚗', href: '/dashboard/listings/create?cat=Vehicles' },
  { name: 'Property',             emoji: '🏠', href: '/dashboard/listings/create?cat=Property' },
  { name: 'Fashion',              emoji: '👗', href: '/dashboard/listings/create?cat=Fashion' },
  { name: 'Services',             emoji: '💼', href: '/dashboard/listings/create?cat=Services' },
  { name: 'Jobs',                 emoji: '📋', href: '/dashboard/listings/create?cat=Jobs' },
  { name: 'Phones',               emoji: '📲', href: '/dashboard/listings/create?cat=Phones' },
  { name: 'Computers',            emoji: '💻', href: '/dashboard/listings/create?cat=Computers' },
  { name: 'Furniture',            emoji: '🛋️', href: '/dashboard/listings/create?cat=Furniture' },
  { name: 'Agriculture',          emoji: '🌾', href: '/dashboard/listings/create?cat=Agriculture' },
  { name: 'Animals',              emoji: '🐄', href: '/dashboard/listings/create?cat=Animals' },
  { name: 'Business Equipment',   emoji: '🏭', href: '/dashboard/listings/create?cat=BusinessEquipment' },
  { name: 'Commercial Property',  emoji: '🏢', href: '/dashboard/listings/create?cat=CommercialProperty' },
  { name: 'Everything else',      emoji: '📦', href: '/dashboard/listings/create' },
];

export function BottomNav() {
  const { session } = useAuth();
  const pathname = usePathname();
  const [sellOpen, setSellOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // All hook calls must be above this line — NO early returns before all hooks are called
  const isAdminRoute     = (pathname as string).startsWith('/admin');
  const isModRoute       = (pathname as string).startsWith('/mod');
  const isDashboardRoute = (pathname as string).startsWith('/dashboard');
  const isAuthRoute      = (pathname as string).startsWith('/login') ||
                           (pathname as string).startsWith('/register') ||
                           (pathname as string).startsWith('/forgot') ||
                           (pathname as string).startsWith('/verify');
  const isRegularUser    = session.role === 'user';
  const showSell         = isRegularUser;

  const isActive = (href: string) => (pathname as string) === href || pathname.startsWith(href + '/');

  const NAV = [
    { icon: Home,           label: 'Home',      href: ROUTES.home },
    { icon: Heart,          label: 'Saved',     href: ROUTES.user.wishlist },
    { icon: MessageCircle,  label: 'Messages',  href: ROUTES.user.messages },
    { icon: LayoutDashboard,label: 'Dashboard', href: ROUTES.user.overview },
  ];

  // Never show on:
  // - Not yet hydrated
  // - Guest / unauthenticated users (no session)
  // - Admin or moderator portals
  // - Auth pages (login/register)
  // - Dashboard routes (UserBottomNav inside UserShell handles those)
  if (
    !mounted ||
    !session.isAuthenticated ||
    isAdminRoute ||
    isModRoute ||
    isAuthRoute ||
    isDashboardRoute
  ) {
    return null;
  }

  return (
    <>
      {/* Sell sheet overlay */}
      {sellOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setSellOpen(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl bg-white pb-8 pt-5 shadow-2xl"
            style={{ maxHeight: '85vh' }}>
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            {/* Header */}
            <div className="flex items-center justify-between px-5 mb-5">
              <h2 className="text-[17px] font-black text-slate-900">What are you selling?</h2>
              <button onClick={() => setSellOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Category grid */}
            <div className="overflow-y-auto px-4" style={{ maxHeight: 'calc(85vh - 110px)' }}>
              <div className="grid grid-cols-3 gap-3 pb-4 sm:grid-cols-4">
                {SELL_CATEGORIES.map(({ name, emoji, href }) => (
                  <Link
                    key={name}
                    href={href}
                    onClick={() => setSellOpen(false)}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50
                      p-4 text-center no-underline transition-all hover:border-indigo-300 hover:bg-indigo-50
                      active:scale-95"
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-[11px] font-semibold text-slate-700 leading-tight">{name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex h-16 items-center border-t border-slate-200
        bg-white/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {showSell ? (
          <>
            {/* Left two items */}
            {NAV.slice(0, 2).map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors',
                  isActive(href) ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive(href) ? 2.5 : 1.75} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            ))}

            {/* Centre SELL button */}
            <div className="flex flex-1 flex-col items-center">
              <button
                onClick={() => setSellOpen(true)}
                className="flex -translate-y-3 items-center justify-center rounded-full
                  bg-indigo-600 text-white shadow-lg shadow-indigo-500/40
                  active:scale-95 transition-all hover:bg-indigo-700"
                style={{ width: 52, height: 52 }}
                aria-label="Sell something"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </button>
              <span className="text-[10px] font-semibold text-indigo-600 -mt-1">Sell</span>
            </div>

            {/* Right two items */}
            {NAV.slice(2).map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors',
                  isActive(href) ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive(href) ? 2.5 : 1.75} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            ))}
          </>
        ) : (
          /* No sell button — spread all nav items evenly */
          <>
            {NAV.map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors',
                  isActive(href) ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive(href) ? 2.5 : 1.75} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Bottom padding to prevent content hidden behind nav */}
      <div className="h-16 md:hidden" />
    </>
  );
}
