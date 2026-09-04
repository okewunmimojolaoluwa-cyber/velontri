/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Production optimizations
  swcMinify: true, // Faster minification with SWC
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
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

  // HTTP headers for SEO, security, and performance
  async headers() {
    return [
      // Sitemap — text/xml is required by Google Search Console (not application/xml)
      // IMPORTANT: no X-Robots-Tag here — sitemaps must NOT be marked noindex
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Content-Type',  value: 'text/xml; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' },
        ],
      },
      // Robots.txt — explicit Content-Type
      {
        source: '/robots.txt',
        headers: [
          { key: 'Content-Type',  value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=86400' },
        ],
      },
      // Aggressive caching for static assets
      {
        source: '/(.*\\.(?:ico|png|jpg|jpeg|gif|svg|woff2?))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Cache JavaScript and CSS bundles
      {
        source: '/_next/static/:path*',
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
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    unoptimized: true,
  },

  webpack(config, { dev, isServer }) {
    config.resolve.fallback = { ...config.resolve.fallback, punycode: false };
    
    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for node_modules
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    }
    
    return config;
  },

  poweredByHeader: false,
  
  // Experimental features for better performance
  experimental: {
    // optimizeCss: true, // Disabled - requires critters package
    optimizePackageImports: ['@phosphor-icons/react', 'lucide-react'],
  },
};

module.exports = nextConfig;
