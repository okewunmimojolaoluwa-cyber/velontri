'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ListChecks, FileCheck, Flag, AlertTriangle,
  Users, Store, MessageSquare, Megaphone, LogOut, Menu, X, Zap,
  Star, FileText, User, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth/auth-provider';
import { clearTokens, getRefreshToken } from '@/lib/auth/token-refresh';
import { authApi } from '@/lib/api/endpoints/auth';
import { ModTopNav } from './mod-top-nav';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { VelontriLogo } from '@/components/ui/velontri-logo';

const MOD_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard',           href: ROUTES.mod.overview },
  { icon: ListChecks,      label: 'Pending Listings',   href: ROUTES.mod.pendingListings },
  { icon: Flag,            label: 'Reported Listings',  href: ROUTES.mod.reportedListings },
  { icon: FileCheck,       label: 'Pending KYC',         href: ROUTES.mod.kyc },
  { icon: Users,           label: 'Users',              href: ROUTES.mod.users },
  { icon: Store,           label: 'Stores',             href: ROUTES.mod.stores },
  { icon: Star,            label: 'Reported Reviews',   href: ROUTES.mod.reviews },
  { icon: AlertTriangle,   label: 'Disputes',           href: ROUTES.mod.disputes },
  { icon: MessageSquare,   label: 'Support Tickets',    href: ROUTES.mod.tickets },
  { icon: Megaphone,       label: 'Announcements',      href: ROUTES.mod.announcements },
  { icon: FileText,        label: 'Moderation Logs',    href: ROUTES.mod.logs },
  { icon: User,            label: 'Profile',             href: ROUTES.mod.profile },
  { icon: Settings,        label: 'Settings',           href: ROUTES.mod.settings },
];

export function ModShell({ children }: { children: ReactNode }) {
  const { session, logout: authLogout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function logout() {
    try { const rt = getRefreshToken(); if (rt) await authApi.logout(rt); } catch (_) {}
    authLogout(); window.location.href = '/';
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-4">
        <VelontriLogo size={28} showWordmark wordmarkSize="sm"
          wordmarkClassName="text-slate-900 dark:text-white" />
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider ml-1">Mod</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {MOD_NAV.map(({ icon: Icon, label, href }) => {
          const active = (pathname as string) === href;
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
              )}>
              <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-amber-600' : 'text-slate-400')} />
              <span className="flex-1 truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-8 w-8 rounded-full bg-amber-100 items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
            M
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Moderator</p>
            <p className="text-xs text-slate-400">Staff account</p>
          </div>
          <button onClick={logout}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-56 flex-shrink-0 md:block">{sidebar}</aside>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 md:hidden">{sidebar}</aside>
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[hsl(222_40%_8%)] px-4 sm:px-6">
          <button onClick={() => setOpen(v => !v)} className="md:hidden p-2 text-slate-500">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle variant="icon" />
            <div className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
              Moderator Portal
            </div>
          </div>
        </header>

        {/* Mobile tab navigation */}
        <ModTopNav />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
