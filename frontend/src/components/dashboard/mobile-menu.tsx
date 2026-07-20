'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, LayoutDashboard, Package, ShoppingCart, Bookmark, Wallet, ShieldCheck, Store, BarChart3, MessageCircle, Bell, User, Lock, Settings, HelpCircle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth/auth-provider';
import { getRefreshToken } from '@/lib/auth/token-refresh';
import { authApi } from '@/lib/api/endpoints/auth';

interface MobileMenuProps {
  onClose: () => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview', href: ROUTES.user.overview },
  { icon: Package, label: 'My Listings', href: ROUTES.user.listings },
  { icon: ShoppingCart, label: 'Orders', href: ROUTES.user.orders },
  { icon: Bookmark, label: 'Saved', href: ROUTES.user.saved },
  { icon: Wallet, label: 'Wallet', href: ROUTES.user.wallet },
  { icon: ShieldCheck, label: 'Escrow', href: ROUTES.user.escrow },
  { icon: Store, label: 'Store', href: ROUTES.user.store },
  { icon: BarChart3, label: 'Analytics', href: ROUTES.user.storeAnalytics },
  { icon: MessageCircle, label: 'Messages', href: ROUTES.user.messages },
  { icon: Bell, label: 'Notifications', href: ROUTES.user.notifications },
  { icon: User, label: 'Profile', href: ROUTES.user.profile },
  { icon: Lock, label: 'Security', href: ROUTES.user.security },
  { icon: Settings, label: 'Settings', href: ROUTES.user.settings },
  { icon: HelpCircle, label: 'Help', href: ROUTES.user.help },
];

export function MobileMenu({ onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const { session, logout: authLogout } = useAuth();
  const initials = session.userId?.slice(0, 2).toUpperCase() ?? 'VL';

  async function logout() {
    try {
      const rt = getRefreshToken();
      if (rt) await authApi.logout(rt);
    } catch (_) {}
    authLogout();
    window.location.href = '/';
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 md:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white md:hidden shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
              {initials}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">My Account</p>
              <p className="text-xs text-slate-500">{session.userId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0',
                    active ? 'text-indigo-600' : 'text-slate-400'
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
