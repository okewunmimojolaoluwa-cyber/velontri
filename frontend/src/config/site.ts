export const siteConfig = {
  name: 'Velontri',
  description: 'The most beautiful commerce platform in Africa. Buy, sell and grow across Nigeria, Ghana, Kenya, South Africa and beyond.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
  defaultLocale: 'en',
  supportedCurrencies: ['NGN', 'GHS', 'KES', 'ZAR', 'XOF'] as const,
  social: {
    twitter: 'https://twitter.com/velontri',
    instagram: 'https://instagram.com/velontri',
    linkedin: 'https://linkedin.com/company/velontri',
  },
  stats: {
    users: '2M+',
    listings: '5M+',
    countries: '15+',
    gmv: '₦500B+',
  },
};
