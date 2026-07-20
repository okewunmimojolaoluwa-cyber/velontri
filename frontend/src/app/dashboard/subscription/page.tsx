'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Zap } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { sellerApi } from '@/lib/api/endpoints/seller';
import { apiClient } from '@/lib/api/client';
import { ROUTES } from '@/config/routes';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '₦0',
    period: 'forever',
    maxListings: 3,
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    features: [
      'Up to 3 active listings',
      'Chat buyers on WhatsApp',
      'Create one store',
      'Basic analytics',
      'Standard search visibility',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '₦2,500',
    period: '/month',
    maxListings: 20,
    color: '#4F46E5',
    bg: '#eef2ff',
    border: '#c7d2fe',
    badge: 'Popular',
    features: [
      'Up to 20 active listings',
      'Chat buyers on WhatsApp',
      'Create one store',
      'Higher search visibility',
      'Priority customer support',
      'Featured badge on listings',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '₦7,500',
    period: '/month',
    maxListings: 100,
    color: '#7C3AED',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    features: [
      'Up to 100 active listings',
      'Store branding & customization',
      'Premium search ranking',
      'Advanced analytics',
      'Priority moderation',
      'Bulk listing management',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    maxListings: Infinity,
    color: '#D97706',
    bg: '#fffbeb',
    border: '#fde68a',
    features: [
      'Unlimited listings',
      'Multi-store support',
      'Verified Business Badge',
      'Top search ranking',
      'Homepage promotion eligibility',
      'Dedicated support',
      'Advanced analytics & API access',
    ],
  },
] as const;

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromCreate = searchParams.get('from') === 'create';
  const justPaid   = searchParams.get('success') === 'true';
  const paidPlan   = searchParams.get('plan') || '';
  const nextAction = searchParams.get('next');
  const { session } = useAuth();
  const uid = session.userId;
  const [activatingPlan, setActivatingPlan] = useState<string | null>(null);
  const [payError, setPayError] = useState('');

  const { data: listingsData } = useQuery({
    queryKey: [uid, 'seller', 'listings', { page: 1, page_size: 1 }],
    queryFn: () => sellerApi.getMyListings({ page: 1, page_size: 1 }),
    enabled: !!session.isAuthenticated,
  });

  // (email is resolved server-side from the DB during Paystack initiation)

  const totalListings = listingsData?.meta?.total ?? 0;
  const storedPlan = typeof window !== 'undefined'
    ? (localStorage.getItem('velontri_plan') ?? 'free')
    : 'free';
  // If we just paid, use the paid plan immediately (localStorage was already updated by callback)
  const currentPlanId = paidPlan || storedPlan;
  const currentLimit = PLANS.find(p => p.id === currentPlanId)?.maxListings ?? 3;
  const atLimit = totalListings >= currentLimit;

  async function handleUpgrade(planId: string) {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:business@velontri.com';
      return;
    }
    setActivatingPlan(planId);
    try {
      // Build the callback URL — Paystack will redirect here after payment
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const fromParam = fromCreate ? '&from=create' : '';
      const callbackUrl = `${origin}/payment/callback?plan=${planId}${fromParam}`;

      const res = await apiClient.post<{
        data: { authorization_url: string; reference: string };
      }>('/subscriptions/paystack/initiate', {
        plan: planId,
        callback_url: callbackUrl,
      });

      const authUrl = (res.data as any)?.data?.authorization_url;
      const ref     = (res.data as any)?.data?.reference;
      if (!authUrl) throw new Error('No authorization URL returned');

      // Store pending payment so we can recover if the user gets logged out during checkout
      if (typeof window !== 'undefined') {
        localStorage.setItem('velontri_pending_payment', JSON.stringify({
          reference: ref,
          plan: planId,
          fromCreate,
          savedAt: Date.now(),
        }));
      }

      // Redirect to Paystack hosted checkout
      window.location.href = authUrl;
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to initiate payment. Please try again.';
      setPayError(msg);
      setActivatingPlan(null);
    }
  }

  const limitMax = currentPlanId === 'enterprise' ? Infinity
    : PLANS.find(p => p.id === currentPlanId)?.maxListings ?? 3;

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Subscription Plans</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Velontri earns through subscriptions — never from commissions or transaction fees.
        </p>
      </div>

      {/* Payment success banner */}
      {justPaid && paidPlan && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-black text-emerald-900 mb-1">
                Payment successful! {PLANS.find(p => p.id === paidPlan)?.name} plan activated.
              </p>
              <p className="text-[13px] text-emerald-700 mb-4">
                Your listing limit has been upgraded.
                {nextAction === 'create' ? ' You can now post your listing.' : ' Start posting more listings today.'}
              </p>
              <div className="flex flex-wrap gap-3">
                {nextAction === 'create' ? (
                  <button
                    onClick={() => router.push(ROUTES.user.create)}
                    className="inline-flex items-center gap-2 h-10 rounded-xl bg-emerald-600 px-5
                      text-[13px] font-bold text-white hover:bg-emerald-700 transition-colors"
                  >
                    Continue posting listing →
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(ROUTES.user.create)}
                    className="inline-flex items-center gap-2 h-10 rounded-xl bg-emerald-600 px-5
                      text-[13px] font-bold text-white hover:bg-emerald-700 transition-colors"
                  >
                    Post a listing →
                  </button>
                )}
                <button
                  onClick={() => router.push(ROUTES.user.overview)}
                  className="inline-flex items-center gap-2 h-10 rounded-xl border border-emerald-300
                    bg-white px-5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  Go to dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment error */}
      {payError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <div className="flex-shrink-0 h-5 w-5 text-red-500">✕</div>
          <div>
            <p className="text-[14px] font-bold text-red-800">Payment failed</p>
            <p className="text-[12px] text-red-600">{payError}</p>
          </div>
          <button onClick={() => setPayError('')}
            className="ml-auto text-[12px] text-red-500 hover:underline flex-shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Usage banner */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[13px] font-bold text-slate-900">
              Current plan:{' '}
              <span className="capitalize text-indigo-600">
                {PLANS.find(p => p.id === currentPlanId)?.name ?? 'Free'}
              </span>
            </p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {totalListings} / {limitMax === Infinity ? '∞' : limitMax} listings used
            </p>
          </div>
          {atLimit && (
            <div className="rounded-xl bg-amber-100 border border-amber-200 px-3 py-2 text-center flex-shrink-0">
              <p className="text-[11px] font-bold text-amber-700">Limit reached</p>
              <p className="text-[10px] text-amber-600">Upgrade to post more</p>
            </div>
          )}
        </div>
        <div className="mt-3">
          <div className="h-2 rounded-full bg-white overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: limitMax === Infinity
                  ? '5%'
                  : `${Math.min(100, (totalListings / limitMax) * 100)}%`,
                background: atLimit ? '#ef4444' : '#6366f1',
              }}
            />
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlanId;
          const isActivating = activatingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className="relative rounded-2xl border-2 p-5 flex flex-col transition-all"
              style={{
                borderColor: isCurrent ? plan.color : plan.border,
                background: isCurrent ? plan.bg : '#fff',
              }}
            >
              {/* Popular badge */}
              {'badge' in plan && !isCurrent && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5
                    text-[10px] font-black uppercase tracking-wide text-white"
                  style={{ background: plan.color }}
                >
                  {plan.badge}
                </span>
              )}

              {/* Current badge */}
              {isCurrent && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-emerald-500 px-3 py-0.5
                  text-[10px] font-black uppercase tracking-wide text-white">
                  Current
                </span>
              )}

              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: plan.color }}>{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[1.8rem] font-black text-slate-900">{plan.price}</span>
                  {plan.period && <span className="text-[12px] text-slate-400">{plan.period}</span>}
                </div>
                <p className="text-[12px] text-slate-500 mt-1">
                  {plan.maxListings === Infinity ? 'Unlimited listings' : `Up to ${plan.maxListings} listings`}
                </p>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-slate-600">
                    <Check className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isCurrent ? (
                <div className="h-10 rounded-xl border-2 flex items-center justify-center
                  text-[13px] font-bold"
                  style={{ borderColor: plan.color, color: plan.color }}>
                  Current Plan
                </div>
              ) : plan.id === 'enterprise' ? (
                <button
                  onClick={() => handleUpgrade('enterprise')}
                  className="h-10 rounded-xl flex items-center justify-center text-[13px] font-bold
                    text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: plan.color }}
                >
                  Contact Us
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isActivating}
                  className="h-10 rounded-xl flex items-center justify-center gap-1.5
                    text-[13px] font-bold text-white transition-all hover:opacity-90
                    active:scale-[0.98] disabled:opacity-60"
                  style={{ background: plan.color }}
                >
                  {isActivating ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                        strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  {isActivating ? 'Activating…' : 'Upgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-[12px] text-slate-400">
        All plans include the WhatsApp contact feature. Velontri never charges transaction fees or commissions.
      </p>
    </div>
  );
}
