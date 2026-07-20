import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
}

export function generateMetadata({ title, description, image, noIndex }: SEOProps = {}): Metadata {
  const pageTitle = title ? `${title} | ${siteConfig.name}` : siteConfig.name;
  const pageDescription = description || siteConfig.description;
  const pageImage = image || `${siteConfig.url}/og-image.png`;

  return {
    title: pageTitle,
    description: pageDescription,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: siteConfig.url,
      title: pageTitle,
      description: pageDescription,
      siteName: siteConfig.name,
      images: [
        {
          url: pageImage,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [pageImage],
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
      },
    },
    ...(noIndex && {
      other: {
        'X-Robots-Tag': 'noindex, nofollow',
      },
    }),
  };
}

export function generateListingMetadata(title: string, description: string, image?: string): Metadata {
  return generateMetadata({
    title,
    description,
    image,
  });
}

export function generateCategoryMetadata(category: string): Metadata {
  return generateMetadata({
    title: `${category} Listings`,
    description: `Browse ${category} listings on ${siteConfig.name}. Find the best deals across Nigeria, Ghana, Kenya, South Africa, and beyond.`,
  });
}
