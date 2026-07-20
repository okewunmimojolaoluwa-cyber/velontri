'use client';

import Link from 'next/link';
import { Check, Zap, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { ROUTES } from '@/config/routes';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '₦0',
    period: 'forever',
    maxListings: 3,
    color: '#64748b',
    borderColor: '#e2e8f0',
    bgColor: '#f8fafc',
    features: [
      'Up to 3 active listings',
      'Chat buyers on WhatsApp',
      'Create one store',
      'Basic analytics',
      'Standard search visibility',
    ],
    cta: 'Get started free',
    ctaHref: ROUTES.register,
    ctaStyle: 'border',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '₦2,500',
    period: '/month',
    maxListings: 20,
    color: '#4F46E5',
    borderColor: '#4F46E5',
    bgColor: '#eef2ff',
    badge: 'Most Popular',
    features: [
      'Up to 20 active listings',
      'Chat buyers on WhatsApp',
      'Create one store',
      'Higher search visibility',
      'Priority customer support',
      'Featured badge on listings',
    ],
    cta: 'Start with Starter',
    ctaHref: ROUTES.register,
    ctaStyle: 'filled',
  },
  {
    id: 'business',
    name: 'Business',
    price: '₦7,500',
    period: '/month',
    maxListings: 100,
    color: '#7C3AED',
    borderColor: '#7C3AED',
    bgColor: '#f5f3ff',
    features: [
      'Up to 100 active listings',
      'Store branding & customization',
      'Premium search ranking',
      'Advanced analytics',
      'Priority moderation',
      'Bulk listing management',
    ],
    cta: 'Grow your business',
    ctaHref: ROUTES.register,
    ctaStyle: 'filled',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    maxListings: Infinity,
    color: '#D97706',
    borderColor: '#D97706',
    bgColor: '#fffbeb',
    features: [
      'Unlimited active listings',
      'Multi-store support',
      'Verified Business Badge',
      'Top search placement',
      'Homepage promotion eligibility',
      'Dedicated account manager',
      'Advanced business analytics',
      'API access (future-ready)',
    ],
    cta: 'Contact us',
    ctaHref: 'mailto:business@velontri.com',
    ctaStyle: 'filled',
  },
] as const;

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        {/* Back link */}
        <Link href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500
            no-underline hover:text-slate-800 transition-colors mb-10">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200
            px-4 py-1.5 mb-5">
            <Zap className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
              Subscription Plans
            </span>
          </div>
          <h1 className="text-[2.25rem] font-black text-slate-900 tracking-tight leading-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-[16px] text-slate-500 max-w-lg mx-auto leading-relaxed">
            Velontri earns through subscriptions — never from commissions or transaction fees.
            Post your first listing for free.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className="relative flex flex-col rounded-2xl border-2 p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                borderColor: plan.borderColor,
                background: '#fff',
              }}
            >
              {/* Popular badge */}
              {'badge' in plan && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full px-4 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-md"
                    style={{ background: plan.color }}>
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan name + price */}
              <div className="mb-6">
                <span className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: plan.color }}>
                  {plan.name}
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[2rem] font-black text-slate-900 leading-none">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-[13px] text-slate-400">{plan.period}</span>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] font-medium"
                  style={{ color: plan.color }}>
                  {plan.maxListings === Infinity
                    ? 'Unlimited listings'
                    : `Up to ${plan.maxListings} listings`}
                </p>
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-2.5 mb-7">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-slate-600">
                    <Check className="h-4 w-4 flex-shrink-0 mt-0.5"
                      style={{ color: plan.color }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.ctaHref}
                className="flex h-11 items-center justify-center rounded-xl text-[13px] font-bold
                  no-underline transition-all hover:opacity-90 active:scale-[0.98]"
                style={
                  plan.ctaStyle === 'filled'
                    ? { background: plan.color, color: '#fff' }
                    : {
                        border: `2px solid ${plan.color}`,
                        color: plan.color,
                        background: 'transparent',
                      }
                }
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ-style note */}
        <div className="mt-14 rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-[17px] font-black text-slate-900 mb-6 text-center">
            Frequently asked questions
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                q: 'How do buyers contact sellers?',
                a: 'Every listing shows a green WhatsApp button. Buyers tap it and chat with you directly — no middleman, no delays.',
              },
              {
                q: 'What happens when I hit my listing limit?',
                a: 'You can still manage existing listings but cannot publish new ones until you upgrade or remove old listings.',
              },
              {
                q: 'Can I downgrade my plan?',
                a: 'Yes. You can downgrade at any time. Your listings stay active until your current billing period ends.',
              },
              {
                q: 'Is there a free trial?',
                a: 'The Free plan is permanent — no credit card required. Upgrade only when you need more than 3 active listings.',
              },
              {
                q: 'Can I switch plans at any time?',
                a: 'Yes. Upgrade instantly and your new listing limit applies immediately. Downgrade takes effect at the next billing cycle.',
              },
              {
                q: 'What countries does Velontri support?',
                a: 'Velontri is live in Nigeria, Ghana, Kenya, South Africa, Tanzania, Uganda and 6 more African countries — with more launching soon.',
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <p className="text-[13px] font-bold text-slate-900 mb-1.5">{q}</p>
                <p className="text-[13px] text-slate-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <p className="text-[14px] text-slate-500 mb-4">
            Already have an account?
          </p>
          <Link href={ROUTES.user.subscription}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6
              text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            <Zap className="h-4 w-4" />
            Manage your subscription
          </Link>
        </div>

      </div>
    </div>
  );
}
