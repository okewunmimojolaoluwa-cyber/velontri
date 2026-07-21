/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Public API URL — set NEXT_PUBLIC_API_URL in your hosting env vars
  // Falls back to production Render URL
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://velontri.onrender.com/api/v1',
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
