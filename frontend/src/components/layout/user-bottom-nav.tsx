'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Heart, Zap, MessageCircle, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

const NAV_ITEMS = [
  { icon: Home, label: 'Home', href: ROUTES.home },
  { icon: Heart, label: 'Saved', href: ROUTES.user.saved },
  { icon: Zap, label: 'SELL', href: ROUTES.user.create, isCTA: true },
  { icon: MessageCircle, label: 'Messages', href: ROUTES.user.messages },
  { icon: LayoutDashboard, label: 'Dashboard', href: ROUTES.user.overview },
];

export function UserBottomNav() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Return placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 h-[84px] bg-white border-t border-slate-200 md:hidden" />
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          
          if (item.isCTA) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="mt-1 text-[10px] font-bold text-indigo-600">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors',
                active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-indigo-600')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for iPhone home indicator */}
      <div className="h-5 bg-white" />
    </div>
  );
}
