/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Public env vars — safe to commit, these are public-facing keys only.
  // NEXT_PUBLIC_* vars must be available at build time for the browser bundle.
  // .env.local is gitignored so we bake the fallbacks here for production builds.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://velontri.onrender.com/api/v1',
    // Google OAuth Client ID (public — safe to commit)
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '99339393476-c77uoti2pa2thldagm4fkrmslhg1ggnr.apps.googleusercontent.com',
    // Paystack public key (public — safe to commit)
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
      'pk_test_51d83fe69d0b2dc3483cb85f3599be0a1ac22a5d',
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'https', hostname: '**.pexels.com' },
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    unoptimized: true,
  },

  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, punycode: false };
    return config;
  },

  experimental: {
    serverComponentsExternalPackages: [],
  },

  poweredByHeader: false,
};

module.exports = nextConfig;
