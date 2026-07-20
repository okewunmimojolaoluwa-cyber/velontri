'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListChecks, Flag, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

const TAB_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: ROUTES.mod.overview },
  { icon: ListChecks, label: 'Pending', href: ROUTES.mod.pendingListings },
  { icon: Flag, label: 'Reported', href: ROUTES.mod.reportedListings },
  { icon: FileCheck, label: 'KYC', href: ROUTES.mod.kyc },
];

export function ModTopNav() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="md:hidden border-b border-slate-200 bg-white overflow-x-auto">
      <div className="flex items-center gap-1 px-4 py-2">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
