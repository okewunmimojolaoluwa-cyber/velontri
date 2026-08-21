import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Browse Listings in Nigeria | Velontri Marketplace',
  description:
    "Browse thousands of active listings across Nigeria. Find cars, property, phones, fashion, furniture, jobs and services from verified sellers in Lagos, Abuja, Port Harcourt, Kano and all Nigerian states. No agent fees — contact sellers directly on WhatsApp.",
  keywords: [
    'buy sell Nigeria', 'listings Nigeria', 'Velontri listings',
    'cars for sale Nigeria', 'property Nigeria', 'phones Nigeria', 'jobs Nigeria',
  ],
  alternates: { canonical: '/listings' },
  openGraph: {
    type: 'website',
    title: 'Browse Listings in Nigeria | Velontri',
    description: "Thousands of active listings across Nigeria — no agent fees, direct WhatsApp contact.",
    siteName: 'Velontri',
    locale: 'en_NG',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

export default function ListingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
