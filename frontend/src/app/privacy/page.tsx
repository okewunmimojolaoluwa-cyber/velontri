import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Velontri',
  description: 'Learn how Velontri collects, uses, and protects your personal data.',
};

const LAST_UPDATED = 'August 1, 2026';

export default function PrivacyPolicyPage() {
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
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[12px] font-semibold text-indigo-600 mb-4">
            Legal
          </div>
          <h1 className="text-[2rem] font-black text-slate-900 tracking-tight leading-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-[14px] text-slate-500">
            Last updated: <strong>{LAST_UPDATED}</strong>
          </p>
        </div>

        {/* Intro card */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 mb-8">
          <p className="text-[14px] text-indigo-800 leading-relaxed">
            Velontri (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your
            personal data. This Privacy Policy explains what information we collect, how we use it,
            who we share it with, and the rights you have over your data when you use our platform at{' '}
            <strong>velontri.com</strong> and our mobile apps.
          </p>
        </div>

        <div className="space-y-8">
          <Section title="1. Who We Are">
            <p>
              Velontri is a peer-to-peer commerce platform that connects buyers and sellers across
              Africa, starting with Nigeria. Our registered business address is Lagos, Nigeria. For
              privacy enquiries, contact us at{' '}
              <a href="mailto:privacy@velontri.com" className="text-indigo-600 hover:underline">
                privacy@velontri.com
              </a>
              .
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p className="mb-3">We collect information in three ways:</p>
            <SubSection title="Information you provide directly">
              <ul>
                <li><strong>Account data:</strong> Full name, email address, phone number, country, password (stored as a secure hash).</li>
                <li><strong>Profile data:</strong> Bio, profile photo, city, state.</li>
                <li><strong>Listings:</strong> Title, description, price, category, images, WhatsApp number, location.</li>
                <li><strong>Verification data:</strong> Government-issued ID, business registration documents (for seller verification only).</li>
                <li><strong>Messages:</strong> In-app messages sent between buyers and sellers.</li>
                <li><strong>Subscription &amp; payment:</strong> Subscription plan choice. We do not store card details — payments are handled by Paystack.</li>
              </ul>
            </SubSection>
            <SubSection title="Information collected automatically">
              <ul>
                <li>IP address and approximate location (country/city level).</li>
                <li>Browser type, device type, operating system.</li>
                <li>Pages visited, search queries, listing clicks, session duration.</li>
                <li>Referral URLs and UTM parameters.</li>
              </ul>
            </SubSection>
            <SubSection title="Information from third parties">
              <ul>
                <li>If you sign in with Google, we receive your name, email, and profile photo from Google OAuth.</li>
                <li>Paystack may share transaction confirmation data with us after a subscription payment.</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul>
              <li><strong>To operate the platform:</strong> Register your account, display your listings, enable messaging between buyers and sellers.</li>
              <li><strong>To verify sellers:</strong> Review KYC documents and grant the Verified Seller badge.</li>
              <li><strong>To process subscriptions:</strong> Manage plan activation, renewal reminders, and listing quotas.</li>
              <li><strong>To communicate with you:</strong> Send transactional emails (OTPs, listing approval/rejection, password reset), platform announcements.</li>
              <li><strong>To improve the platform:</strong> Analyse usage patterns, debug errors, improve search relevance and AI recommendations.</li>
              <li><strong>To keep the platform safe:</strong> Detect fraud, spam, and policy violations; enforce our Terms of Service.</li>
              <li><strong>Legal compliance:</strong> Respond to lawful requests from Nigerian authorities or courts.</li>
            </ul>
          </Section>

          <Section title="4. Legal Basis for Processing">
            <p>We process your data on the following legal grounds:</p>
            <ul>
              <li><strong>Contract:</strong> Processing necessary to provide the service you signed up for.</li>
              <li><strong>Legitimate interests:</strong> Platform security, fraud prevention, improving our service.</li>
              <li><strong>Consent:</strong> Marketing emails (you may withdraw consent at any time).</li>
              <li><strong>Legal obligation:</strong> Compliance with applicable Nigerian law.</li>
            </ul>
          </Section>

          <Section title="5. How We Share Your Information">
            <p>We do not sell your personal data. We share it only in these circumstances:</p>
            <ul>
              <li><strong>With other users:</strong> Your public profile (name, bio, city, listings) is visible to other Velontri users. Your email and phone are <em>not</em> shown publicly unless you include them in a listing.</li>
              <li><strong>With service providers:</strong> Paystack (payments), Brevo/SendGrid (email delivery), Supabase (database hosting), Cloudflare (CDN/security). All providers are bound by data processing agreements.</li>
              <li><strong>For legal reasons:</strong> Where required by Nigerian law, court order, or to protect the safety of users or the public.</li>
              <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, user data may be transferred with appropriate notice.</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <ul>
              <li><strong>Active accounts:</strong> Data is retained for as long as your account is active.</li>
              <li><strong>Deactivated accounts:</strong> Account data is retained for 90 days after deactivation, then deleted, except where legal obligations require longer retention.</li>
              <li><strong>KYC documents:</strong> Retained for 5 years from submission in line with Nigerian AML regulations.</li>
              <li><strong>Messages:</strong> Retained for 12 months, then automatically deleted.</li>
              <li><strong>Analytics data:</strong> Aggregated, anonymised data may be retained indefinitely.</li>
            </ul>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your location, you may have the following rights:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Update or correct inaccurate data via your Profile settings.</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data (Dashboard &gt; Settings &gt; Deactivate Account, or email us).</li>
              <li><strong>Portability:</strong> Request an export of your data in machine-readable format.</li>
              <li><strong>Objection:</strong> Object to processing for direct marketing or legitimate interest purposes.</li>
              <li><strong>Restriction:</strong> Request that we limit processing while a dispute is resolved.</li>
            </ul>
            <p className="mt-3">
              To exercise any right, email{' '}
              <a href="mailto:privacy@velontri.com" className="text-indigo-600 hover:underline">
                privacy@velontri.com
              </a>{' '}
              with &ldquo;Privacy Request&rdquo; in the subject. We will respond within 30 days.
            </p>
          </Section>

          <Section title="8. Cookies and Tracking">
            <p>We use the following types of cookies and local storage:</p>
            <ul>
              <li><strong>Essential:</strong> Authentication tokens (stored in localStorage) required for you to stay logged in.</li>
              <li><strong>Functional:</strong> User preferences such as theme and homepage section order.</li>
              <li><strong>Analytics:</strong> Anonymous usage data collected by our own analytics system to improve the platform. No third-party trackers (e.g. Google Analytics, Facebook Pixel) are used.</li>
            </ul>
            <p className="mt-2">
              You can clear cookies and local storage via your browser settings. This will log you out of Velontri.
            </p>
          </Section>

          <Section title="9. Data Security">
            <p>
              We implement industry-standard security measures including HTTPS/TLS encryption in transit,
              bcrypt password hashing, JWT authentication with short-lived access tokens, and row-level
              security on our Supabase PostgreSQL database. Profile photos are stored as base64 data URLs
              in the database and are not hosted on third-party public CDNs.
            </p>
            <p className="mt-2">
              Despite these measures, no system is 100% secure. If you suspect unauthorised access to your
              account, change your password immediately and contact{' '}
              <a href="mailto:security@velontri.com" className="text-indigo-600 hover:underline">
                security@velontri.com
              </a>
              .
            </p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>
              Velontri is not directed at children under the age of 13. We do not knowingly collect
              personal data from children. If we become aware that a child has provided us with personal
              information, we will delete it promptly. If you believe a child has registered, please email
              us at{' '}
              <a href="mailto:privacy@velontri.com" className="text-indigo-600 hover:underline">
                privacy@velontri.com
              </a>
              .
            </p>
          </Section>

          <Section title="11. International Transfers">
            <p>
              Our primary infrastructure is hosted in the European Union (Germany) via Supabase and our
              cloud provider. By using Velontri, you consent to the transfer and processing of your data
              in these jurisdictions. We ensure all transfers comply with applicable data protection law
              and use standard contractual clauses where required.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will
              notify you by email or via a platform announcement at least 14 days before the changes take
              effect. Continued use of Velontri after the effective date constitutes acceptance of the
              updated policy.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>For any privacy-related questions or requests:</p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-[13px] space-y-1">
              <p><strong>Email:</strong>{' '}<a href="mailto:privacy@velontri.com" className="text-indigo-600 hover:underline">privacy@velontri.com</a></p>
              <p><strong>Subject line:</strong> Privacy Request</p>
              <p><strong>Response time:</strong> Within 30 days</p>
              <p><strong>Platform:</strong> velontri.com</p>
            </div>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap items-center gap-4 text-[12px] text-slate-400">
          <span>© {new Date().getFullYear()} Velontri. All rights reserved.</span>
          <Link href="/terms" className="hover:text-slate-700 transition-colors no-underline">Terms of Service</Link>
          <Link href="/privacy" className="text-indigo-600 font-semibold no-underline">Privacy Policy</Link>
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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="font-semibold text-slate-800 mb-2">{title}</p>
      <div className="text-[14px] text-slate-600 [&_ul]:space-y-1.5 [&_ul]:list-none [&_ul]:pl-0 [&_li]:flex [&_li]:gap-2 [&_li]:before:content-['–'] [&_li]:before:text-slate-300 [&_li]:before:flex-shrink-0">
        {children}
      </div>
    </div>
  );
}
