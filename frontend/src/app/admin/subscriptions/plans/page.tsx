'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export default function SubscriptionPlansPage() {
  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" /> Subscription Plans
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage subscription tiers and pricing</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <Crown className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-900 mb-2">Subscription Plans</p>
          <p className="text-sm text-slate-500 mb-4">Manage all plan configurations from the subscriptions manager.</p>
          <Link href={ROUTES.admin.subscriptions}
            className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            Go to Subscriptions
          </Link>
        </div>
      </div>
    
  );
}
