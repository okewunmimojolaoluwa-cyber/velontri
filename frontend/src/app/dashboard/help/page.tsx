'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown, Search, MessageCircle } from 'lucide-react';

const CATEGORIES = [
  { id: 'all',            name: 'All Topics' },
  { id: 'getting-started', name: 'Getting Started' },
  { id: 'buying',         name: 'Buying' },
  { id: 'selling',        name: 'Selling' },
  { id: 'payments',       name: 'Payments' },
  { id: 'account',        name: 'Account' },
  { id: 'disputes',       name: 'Disputes' },
];

const FAQS = [
  // Getting started
  { id: 1,  q: 'How do I create an account?',
            a: 'Tap "Get started" on the homepage, fill in your name, email and password, then verify your email with the OTP we send you. It takes less than 2 minutes.',
            cat: 'getting-started' },
  { id: 2,  q: 'What countries does Velontri support?',
            a: 'Velontri operates in 12 African countries including Nigeria, Ghana, Kenya, South Africa, Tanzania and Uganda — with more launching soon.',
            cat: 'getting-started' },
  { id: 3,  q: 'Is Velontri free to use?',
            a: 'Yes. You can browse and buy for free. Sellers get 3 free listings on the Free plan. Paid plans (Starter, Business, Enterprise) unlock more listing slots.',
            cat: 'getting-started' },

  // Buying
  { id: 4,  q: 'How do I buy something on Velontri?',
            a: 'Find an item you like, open the listing, and tap "Chat on WhatsApp" to contact the seller directly. Agree on price, meet in a public place, inspect the item, then pay in person.',
            cat: 'buying' },
  { id: 5,  q: 'How do I save a listing to view later?',
            a: 'Tap the heart (♥) icon on any listing. It will be saved to your "Saved" page in the dashboard.',
            cat: 'buying' },
  { id: 6,  q: 'What if I get scammed?',
            a: 'Always meet sellers in person, inspect items before paying, and never send money upfront. Velontri does not handle payments between buyers and sellers — all transactions are direct.',
            cat: 'buying' },
  { id: 7,  q: 'Can I message sellers inside the app?',
            a: 'The primary contact method is WhatsApp — tap "Chat on WhatsApp" on any listing. In-app messaging is also available for certain listings.',
            cat: 'buying' },

  // Selling
  { id: 8,  q: 'How do I list an item for sale?',
            a: 'Go to your dashboard, click "Post a listing", fill in the details (title, category, price, location, WhatsApp number), add photos, and publish. Your listing goes live immediately.',
            cat: 'selling' },
  { id: 9,  q: 'How many listings can I post?',
            a: 'Free plan: 3 listings. Starter (₦2,500/mo): 20 listings. Business (₦7,500/mo): 100 listings. Enterprise: unlimited. Upgrade from the Subscription page.',
            cat: 'selling' },
  { id: 10, q: 'Why was my listing archived?',
            a: 'If your paid subscription expires, listings beyond the free limit (3) are automatically archived. Renew your subscription to restore them instantly.',
            cat: 'selling' },
  { id: 11, q: 'How do I edit or delete a listing?',
            a: 'Go to My Listings in your dashboard, find the listing, then click Edit or Delete. Deletion is permanent.',
            cat: 'selling' },
  { id: 12, q: 'Does Velontri take a commission on my sales?',
            a: 'No. Velontri never charges a commission or transaction fee. Revenue comes only from subscription plans. You keep 100% of your sale price.',
            cat: 'selling' },

  // Payments / Subscriptions
  { id: 13, q: 'How do I upgrade my subscription?',
            a: 'Go to Dashboard → Subscription. Choose a plan and pay securely via Paystack (card, bank transfer, USSD). Your plan activates immediately after payment.',
            cat: 'payments' },
  { id: 14, q: 'What payment methods are accepted for subscriptions?',
            a: 'We accept cards (Visa, Mastercard), bank transfers, and USSD via Paystack. All payments are in Nigerian Naira (₦).',
            cat: 'payments' },
  { id: 15, q: 'Does my subscription auto-renew?',
            a: 'No. Subscriptions are one-off monthly payments. You will need to renew manually each month. We will send a reminder before your plan expires.',
            cat: 'payments' },

  // Account
  { id: 16, q: 'How do I reset my password?',
            a: 'Click "Forgot Password" on the login page. Enter your email and we\'ll send a reset link within a few seconds.',
            cat: 'account' },
  { id: 17, q: 'How do I update my WhatsApp number on my listings?',
            a: 'Edit each listing individually and update the WhatsApp number field. Make sure the number is in international format (e.g. +2348012345678).',
            cat: 'account' },
  { id: 18, q: 'How do I add a profile photo?',
            a: 'Go to Dashboard → Profile → tap the avatar image and upload a photo from your device.',
            cat: 'account' },

  // Disputes
  { id: 19, q: 'What do I do if a seller is fraudulent?',
            a: 'Report the listing using the "Report" button on the listing page. Our moderation team reviews reports within 24 hours and takes action.',
            cat: 'disputes' },
  { id: 20, q: 'Can I get a refund through Velontri?',
            a: 'Velontri does not process payments between buyers and sellers, so we cannot issue refunds. All payment disputes should be resolved directly with the seller or through your bank.',
            cat: 'disputes' },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden rounded-xl border transition-all ${open ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
      <button onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <p className={`text-[14px] font-semibold leading-snug ${open ? 'text-indigo-700' : 'text-slate-900'}`}>
          {question}
        </p>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-[13px] text-slate-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function UserHelpPage() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');

  const filtered = FAQS.filter(f =>
    (cat === 'all' || f.cat === cat) &&
    (f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Help Center</h1>
        <p className="text-[12px] text-slate-400 mt-0.5">Find answers to common questions</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search help topics…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[14px]
            text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400
            focus:ring-2 focus:ring-indigo-500/10 transition-all"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        {/* Category sidebar */}
        <div className="space-y-1">
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={`w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] font-medium transition-all ${
                cat === c.id
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}>
              {c.name}
            </button>
          ))}

          {/* Contact support */}
          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-indigo-600" />
              <p className="text-[13px] font-bold text-indigo-900">Need more help?</p>
            </div>
            <p className="text-[11px] text-indigo-700 mb-3 leading-relaxed">
              Our support team is available 24/7.
            </p>
            <a href="mailto:support@velontri.com"
              className="flex w-full h-8 items-center justify-center rounded-lg bg-indigo-600 text-[12px]
                font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
              Contact Support
            </a>
          </div>
        </div>

        {/* FAQ list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
              <HelpCircle className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-[14px] font-semibold text-slate-500">No results for &quot;{search}&quot;</p>
            </div>
          ) : (
            filtered.map(f => <FAQItem key={f.id} question={f.q} answer={f.a} />)
          )}
        </div>
      </div>
    </div>
  );
}
