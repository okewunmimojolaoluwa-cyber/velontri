# Velontri Route Structure

## Overview

Velontri has 3 distinct dashboards, each with its own route structure. No routes are shared between dashboards.

---

## User Dashboard Routes

### Base Path: `/dashboard`

```
/dashboard
├── /                          # Homepage (dynamic content)
├── /listings
│   ├── /                      # My Listings
│   ├── /create                # Create Listing Wizard
│   ├── /[id]                  # Listing Details
│   ├── /[id]/edit             # Edit Listing
│   └── /[id]/promote          # Promote Listing
├── /orders
│   ├── /                      # Orders Overview
│   ├── /purchases             # My Purchases
│   └── /sales                 # My Sales
├── /messages
│   ├── /                      # Messages List
│   └── /[id]                  # Conversation
├── /saved
│   ├── /                      # Saved Listings
│   └── /wishlist              # Wishlist
├── /wallet
│   ├── /                      # Wallet Overview
│   ├── /add-funds             # Add Funds
│   ├── /withdraw              # Withdraw
│   └── /transactions          # Transaction History
├── /escrow
│   ├── /                      # Escrow Overview
│   └── /[id]                  # Escrow Details
├── /store
│   ├── /                      # My Store Overview
│   ├── /create                # Create Store
│   ├── /[id]                  # Store Details
│   ├── /[id]/edit             # Edit Store
│   └── /analytics             # Store Analytics
├── /social
│   ├── /followers             # Followers
│   └── /following             # Following
├── /reviews
│   ├── /                      # My Reviews
│   └── /[id]                  # Review Details
├── /notifications
│   └── /                      # Notifications
├── /profile
│   └── /                      # Profile Settings
├── /security
│   └── /                      # Security Settings
├── /settings
│   └── /                      # Account Settings
└── /support
    └── /                      # Help & Support
```

---

## Moderator Dashboard Routes

### Base Path: `/mod`

```
/mod
├── /                          # Homepage (moderation overview)
├── /listings
│   ├── /pending               # Pending Listings
│   ├── /reported              # Reported Listings
│   └── /[id]                  # Listing Review
├── /kyc
│   ├── /pending               # Pending KYC
│   └── /[id]                  # KYC Review
├── /users
│   ├── /                      # Users List
│   └── /[id]                  # User Details
├── /stores
│   ├── /                      # Stores List
│   ├── /pending               # Pending Stores
│   └── /[id]                  # Store Review
├── /reviews
│   ├── /reported              # Reported Reviews
│   └── /[id]                  # Review Review
├── /disputes
│   ├── /                      # Disputes List
│   └── /[id]                  # Dispute Details
├── /tickets
│   ├── /                      # Support Tickets
│   └── /[id]                  # Ticket Details
├── /announcements
│   ├── /                      # Announcements List
│   └── /create                # Create Announcement
├── /notifications
│   └── /                      # Notifications
├── /logs
│   └── /                      # Moderation Logs
├── /profile
│   └── /                      # Profile Settings
└── /settings
    └── /                      # Account Settings
```

---

## Super Admin Dashboard Routes

### Base Path: `/admin`

