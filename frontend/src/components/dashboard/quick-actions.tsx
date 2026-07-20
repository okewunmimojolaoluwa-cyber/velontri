'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus, ShoppingBag, MessageCircle, Heart, Store, Wallet, Package, Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

interface QuickAction {
  icon: any;
  label: string;
  href: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: Plus, label: 'Post Listing', href: ROUTES.user.create },
  { icon: ShoppingBag, label: 'Browse', href: ROUTES.listings },
  { icon: MessageCircle, label: 'Messages', href: ROUTES.user.messages },
  { icon: Heart, label: 'Wishlist', href: ROUTES.user.saved },
  { icon: Store, label: 'My Store', href: ROUTES.user.store },
  { icon: Wallet, label: 'Wallet', href: ROUTES.user.wallet },
  { icon: Package, label: 'Orders', href: ROUTES.user.orders },
  { icon: Settings, label: 'Settings', href: ROUTES.user.settings },
];

export function QuickActions() {
  return (
    <div className="px-4 py-3">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
        Quick Actions
      </p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="grid grid-cols-4 gap-3"
      >
        {QUICK_ACTIONS.map(({ icon: Icon, label, href }, index) => (
          <motion.div
            key={href}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.2 + index * 0.05 }}
            whileTap={{ scale: 0.9 }}
          >
            <Link
              href={href}
              className="flex flex-col items-center gap-2 no-underline group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-600 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:border-indigo-200 group-hover:text-indigo-600">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">
                {label}
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
