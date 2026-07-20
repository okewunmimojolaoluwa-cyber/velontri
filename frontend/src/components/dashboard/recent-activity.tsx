'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ShoppingBag, MessageCircle, Wallet, Eye, ShieldCheck, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

interface ActivityItem {
  id: string;
  type: 'order' | 'message' | 'transaction' | 'view' | 'escrow';
  title: string;
  description: string;
  time: string;
  href: string;
  icon: any;
}

interface RecentActivityProps {
  activities?: ActivityItem[];
}

const DEFAULT_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    type: 'order',
    title: 'New Order Received',
    description: 'iPhone 15 Pro Max - ₦850,000',
    time: '2 min ago',
    href: ROUTES.user.orders,
    icon: ShoppingBag,
  },
  {
    id: '2',
    type: 'message',
    title: 'New Message',
    description: 'Chinedu: Is this still available?',
    time: '15 min ago',
    href: ROUTES.user.messages,
    icon: MessageCircle,
  },
  {
    id: '3',
    type: 'transaction',
    title: 'Wallet Credit',
    description: '+₦25,000 from sale',
    time: '1 hour ago',
    href: ROUTES.user.wallet,
    icon: Wallet,
  },
  {
    id: '4',
    type: 'view',
    title: 'Listing Viewed',
    description: 'MacBook Pro M3 - 45 views today',
    time: '3 hours ago',
    href: ROUTES.user.listings,
    icon: Eye,
  },
  {
    id: '5',
    type: 'escrow',
    title: 'Escrow Pending',
    description: '₦8,500 awaiting release',
    time: '5 hours ago',
    href: ROUTES.user.escrow,
    icon: ShieldCheck,
  },
];

export function RecentActivity({ activities = DEFAULT_ACTIVITIES }: RecentActivityProps) {
  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Recent Activity
        </p>
        <Link
          href={ROUTES.user.overview}
          className="text-xs font-semibold text-indigo-600 no-underline hover:text-indigo-700"
        >
          See all
        </Link>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="space-y-2"
      >
        {activities.slice(0, 5).map((activity, index) => {
          const Icon = activity.icon;
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
            >
              <Link
                href={activity.href}
                className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-3 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md block"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {activity.description}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-slate-400">
                    {activity.time}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
