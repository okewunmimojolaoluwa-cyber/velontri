'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, Users, ShoppingBag, DollarSign, TrendingUp, ArrowRight, Store } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

interface AnalyticsData {
  views: number;
  visitors: number;
  orders: number;
  revenue: string;
  followers: number;
}

interface StoreAnalyticsProps {
  hasStore?: boolean;
  analytics?: AnalyticsData;
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  views: 1245,
  visitors: 832,
  orders: 24,
  revenue: '₦1,250,000',
  followers: 245,
};

export function StoreAnalytics({ hasStore = true, analytics = DEFAULT_ANALYTICS }: StoreAnalyticsProps) {
  if (!hasStore) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.7 }}
        className="px-4 py-3"
      >
        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Create Your Store
              </h3>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Build a trusted brand and reach more buyers across Africa.
              </p>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Link
                  href={ROUTES.user.store}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white no-underline hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                >
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const metrics = [
    { icon: Eye, label: 'Views', value: analytics.views.toLocaleString(), color: '#4F46E5', bg: '#eef2ff' },
    { icon: Users, label: 'Visitors', value: analytics.visitors.toLocaleString(), color: '#0891B2', bg: '#ecfeff' },
    { icon: ShoppingBag, label: 'Orders', value: analytics.orders.toString(), color: '#059669', bg: '#ecfdf5' },
    { icon: DollarSign, label: 'Revenue', value: analytics.revenue, color: '#D97706', bg: '#fffbeb' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.7 }}
      className="px-4 py-3"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Store Analytics
        </p>
        <Link
          href={ROUTES.user.storeAnalytics}
          className="text-xs font-semibold text-indigo-600 no-underline hover:text-indigo-700"
        >
          View Details
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.75 }}
        className="grid grid-cols-2 gap-3 mb-3"
      >
        {metrics.map(({ icon: Icon, label, value, color, bg }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.75 + index * 0.05 }}
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: bg }}>
                <Icon className="h-3 w-3" style={{ color }} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                {label}
              </span>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight leading-none">
              {value}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Followers with trend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.8 }}
        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100">
              <TrendingUp className="h-3 w-3 text-emerald-600" strokeWidth={2} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Followers
            </span>
          </div>
          <span className="text-xs font-semibold text-emerald-600">
            +12% this week
          </span>
        </div>
        <p className="text-lg font-black text-slate-900 tracking-tight leading-none">
          {analytics.followers.toLocaleString()}
        </p>
      </motion.div>
    </motion.div>
  );
}
