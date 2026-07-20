'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth/auth-provider';

interface WelcomeSectionProps {
  totalListings?: number;
}

export function WelcomeSection({ totalListings = 0 }: WelcomeSectionProps) {
  const { session } = useAuth();
  const firstName = session.userId?.split('@')[0] || 'there';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-4 bg-gradient-to-br from-indigo-50 to-violet-50"
    >
      <h1 className="text-xl font-bold text-slate-900 mb-1">
        {getGreeting()}, {displayName}
      </h1>
      <p className="text-sm text-slate-600 mb-4">
        Ready to buy or sell today?
      </p>
      
      <div className="flex gap-3">
        <motion.div whileTap={{ scale: 0.95 }} className="flex-1">
          <Link
            href={ROUTES.user.create}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white no-underline hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus className="h-4 w-4" />
            Post Listing
          </Link>
        </motion.div>
        <motion.div whileTap={{ scale: 0.95 }} className="flex-1">
          <Link
            href={ROUTES.listings}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-50 transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            Browse
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
