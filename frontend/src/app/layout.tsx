import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import dynamic from 'next/dynamic';
import { Providers } from '@/app/providers';
import { siteConfig } from '@/config/site';
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
    default: `${siteConfig.name} — Africa's Premier Marketplace`,
    template: `%s | ${siteConfig.name}`,
  },
  description: 'Buy and sell anything across Africa. Property, vehicles, electronics, fashion, jobs and services.',
  keywords: ['marketplace', 'Africa', 'Nigeria', 'Ghana', 'Kenya', 'buy', 'sell', 'listings'],
  authors: [{ name: 'Velontri' }],
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: siteConfig.url,
    title: `${siteConfig.name} — Africa's Premier Marketplace`,
    description: 'Buy and sell anything across Africa.',
    siteName: siteConfig.name,
  },
  twitter: { card: 'summary_large_image', title: siteConfig.name, creator: '@velontri' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Blocking script: apply saved theme BEFORE first paint to prevent FOLT */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('velontri-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
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
