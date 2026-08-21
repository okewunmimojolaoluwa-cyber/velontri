/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Public env vars — safe to commit, these are public-facing keys only.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://velontri.onrender.com/api/v1',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://velontri.pxxl.click',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '99339393476-c77uoti2pa2thldagm4fkrmslhg1ggnr.apps.googleusercontent.com',
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
      'pk_test_51d83fe69d0b2dc3483cb85f3599be0a1ac22a5d',
  },

  // HTTP headers for SEO and security
  async headers() {
    return [
      // Cache static assets
      {
        source: '/(.*\\.(?:ico|png|jpg|jpeg|gif|svg|woff2?))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Prevent indexing of private routes at HTTP level
      {
        source: '/dashboard/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/mod/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/(login|register|forgot-password|verify-phone|verify-2fa)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'https', hostname: '**.pexels.com' },
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    unoptimized: true,
  },

  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, punycode: false };
    return config;
  },

  poweredByHeader: false,
};

module.exports = nextConfig;
