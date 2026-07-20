/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Skip static generation for all pages — pure client-side app
  // This eliminates all SSR/client hydration mismatches
  typescript: {
    ignoreBuildErrors: false,
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

  // Disable x-powered-by header
  poweredByHeader: false,
};

module.exports = nextConfig;
