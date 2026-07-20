'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Wallet, ShieldCheck, Package, Star, MessageCircle, Heart, Store, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

interface KPICard {
  icon: any;
  label: string;
  value: string;
  href: string;
  color: string;
  bg: string;
}

interface KPICardsProps {
  walletBalance?: string;
  escrowBalance?: string;
  totalListings?: number;
  orders?: number;
  messages?: number;
  wishlist?: number;
  followers?: number;
  reviews?: string;
}

export function KPICards({
  walletBalance = '₦0',
  escrowBalance = '₦0',
  totalListings = 0,
  orders = 0,
  messages = 0,
  wishlist = 0,
  followers = 0,
  reviews = '—',
}: KPICardsProps) {
  const kpis: KPICard[] = [
    {
      icon: Wallet,
      label: 'Wallet',
      value: walletBalance,
      href: ROUTES.user.wallet,
      color: '#4F46E5',
      bg: '#eef2ff',
    },
    {
      icon: ShieldCheck,
      label: 'Escrow',
      value: escrowBalance,
      href: ROUTES.user.escrow,
      color: '#D97706',
      bg: '#fffbeb',
    },
    {
      icon: Package,
      label: 'Listings',
      value: totalListings.toString(),
      href: ROUTES.user.listings,
      color: '#059669',
      bg: '#ecfdf5',
    },
    {
      icon: ShoppingBag,
      label: 'Orders',
      value: orders.toString(),
      href: ROUTES.user.orders,
      color: '#7C3AED',
      bg: '#f5f3ff',
    },
    {
      icon: MessageCircle,
      label: 'Messages',
      value: messages.toString(),
      href: ROUTES.user.messages,
      color: '#0891B2',
      bg: '#ecfeff',
    },
    {
      icon: Heart,
      label: 'Wishlist',
      value: wishlist.toString(),
      href: ROUTES.user.saved,
      color: '#DB2777',
      bg: '#fce7f3',
    },
    {
      icon: Store,
      label: 'Followers',
      value: followers.toString(),
      href: ROUTES.user.store,
      color: '#EA580C',
      bg: '#ffedd5',
    },
    {
      icon: Star,
      label: 'Reviews',
      value: reviews,
      href: ROUTES.user.reviews,
      color: '#CA8A04',
      bg: '#fef9c3',
    },
  ];

  return (
    <div className="px-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        {kpis.map(({ icon: Icon, label, value, color, bg, href }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
          >
            <Link
              href={href}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md block"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  {label}
                </p>
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: bg }}
                >
                  <Icon className="h-3 w-3" style={{ color }} strokeWidth={2} />
                </div>
              </div>
              <p className="text-lg font-black text-slate-900 tracking-tight leading-none">
                {value}
              </p>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
