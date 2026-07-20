'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';
import { VelontriLogo } from '@/components/ui/velontri-logo';
import { useAuth } from '@/features/auth/auth-provider';

interface MobileHeaderProps {
  onMenuOpen: () => void;
}

export function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
  const { session } = useAuth();
  const initials = session.userId?.slice(0, 2).toUpperCase() ?? 'VL';

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-100">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Menu */}
        <button
          onClick={onMenuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Center: Logo */}
        <Link href="/" className="flex items-center no-underline">
          <VelontriLogo size={28} showWordmark wordmarkSize="sm" />
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Link
            href={ROUTES.listings}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href={ROUTES.user.notifications}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          </Link>
          <Link
            href={ROUTES.user.profile}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-semibold text-sm hover:bg-indigo-200 transition-colors"
            aria-label="Profile"
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
}
