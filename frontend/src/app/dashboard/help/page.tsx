'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlass, CaretDown, CaretUp, Question, ChatCircle, EnvelopeSimple, Shield } from '@phosphor-icons/react';

type Category = 'all' | 'buying' | 'selling' | 'payments' | 'account' | 'safety';

const FAQS: { id: number; q: string; a: string; cat: Category }[] = [
  // Buying
  { id: 1, q: 'How do I contact a seller?', a: 'Tap the WhatsApp button on any listing to open a chat with the seller directly. You can also send an in-app message by tapping "Message Seller". WhatsApp is the fastest way to get a response.', cat: 'buying' },
  { id: 2, q: 'Is it safe to buy on Velontri?', a: 'We recommend meeting sellers in a safe, well-lit public place. Inspect items before paying. Never send money in advance to someone you have not met. Use our in-app messaging to keep a record of all communication.', cat: 'buying' },
  { id: 3, q: 'Can I negotiate prices?', a: 'Yes, prices are negotiable between buyers and sellers. Use WhatsApp or in-app messages to discuss pricing directly with the seller.', cat: 'buying' },
  { id: 4, q: 'How do I save listings to view later?', a: 'Tap the heart icon on any listing card to save it. View all your saved listings under Dashboard → Saved.', cat: 'buying' },
  { id: 5, q: 'What should I do if a seller is unresponsive?', a: 'If a seller does not respond within 48 hours, try WhatsApp directly. If you suspect fraud or misrepresentation, report the listing using the flag icon on the listing page.', cat: 'buying' },

  // Selling
  { id: 6, q: 'How do I post a listing?', a: 'Go to Dashboard → My Listings → New listing. Fill in the title, description, price, category, and photos. Submit for review — our moderation team approves listings within a few hours.', cat: 'selling' },
  { id: 7, q: 'How many listings can I post?', a: 'Free accounts can post up to 3 active listings. Upgrade to a paid plan for higher limits — up to 50 or unlimited listings depending on your plan.', cat: 'selling' },
  { id: 8, q: 'Why was my listing rejected?', a: 'Listings are rejected if they violate our content policies (prohibited items, misleading descriptions, poor quality images), or if required information is missing. You will receive a rejection reason and can edit and resubmit.', cat: 'selling' },
  { id: 9, q: 'How do I get the Verified Seller badge?', a: 'Go to Dashboard → Verification and submit your government-issued ID and any required business documents. Our team reviews within 1-3 business days. Verified sellers get a badge on all their listings.', cat: 'selling' },
  { id: 10, q: 'Why was my listing archived?', a: 'If your paid subscription expires, listings beyond the free limit (3) are automatically archived. Renew your subscription to restore them instantly.', cat: 'selling' },
  { id: 11, q: 'How do I edit or delete a listing?', a: 'Go to My Listings in your dashboard, find the listing, then click Edit or Delete. Deletion is permanent.', cat: 'selling' },
  { id: 12, q: 'Does Velontri take a commission on my sales?', a: 'No. Velontri never charges a commission or transaction fee. Revenue comes only from subscription plans. You keep 100% of your sale price.', cat: 'selling' },

  // Payments / Subscriptions
  { id: 13, q: 'How do I upgrade my subscription?', a: 'Go to Dashboard → Subscription. Choose a plan and pay securely via Paystack (card, bank transfer, USSD). Your plan activates immediately after payment.', cat: 'payments' },
  { id: 14, q: 'What payment methods are accepted for subscriptions?', a: 'We accept cards (Visa, Mastercard), bank transfers, and USSD via Paystack. All payments are in Nigerian Naira (₦).', cat: 'payments' },
  { id: 15, q: 'Does my subscription auto-renew?', a: 'No. Subscriptions are one-off monthly payments. You will need to renew manually each month. We will send a reminder before your plan expires.', cat: 'payments' },

  // Account
  { id: 16, q: 'How do I reset my password?', a: 'Click "Forgot Password" on the login page. Enter your email and we\'ll send a reset link within a few seconds.', cat: 'account' },
  { id: 17, q: 'How do I update my WhatsApp number on my listings?', a: 'Edit each listing individually and update the WhatsApp number field. Make sure the number is in international format (e.g. +2348012345678).', cat: 'account' },
  { id: 18, q: 'How do I add a profile photo?', a: 'Go to Dashboard → Profile → tap the avatar image and upload a photo from your device.', cat: 'account' },
  { id: 19, q: 'How do I delete my account?', a: 'Go to Dashboard → Settings → Account tab → Deactivate Account. Enter your password to confirm. Your data will be retained for 90 days then permanently deleted. You can email privacy@velontri.com to request immediate deletion.', cat: 'account' },

  // Safety
  { id: 20, q: 'What should I do if I receive a suspicious message?', a: 'Do not click any links or share personal/financial information. Report the user via the three-dot menu on their listing or message. We investigate all reports within 24 hours.', cat: 'safety' },
  { id: 21, q: 'How does Velontri protect my data?', a: 'We use HTTPS/TLS encryption, bcrypt password hashing, and JWT authentication. We do not sell your personal data. Read our full Privacy Policy for details.', cat: 'safety' },
  { id: 22, q: 'How do I report a fraudulent listing?', a: 'Tap the flag icon on the listing detail page. Select "Fraud or scam" as the reason and add any details. Our moderation team reviews reports within 24 hours.', cat: 'safety' },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'buying', label: 'Buying' },
  { id: 'selling', label: 'Selling' },
  { id: 'payments', label: 'Subscriptions' },
  { id: 'account', label: 'Account' },
  { id: 'safety', label: 'Safety' },
];

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<Category>('all');
  const [open, setOpen] = useState<number | null>(null);

  const filtered = FAQS.filter(f => {
    const matchesCat = cat === 'all' || f.cat === cat;
    const matchesSearch = !search.trim() ||
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Help Center</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Answers to frequently asked questions</p>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search help articles…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px] text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => { setCat(c.id); setSearch(''); }}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
              cat === c.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* FAQ list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Question className="h-10 w-10 text-slate-200 mx-auto mb-2" />
            <p className="text-[14px] font-semibold text-slate-900 mb-1">No results found</p>
            <p className="text-[12px] text-slate-400">Try a different search term or category</p>
          </div>
        ) : (
          filtered.map(f => (
            <div key={f.id}>
              <button
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setOpen(open === f.id ? null : f.id)}
              >
                <span className="text-[14px] font-semibold text-slate-900 leading-snug">{f.q}</span>
                {open === f.id
                  ? <CaretUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  : <CaretDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                }
              </button>
              {open === f.id && (
                <div className="px-5 pb-4">
                  <p className="text-[13px] text-slate-600 leading-relaxed">{f.a}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Contact support card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <p className="text-[14px] font-bold text-slate-900">Still need help?</p>
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Our support team is available Monday to Friday, 9am to 6pm WAT. We aim to respond within 4 business hours.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="mailto:support@velontri.com"
            className="inline-flex items-center gap-2 h-9 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors"
          >
            <EnvelopeSimple className="h-3.5 w-3.5" />
            Email support
          </a>
          <Link
            href="/dashboard/disputes"
            className="inline-flex items-center gap-2 h-9 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 no-underline hover:bg-slate-50 transition-colors"
          >
            <ChatCircle className="h-3.5 w-3.5" />
            Report a dispute
          </Link>
        </div>
      </div>

      {/* Legal links */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-semibold text-slate-600">Legal</span>
        </span>
        <Link href="/privacy" className="hover:text-indigo-600 hover:underline no-underline transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-indigo-600 hover:underline no-underline transition-colors">Terms of Service</Link>
        <a href="mailto:privacy@velontri.com" className="hover:text-indigo-600 hover:underline transition-colors">privacy@velontri.com</a>
        <a href="mailto:legal@velontri.com" className="hover:text-indigo-600 hover:underline transition-colors">legal@velontri.com</a>
      </div>
    </div>
  );
}
