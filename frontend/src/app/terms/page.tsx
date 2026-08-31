import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Velontri',
  description: 'Read the Velontri Terms of Service before using our platform.',
};

const LAST_UPDATED = 'August 1, 2026';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span className="text-[18px] font-black text-indigo-600 tracking-tight">Velontri</span>
          </Link>
          <Link
            href="/"
            className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors no-underline"
          >
            Back to home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
        {/* Title block */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-600 mb-4">
            Legal
          </div>
          <h1 className="text-[2rem] font-black text-slate-900 tracking-tight leading-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-[14px] text-slate-500">
            Last updated: <strong>{LAST_UPDATED}</strong>
          </p>
        </div>

        {/* Intro card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-8">
          <p className="text-[14px] text-slate-700 leading-relaxed">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Velontri
            (&ldquo;the platform&rdquo;), operated by Velontri (&ldquo;we&rdquo;, &ldquo;our&rdquo;,
            &ldquo;us&rdquo;). By registering an account or using the platform, you agree to be bound
            by these Terms. If you do not agree, do not use Velontri.
          </p>
        </div>

        <div className="space-y-8">
          <Section title="1. Eligibility">
            <p>
              You must be at least 18 years old to create an account and use Velontri. By registering,
              you confirm that you are at least 18 and have the legal capacity to enter into a binding
              agreement. We reserve the right to terminate accounts we reasonably believe belong to
              minors.
            </p>
          </Section>

          <Section title="2. Your Account">
            <ul>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must provide accurate, current, and complete registration information.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must notify us immediately at <a href="mailto:support@velontri.com" className="text-indigo-600 hover:underline">support@velontri.com</a> if you suspect unauthorised access.</li>
              <li>You may only hold one personal account. Creating multiple accounts to circumvent bans or limits is prohibited.</li>
            </ul>
          </Section>

          <Section title="3. The Velontri Marketplace">
            <p className="mb-2">
              Velontri is a <strong>peer-to-peer marketplace</strong>. We provide the platform for
              buyers and sellers to connect — we are not a party to any transaction between users.
            </p>
            <ul>
              <li>Sellers list items and services; buyers contact sellers directly via WhatsApp or in-app messaging.</li>
              <li>Velontri does not hold funds, guarantee delivery, or provide buyer protection for off-platform transactions.</li>
              <li>All transactions between users are conducted at your own risk. We strongly recommend meeting in a safe, public location and inspecting goods before payment.</li>
              <li>Velontri is not responsible for the quality, safety, legality, or accuracy of listings posted by users.</li>
            </ul>
          </Section>

          <Section title="4. Prohibited Content and Activities">
            <p className="mb-2">You must not use Velontri to list, sell, or promote:</p>
            <ul>
              <li>Illegal goods or services, including controlled substances, counterfeit products, stolen goods, or pirated software.</li>
              <li>Weapons, explosives, or dangerous materials (including unlicensed firearms and ammunition).</li>
              <li>Adult content, pornography, or sexually explicit material.</li>
              <li>Human trafficking, exploitation, or any content that endangers persons.</li>
              <li>Fraudulent listings, scam services, or misleading descriptions.</li>
              <li>Content that infringes intellectual property rights (copyrights, trademarks, patents).</li>
              <li>Hate speech, harassment, or discriminatory content based on race, ethnicity, religion, gender, sexual orientation, disability, or nationality.</li>
            </ul>
            <p className="mt-2">
              Violations will result in immediate listing removal, account suspension, and may be
              reported to Nigerian law enforcement authorities.
            </p>
          </Section>

          <Section title="5. Seller Responsibilities">
            <ul>
              <li>You are solely responsible for the accuracy, legality, and quality of your listings.</li>
              <li>You must honour prices and descriptions as listed. Bait-and-switch tactics are prohibited.</li>
              <li>You must respond to buyer enquiries in a timely manner.</li>
              <li>You are responsible for any taxes applicable to your sales under Nigerian law.</li>
              <li>Sellers who receive verified status must maintain the standards that earned that status.</li>
            </ul>
          </Section>

          <Section title="6. Subscriptions and Fees">
            <ul>
              <li>Velontri offers a free tier with a limited number of active listings and a paid subscription for higher quotas and features.</li>
              <li>Subscription fees are charged in Nigerian Naira (NGN) and processed by Paystack.</li>
              <li>Subscriptions are <strong>non-auto-renewing</strong> — you must manually renew each month.</li>
              <li>Fees are non-refundable except where required by Nigerian consumer protection law.</li>
              <li>We reserve the right to change pricing with at least 30 days&apos; notice via email and in-app announcement.</li>
              <li>Velontri does not charge a commission on sales. You keep 100% of your sale proceeds.</li>
            </ul>
          </Section>

          <Section title="7. Content You Post">
            <p>
              By posting content on Velontri (listings, profile information, messages, reviews), you
              grant us a non-exclusive, worldwide, royalty-free, sublicensable licence to use, display,
              reproduce, and distribute that content for the purpose of operating and improving the
              platform.
            </p>
            <p className="mt-2">
              You retain ownership of your content. We do not claim ownership over anything you post.
            </p>
          </Section>

          <Section title="8. Moderation and Enforcement">
            <ul>
              <li>We reserve the right to remove any listing or content that violates these Terms, our community guidelines, or applicable law, without prior notice.</li>
              <li>We may suspend or permanently terminate accounts for serious or repeated violations.</li>
              <li>We may take action on reported content based on our moderators&apos; reasonable judgement.</li>
              <li>You may appeal a moderation decision by contacting <a href="mailto:support@velontri.com" className="text-indigo-600 hover:underline">support@velontri.com</a> within 14 days.</li>
            </ul>
          </Section>

          <Section title="9. Intellectual Property">
            <p>
              The Velontri name, logo, platform design, and codebase are the intellectual property of
              Velontri. You may not reproduce, copy, or use our brand assets without written permission.
            </p>
            <p className="mt-2">
              If you believe content on Velontri infringes your intellectual property rights, contact us
              at <a href="mailto:legal@velontri.com" className="text-indigo-600 hover:underline">legal@velontri.com</a> with
              evidence of your claim.
            </p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p>
              Velontri is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties
              of any kind, express or implied. We do not warrant that the platform will be uninterrupted,
              error-free, or secure. We are not responsible for any losses arising from your use of
              the platform, transactions with other users, or reliance on listings posted by others.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Velontri's total liability to you for any claim
              arising from your use of the platform shall not exceed the amount you paid to Velontri
              in the 12 months preceding the claim. We are not liable for indirect, incidental,
              special, or consequential damages of any kind.
            </p>
          </Section>

          <Section title="12. Governing Law and Dispute Resolution">
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes
              shall first be addressed through our support team at{' '}
              <a href="mailto:support@velontri.com" className="text-indigo-600 hover:underline">support@velontri.com</a>.
              If unresolved after 30 days, disputes shall be submitted to binding arbitration in Lagos,
              Nigeria in accordance with applicable Nigerian arbitration law, except where prohibited
              by statute.
            </p>
          </Section>

          <Section title="13. Changes to These Terms">
            <p>
              We may update these Terms from time to time. We will notify you of material changes by
              email and platform announcement at least 14 days before they take effect. Continued use
              after the effective date constitutes acceptance. If you do not agree to the revised Terms,
              you must stop using Velontri and delete your account.
            </p>
          </Section>

          <Section title="14. Termination">
            <p>
              You may delete your account at any time via Dashboard &gt; Settings &gt; Deactivate Account.
              We may suspend or terminate your account immediately for material violations of these Terms,
              with or without notice. Upon termination, your right to use the platform ceases immediately.
              Sections 7, 9, 10, 11, and 12 survive termination.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>Questions about these Terms:</p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-[13px] space-y-1">
              <p><strong>Email:</strong>{' '}<a href="mailto:legal@velontri.com" className="text-indigo-600 hover:underline">legal@velontri.com</a></p>
              <p><strong>Support:</strong>{' '}<a href="mailto:support@velontri.com" className="text-indigo-600 hover:underline">support@velontri.com</a></p>
              <p><strong>Platform:</strong> velontri.com</p>
            </div>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap items-center gap-4 text-[12px] text-slate-400">
          <span>© {new Date().getFullYear()} Velontri. All rights reserved.</span>
          <Link href="/privacy" className="hover:text-slate-700 transition-colors no-underline">Privacy Policy</Link>
          <Link href="/terms" className="text-indigo-600 font-semibold no-underline">Terms of Service</Link>
          <Link href="/" className="hover:text-slate-700 transition-colors no-underline">Back to Velontri</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-black text-slate-900 mb-3 pb-2 border-b border-slate-200">
        {title}
      </h2>
      <div className="text-[14px] text-slate-600 leading-relaxed space-y-2 [&_ul]:space-y-1.5 [&_ul]:list-none [&_ul]:pl-0 [&_li]:flex [&_li]:gap-2 [&_li]:before:content-['–'] [&_li]:before:text-slate-300 [&_li]:before:flex-shrink-0">
        {children}
      </div>
    </section>
  );
}
