import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Search Listings in Nigeria | Velontri',
  description:
    "Search millions of listings across Nigeria. Find cars, phones, property, fashion and more. Velontri understands Nigerian slang — try 'tokunbo', 'okrika', 'lappy', 'gen' and more.",
  alternates: { canonical: '/search' },
  // Allow Google to index the search landing page but not individual query URLs
  // (individual ?q= param URLs are handled via robots.txt disallow patterns)
  robots: { index: true, follow: true },
};

export default function SearchLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
