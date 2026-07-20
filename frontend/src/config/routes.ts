import type { VelontriRole } from '@/types/auth';

export const ROUTES = {
  // Public
  home:         '/',
  listings:     '/listings',
  search:       '/search',
  stores:       '/stores',

  // Auth
  login:        '/login',
  register:     '/register',
  verifyPhone:  '/verify-phone',
  forgotPw:     '/forgot-password',

  // Dashboard root (redirects based on role)
  dashboard:    '/dashboard',

  // User dashboard (single dashboard for both buying and selling)
  user: {
    overview:    '/dashboard',
    listings:    '/dashboard/listings',
    create:      '/dashboard/listings/create',
    orders:      '/dashboard/orders',
    purchases:   '/dashboard/purchases',
    sales:       '/dashboard/sales',
    messages:    '/dashboard/messages',
    saved:       '/dashboard/saved',
    wishlist:    '/dashboard/wishlist',
    store:       '/dashboard/store',
    storeAnalytics: '/dashboard/store/analytics',
    followers:   '/dashboard/followers',
    following:   '/dashboard/following',
    reviews:     '/dashboard/reviews',
    notifications:'/dashboard/notifications',
    profile:     '/dashboard/profile',
    security:    '/dashboard/security',
    settings:    '/dashboard/settings',
    help:        '/dashboard/help',
    subscription: '/dashboard/subscription',
  },

  // Moderator dashboard (focused on moderation only)
  mod: {
    overview:    '/mod',
    pendingListings: '/mod/pending-listings',
    reportedListings: '/mod/reported-listings',
    kyc:         '/mod/kyc',
    users:       '/mod/users',
    stores:      '/mod/stores',
    reports:     '/mod/reports',
    disputes:    '/mod/disputes',
    tickets:     '/mod/tickets',
    reviews:     '/mod/reviews',
    announcements:'/mod/announcements',
    notifications:'/mod/notifications',
    logs:        '/mod/logs',
    profile:     '/mod/profile',
    settings:    '/mod/settings',
  },

  // Super admin dashboard (business-focused for non-technical owner)
  admin: {
    overview:    '/admin',
    businessOverview: '/admin/business-overview',
    revenue:     '/admin/revenue',
    sales:       '/admin/sales',
    analytics:   '/admin/analytics',
    users:       '/admin/users',
    verifiedUsers: '/admin/users/verified',
    sellers:     '/admin/sellers',
    stores:      '/admin/stores',
    listings:    '/admin/listings',
    categories:  '/admin/categories',
    subcategories: '/admin/subcategories',
    products:    '/admin/products',
    properties:  '/admin/properties',
    vehicles:    '/admin/vehicles',
    services:    '/admin/services',
    jobs:        '/admin/jobs',
    moderators:  '/admin/moderators',
    createModerator: '/admin/moderators/create',
    editModerator: '/admin/moderators/edit',
    kyc:         '/admin/kyc',
    subscriptions:'/admin/subscriptions',
    plans:       '/admin/subscriptions/plans',
    advertisements: '/admin/advertisements',
    featuredListings: '/admin/featured-listings',
    homepage:    '/admin/homepage',
    banners:     '/admin/banners',
    payments:    '/admin/payments',
    sections:    '/admin/homepage/sections',
    promotions:  '/admin/promotions',
    cms:         '/admin/cms',
    blog:        '/admin/blog',
    reviews:     '/admin/reviews',
    reports:     '/admin/reports',
    disputes:    '/admin/disputes',
    tickets:     '/admin/tickets',
    notifications:'/admin/notifications',
    emailCampaigns: '/admin/notifications/email',
    smsCampaigns: '/admin/notifications/sms',
    pushNotifications: '/admin/notifications/push',
    coupons:     '/admin/coupons',
    referrals:   '/admin/referrals',
    locations:   '/admin/locations',
    countries:   '/admin/locations/countries',
    states:      '/admin/locations/states',
    cities:      '/admin/locations/cities',
    currencies:  '/admin/currencies',
    languages:   '/admin/languages',
    businessReports: '/admin/reports/business',
    salesReports: '/admin/reports/sales',
    revenueReports: '/admin/reports/revenue',
    exportReports: '/admin/reports/export',
    audit:       '/admin/audit',
    settings:    '/admin/settings',
    platformSettings: '/admin/settings/platform',
    profile:     '/admin/profile',
  },
} as const;

/** Resolve where to redirect after login based on role */
export function resolveHomePath(role: VelontriRole): string {
  switch (role) {
    case 'super_admin': return ROUTES.admin.overview;
    case 'moderator':   return ROUTES.mod.overview;
    case 'user':        return ROUTES.user.overview;
    default:            return ROUTES.home;
  }
}