```
/admin
├── /                          # Homepage (business overview)
├── /overview
│   └── /business-overview     # Business Overview
├── /revenue
│   ├── /                      # Revenue Overview
│   ├── /today                 # Today's Revenue
│   ├── /weekly                # Weekly Revenue
│   ├── /monthly               # Monthly Revenue
│   ├── /annual                # Annual Revenue
│   └── /analytics             # Revenue Analytics
├── /sales
│   ├── /                      # Sales Overview
│   ├── /today                 # Today's Sales
│   └── /analytics             # Sales Analytics
├── /users
│   ├── /                      # Users Overview
│   ├── /verified              # Verified Users
│   └── /[id]                  # User Details
├── /sellers
│   └── /                      # Sellers List
├── /stores
│   ├── /                      # Stores Overview
│   ├── /pending               # Pending Stores
│   └── /[id]                  # Store Details
├── /listings
│   ├── /                      # Listings Overview
│   ├── /featured              # Featured Listings
│   └── /[id]                  # Listing Details
├── /categories
│   ├── /                      # Categories
│   └── /subcategories         # Subcategories
├── /content
│   ├── /products              # Products
│   ├── /vehicles              # Vehicles
│   ├── /properties            # Properties
│   ├── /services              # Services
│   └── /jobs                  # Jobs
├── /moderators
│   ├── /                      # Moderators List
│   ├── /create                # Create Moderator
│   ├── /[id]                  # Moderator Details
│   ├── /[id]/edit             # Edit Moderator
│   ├── /[id]/suspend          # Suspend Moderator
│   ├── /[id]/delete           # Delete Moderator
│   └── /permissions           # Permission Management
├── /financial
│   ├── /wallet                # Wallet Overview
│   ├── /escrow                # Escrow Overview
│   ├── /payments              # Payments
│   ├── /withdrawals           # Withdrawals
│   ├── /refunds               # Refund Requests
│   └── /transactions          # Transactions
├── /subscriptions
│   ├── /                      # Subscriptions
│   └── /plans                 # Subscription Plans
├── /marketing
│   ├── /advertisements        # Advertisements
│   ├── /featured-ads          # Featured Ads
│   ├── /coupons               # Coupons
│   └── /promotions            # Promotions
├── /homepage
│   ├── /                      # Homepage Manager
│   ├── /banners               # Banner Manager
│   └── /sections              # Homepage Sections
├── /cms
│   ├── /                      # CMS Overview
│   └── /blog                  # Blog Management
├── /reviews
│   └── /                      # Reviews Overview
├── /reports
│   └── /                      # Reports Overview
├── /disputes
│   └── /                      # Disputes Overview
├── /tickets
│   └── /                      # Support Tickets
├── /notifications
│   ├── /email                 # Email Campaigns
│   ├── /sms                   # SMS Campaigns
│   └── /push                  # Push Notifications
├── /locations
│   ├── /countries             # Countries
│   ├── /states                # States
│   └── /cities                # Cities
├── /configuration
│   ├── /currencies            # Currencies
│   └── /languages             # Languages
├── /reports
│   ├── /business              # Business Reports
│   ├── /sales                 # Sales Reports
│   ├── /revenue               # Revenue Reports
│   └── /export                # Export Reports
├── /audit
│   └── /                      # Audit Logs
├── /settings
│   ├── /business              # Business Settings
│   ├── /platform              # Platform Settings
│   └── /                      # Settings Overview
└── /profile
    └── /                      # Profile Settings
```

---

## Public Routes (All Roles)

```
/                           # Homepage
/login                      # Login Page
/register                   # Registration Page
/forgot-password            # Forgot Password
/reset-password             # Reset Password
/verify-2fa                 # 2FA Verification
/listings                   # Marketplace Listings
/listings/[id]              # Listing Details
/listings/category/[slug]   # Category Listings
/search                     # Search Results
/stores                     # Stores Directory
/stores/[id]                # Store Details
/about                      # About Page
/privacy                    # Privacy Policy
/terms                      # Terms of Service
/contact                    # Contact Page
```

---

## Route Protection Matrix

