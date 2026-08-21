import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import dynamic from 'next/dynamic';
import { Providers } from '@/app/providers';
import './globals.css';

// Load BottomNav client-only (it uses cookies/localStorage) to prevent hydration mismatch
const BottomNav = dynamic(
  () => import('@/components/layout/bottom-nav').then(m => ({ default: m.BottomNav })),
  { ssr: false }
);

// Maintenance banner — client-only, checks API on each load
const MaintenanceBanner = dynamic(
  () => import('@/components/ui/maintenance-banner').then(m => ({ default: m.MaintenanceBanner })),
  { ssr: false }
);

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: {
    default: 'Velontri Nigeria | Buy & Sell Products, Cars, Property & Services',
    template: `%s | Velontri`,
  },
  description:
    'Velontri is Nigeria\'s leading marketplace. Buy and sell cars, property, phones, fashion, furniture, jobs and services across Lagos, Abuja, Port Harcourt, Kano, Ibadan and all Nigerian states. Connect directly with sellers on WhatsApp — no agent fees, no commissions.',
  keywords: [
    'marketplace Nigeria', 'buy and sell Nigeria', 'Velontri', 'Velontri Nigeria',
    'cars for sale Nigeria', 'property Lagos', 'phones for sale Abuja',
    'fashion Nigeria', 'jobs Nigeria', 'services Nigeria', 'tokunbo cars',
  ],
  authors: [{ name: 'Velontri', url: 'https://velontri.pxxl.click' }],
  creator: 'Velontri',
  publisher: 'Velontri',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://velontri.pxxl.click'),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://velontri.pxxl.click',
    title: 'Velontri Nigeria | Buy & Sell Products, Cars, Property & Services',
    description:
      'Nigeria\'s premier marketplace — buy and sell cars, property, phones, fashion and services. Connect with verified sellers directly on WhatsApp.',
    siteName: 'Velontri',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Velontri Nigeria Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Velontri Nigeria | Buy & Sell Products, Cars, Property & Services',
    description: 'Nigeria\'s premier marketplace — no agent fees, direct WhatsApp contact.',
    creator: '@velontri',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  // Uncomment and add your GSC token once you have it:
  // verification: { google: 'YOUR_GSC_VERIFICATION_TOKEN' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://velontri.pxxl.click';

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Velontri',
    alternateName: 'Velontri Nigeria',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: "Nigeria's premier online marketplace for buying and selling cars, property, electronics, fashion, furniture, jobs and services.",
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'NG',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@velontri.pxxl.click',
    },
    sameAs: [
      'https://twitter.com/velontri',
      'https://instagram.com/velontri',
    ],
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Velontri',
    url: siteUrl,
    description: "Nigeria's premier marketplace for buying and selling anything.",
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Theme: apply saved preference BEFORE first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('velontri-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {/* Organization structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {/* WebSite + SearchAction structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>
          <MaintenanceBanner />
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