| Route Pattern | Guest | User | Moderator | Super Admin |
|---------------|-------|------|-----------|-------------|
| `/` | ✅ | ✅ | ✅ | ✅ |
| `/login` | ✅ | ❌ | ❌ | ❌ |
| `/register` | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/*` | ❌ | ✅ | ❌ | ❌ |
| `/mod/*` | ❌ | ❌ | ✅ | ✅ |
| `/admin/*` | ❌ | ❌ | ❌ | ✅ |
| `/listings/*` | ✅ | ✅ | ✅ | ✅ |
| `/stores/*` | ✅ | ✅ | ✅ | ✅ |

---

## Route Redirect Logic

### Login Redirect
After successful login, redirect based on role:
- `guest` → `/dashboard` (after registration)
- `user` → `/dashboard`
- `moderator` → `/mod`
- `super_admin` → `/admin`

### Protected Route Redirect
If unauthenticated user accesses protected route:
- `/dashboard/*` → `/login?redirect=/dashboard/...`
- `/mod/*` → `/login?redirect=/mod/...`
- `/admin/*` → `/login?redirect=/admin/...`

### Role-Based Redirect
If user accesses wrong dashboard:
- User accessing `/mod/*` → Redirect to `/dashboard`
- User accessing `/admin/*` → Redirect to `/dashboard`
- Moderator accessing `/admin/*` → Redirect to `/mod`
- Super Admin accessing `/dashboard/*` → Redirect to `/admin`

---

## Next.js App Router Structure

```
src/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   └── layout.tsx
├── (public)/
│   ├── page.tsx
│   ├── listings/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   └── layout.tsx
├── dashboard/
│   ├── layout.tsx           # User Dashboard Layout
│   ├── page.tsx             # User Dashboard Homepage
│   ├── listings/
│   ├── orders/
│   ├── messages/
│   ├── wallet/
│   ├── store/
│   └── ...
├── mod/
│   ├── layout.tsx           # Moderator Dashboard Layout
│   ├── page.tsx             # Moderator Dashboard Homepage
│   ├── listings/
│   ├── kyc/
│   ├── users/
│   └── ...
└── admin/
    ├── layout.tsx           # Super Admin Dashboard Layout
    ├── page.tsx             # Super Admin Dashboard Homepage
    ├── revenue/
    ├── sales/
    ├── users/
    ├── moderators/
    └── ...
```

---

## Route Constants (routes.ts)

```typescript
export const ROUTES = {
  // Public
  home: '/',
  login: '/login',
  register: '/register',
  
  // User Dashboard
  user: {
    base: '/dashboard',
    overview: '/dashboard',
    listings: '/dashboard/listings',
    createListing: '/dashboard/listings/create',
    orders: '/dashboard/orders',
    purchases: '/dashboard/orders/purchases',
    sales: '/dashboard/orders/sales',
    messages: '/dashboard/messages',
    saved: '/dashboard/saved',
    wishlist: '/dashboard/saved/wishlist',
    wallet: '/dashboard/wallet',
    escrow: '/dashboard/escrow',
    store: '/dashboard/store',
    storeAnalytics: '/dashboard/store/analytics',
    followers: '/dashboard/social/followers',
    following: '/dashboard/social/following',
    reviews: '/dashboard/reviews',
    notifications: '/dashboard/notifications',
    profile: '/dashboard/profile',
    security: '/dashboard/security',
    settings: '/dashboard/settings',
    support: '/dashboard/support',
  },
  
  // Moderator Dashboard
  mod: {
    base: '/mod',
    overview: '/mod',
    pendingListings: '/mod/listings/pending',
    reportedListings: '/mod/listings/reported',
    pendingKyc: '/mod/kyc/pending',
    users: '/mod/users',
    stores: '/mod/stores',
    reportedReviews: '/mod/reviews/reported',
    disputes: '/mod/disputes',
    tickets: '/mod/tickets',
    announcements: '/mod/announcements',
    notifications: '/mod/notifications',
    logs: '/mod/logs',
    profile: '/mod/profile',
    settings: '/mod/settings',
  },
  
  // Super Admin Dashboard
  admin: {
    base: '/admin',
    overview: '/admin',
    businessOverview: '/admin/overview/business-overview',
    revenue: '/admin/revenue',
    sales: '/admin/sales',
    users: '/admin/users',
    verifiedUsers: '/admin/users/verified',
    sellers: '/admin/sellers',
    stores: '/admin/stores',
    listings: '/admin/listings',
    featuredListings: '/admin/listings/featured',
    categories: '/admin/categories',
    moderators: '/admin/moderators',
    createModerator: '/admin/moderators/create',
    editModerator: '/admin/moderators/[id]/edit',
    wallet: '/admin/financial/wallet',
    escrow: '/admin/financial/escrow',
    payments: '/admin/financial/payments',
    withdrawals: '/admin/financial/withdrawals',
    refunds: '/admin/financial/refunds',
    transactions: '/admin/financial/transactions',
    subscriptions: '/admin/subscriptions',
    plans: '/admin/subscriptions/plans',
    advertisements: '/admin/marketing/advertisements',
    featuredAds: '/admin/marketing/featured-ads',
    coupons: '/admin/marketing/coupons',
    promotions: '/admin/marketing/promotions',
    homepage: '/admin/homepage',
    banners: '/admin/homepage/banners',
    sections: '/admin/homepage/sections',
    cms: '/admin/cms',
    blog: '/admin/cms/blog',
    reviews: '/admin/reviews',
    reports: '/admin/reports',
    disputes: '/admin/disputes',
    tickets: '/admin/tickets',
    notifications: '/admin/notifications',
    emailCampaigns: '/admin/notifications/email',
    smsCampaigns: '/admin/notifications/sms',
    pushNotifications: '/admin/notifications/push',
    countries: '/admin/locations/countries',
    states: '/admin/locations/states',
    cities: '/admin/locations/cities',
    currencies: '/admin/configuration/currencies',
    languages: '/admin/configuration/languages',
    businessReports: '/admin/reports/business',
    salesReports: '/admin/reports/sales',
    revenueReports: '/admin/reports/revenue',
    exportReports: '/admin/reports/export',
    audit: '/admin/audit',
    settings: '/admin/settings',
    platformSettings: '/admin/settings/platform',
    profile: '/admin/profile',
  },
};
```
