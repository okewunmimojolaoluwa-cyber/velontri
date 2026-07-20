# Velontri Navigation Maps

## User Dashboard Navigation Map

### Desktop Sidebar Navigation

```
┌─────────────────────────────────────┐
│  Velontri                            │
├─────────────────────────────────────┤
│  OVERVIEW                            │
│  • Dashboard                         │
├─────────────────────────────────────┤
│  MARKETPLACE                         │
│  • My Listings                       │
│  • Create Listing [CTA]              │
│  • Orders                            │
│    • Purchases                       │
│    • Sales                           │
│  • Saved Listings                    │
│  • Wishlist                          │
├─────────────────────────────────────┤
│  FINANCES                            │
│  • Wallet                            │
│  • Escrow                            │
├─────────────────────────────────────┤
│  STORE                               │
│  • My Store                          │
│  • Store Analytics                   │
│  • Followers                         │
│  • Following                         │
├─────────────────────────────────────┤
│  COMMUNICATION                       │
│  • Messages                          │
│  • Notifications                     │
├─────────────────────────────────────┤
│  ACCOUNT                             │
│  • Profile                           │
│  • Security                          │
│  • Settings                          │
│  • Help & Support                    │
├─────────────────────────────────────┤
│  [Logout]                            │
└─────────────────────────────────────┘
```

### Mobile Bottom Navigation

```
┌─────────────────────────────────────┐
│  [Home]  [Saved]  [SELL]  [Messages] [Dashboard] │
│                      ↑                   │
│              (Floating Button)           │
└─────────────────────────────────────┘
```

### Sell Flow Navigation

```
[SELL Button Click]
        ↓
[Category Selection Modal]
        ↓
┌─────────────────────────────────────┐
│  What are you selling?              │
│                                     │
│  [Electronics]  [Vehicles]          │
│  [Property]    [Fashion]            │
│  [Services]    [Jobs]               │
│  [Agriculture]  [Animals]            │
│  [Business Eq]  [Furniture]         │
│  [Phones]       [Computers]          │
│  [Others]                            │
└─────────────────────────────────────┘
        ↓
[Listing Wizard - Step 1]
        ↓
[Listing Wizard - Step 2]
        ↓
[Listing Wizard - Step 3]
        ↓
[Listing Published]
```

### Navigation Hierarchy

**Level 1 (Main Sections)**
- Overview
- Marketplace
- Finances
- Store
- Communication
- Account

**Level 2 (Primary Items)**
- Dashboard
- My Listings
- Create Listing
- Orders
- Saved Listings
- Wallet
- Escrow
- My Store
- Store Analytics
- Messages
- Notifications
- Profile
- Security
- Settings
- Support

**Level 3 (Sub-items)**
- Purchases (under Orders)
- Sales (under Orders)
- Wishlist (under Saved Listings)
- Followers (under Store)
- Following (under Store)

---

## Moderator Dashboard Navigation Map

### Desktop Sidebar Navigation

```
┌─────────────────────────────────────┐
│  Velontri [Moderator]               │
├─────────────────────────────────────┤
│  DASHBOARD                           │
│  • Dashboard                         │
├─────────────────────────────────────┤
│  LISTINGS                           │
│  • Pending Listings [Badge: 156]     │
│  • Reported Listings [Badge: 23]     │
├─────────────────────────────────────┤
│  KYC                                │
│  • Pending KYC [Badge: 45]           │
├─────────────────────────────────────┤
│  USERS & STORES                      │
│  • Users                             │
│  • Stores                            │
├─────────────────────────────────────┤
│  REVIEWS                             │
│  • Reported Reviews [Badge: 18]      │
├─────────────────────────────────────┤
│  DISPUTES & TICKETS                  │
│  • Disputes [Badge: 12]              │
│  • Support Tickets [Badge: 34]       │
├─────────────────────────────────────┤
│  ANNOUNCEMENTS                       │
│  • Announcements                      │
├─────────────────────────────────────┤
│  LOGS                                │
│  • Moderation Logs                    │
├─────────────────────────────────────┤
│  ACCOUNT                             │
│  • Profile                           │
│  • Settings                          │
├─────────────────────────────────────┤
│  [Logout]                            │
└─────────────────────────────────────┘
```

### Mobile Tab Navigation

```
┌─────────────────────────────────────┐
│  [Dashboard] [Pending] [Reported] [KYC]│
└─────────────────────────────────────┘
```

### Content Review Flow

```
[Pending Listings]
        ↓
[Listing Review Page]
        ↓
┌─────────────────────────────────────┐
│  [Listing Details]                   │
│                                     │
│  [Approve] [Reject] [Review Details] │
│                                     │
│  [Flag for Manual Review]            │
└─────────────────────────────────────┘
        ↓
[Action Confirmation]
        ↓
[Next Pending Listing]
```

### Navigation Hierarchy

**Level 1 (Main Sections)**
- Dashboard
- Listings
- KYC
- Users & Stores
- Reviews
- Disputes & Tickets
- Announcements
- Logs
- Account

**Level 2 (Primary Items)**
- Dashboard
- Pending Listings
- Reported Listings
- Pending KYC
- Users
- Stores
- Reported Reviews
- Disputes
- Support Tickets
- Announcements
- Moderation Logs
- Profile
- Settings

---

## Super Admin Dashboard Navigation Map

### Desktop Sidebar Navigation

```
┌─────────────────────────────────────┐
│  Velontri [Super Admin]            │
├─────────────────────────────────────┤
│  DASHBOARD                          │
│  • Dashboard                        │
│  • Business Overview                │
├─────────────────────────────────────┤
│  REVENUE                            │
│  • Today's Revenue                  │
│  • Weekly Revenue                   │
│  • Monthly Revenue                  │
│  • Annual Revenue                   │
│  • Revenue Analytics                 │
├─────────────────────────────────────┤
│  SALES                              │
│  • Today's Sales                     │
│  • Sales Analytics                  │
├─────────────────────────────────────┤
│  USERS                              │
│  • Total Users                       │
│  • Verified Users                   │
│  • Sellers                          │
├─────────────────────────────────────┤
│  STORES & LISTINGS                   │
│  • Stores                           │
│  • Listings                         │
│  • Featured Listings                │
├─────────────────────────────────────┤
│  CATEGORIES                          │
│  • Categories                        │
│  • Subcategories                     │
├─────────────────────────────────────┤
│  CONTENT                            │
│  • Products                         │
│  • Vehicles                         │
│  • Properties                       │
│  • Services                         │
│  • Jobs                             │
├─────────────────────────────────────┤
│  MODERATORS                          │
│  • Moderators                        │
│  • Create Moderator [CTA]           │
├─────────────────────────────────────┤
│  FINANCIAL                          │
│  • Wallet                            │
│  • Escrow                            │
│  • Payments                         │
│  • Withdrawals                      │
│  • Refunds                          │
│  • Transactions                     │
├─────────────────────────────────────┤
│  SUBSCRIPTIONS                       │
│  • Subscriptions                     │
│  • Subscription Plans                │
├─────────────────────────────────────┤
│  MARKETING                          │
│  • Advertisements                    │
│  • Featured Ads                     │
│  • Coupons                          │
│  • Promotions                        │
├─────────────────────────────────────┤
│  HOMEPAGE                           │
│  • Homepage Manager                  │
│  • Banner Manager                    │
│  • Homepage Sections                 │
├─────────────────────────────────────┤
│  CMS                                │
│  • CMS                              │
│  • Blog                             │
├─────────────────────────────────────┤
│  REVIEWS & REPORTS                   │
│  • Reviews                          │
│  • Reports                          │
│  • Disputes                         │
│  • Support Tickets                  │
├─────────────────────────────────────┤
│  NOTIFICATIONS                      │
│  • Email Campaigns                   │
│  • SMS Campaigns                    │
│  • Push Notifications               │
├─────────────────────────────────────┤
│  LOCATIONS                          │
│  • Countries                        │
│  • States                           │
│  • Cities                           │
├─────────────────────────────────────┤
│  CONFIGURATION                      │
│  • Currencies                       │
│  • Languages                        │
├─────────────────────────────────────┤
│  REPORTS                            │
│  • Business Reports                  │
│  • Sales Reports                     │
│  • Revenue Reports                  │
│  • Export Reports                   │
├─────────────────────────────────────┤
│  AUDIT                              │
│  • Audit Logs                        │
├─────────────────────────────────────┤
│  SETTINGS                           │
│  • Business Settings                 │
│  • Platform Settings                 │
├─────────────────────────────────────┤
│  ACCOUNT                            │
│  • Profile                           │
├─────────────────────────────────────┤
│  [Logout]                            │
└─────────────────────────────────────┘
```

### Mobile Navigation

```
┌─────────────────────────────────────┐
│  [≡] Menu                           │
└─────────────────────────────────────┘
```

### Moderator Management Flow

```
[Moderators]
        ↓
[Moderator List]
        ↓
┌─────────────────────────────────────┐
│  [Create Moderator] [CTA]           │
│                                     │
│  Moderator List:                    │
│  • John Doe (Active)                │
│  • Jane Smith (Suspended)            │
│  • Bob Johnson (Active)              │
└─────────────────────────────────────┘
        ↓
[Moderator Details]
        ↓
┌─────────────────────────────────────┐
│  Edit Moderator                     │
│  Suspend Moderator                  │
│  Delete Moderator                   │
│  Assign Permissions                 │
└─────────────────────────────────────┘
```

### Navigation Hierarchy

**Level 1 (Main Sections)**
- Dashboard
- Revenue
- Sales
- Users
- Stores & Listings
- Categories
- Content
- Moderators
- Financial
- Subscriptions
- Marketing
- Homepage
- CMS
- Reviews & Reports
- Notifications
- Locations
- Configuration
- Reports
- Audit
- Settings
- Account

**Level 2 (Primary Items)**
- Dashboard
- Business Overview
- Today's Revenue
- Weekly Revenue
- Monthly Revenue
- Annual Revenue
- Revenue Analytics
- Today's Sales
- Sales Analytics
- Total Users
- Verified Users
- Sellers
- Stores
- Listings
- Featured Listings
- Categories
- Subcategories
- Products
- Vehicles
- Properties
- Services
- Jobs
- Moderators
- Create Moderator
- Wallet
- Escrow
- Payments
- Withdrawals
- Refunds
- Transactions
- Subscriptions
- Subscription Plans
- Advertisements
- Featured Ads
- Coupons
- Promotions
- Homepage Manager
- Banner Manager
- Homepage Sections
- CMS
- Blog
- Reviews
- Reports
- Disputes
- Support Tickets
- Email Campaigns
- SMS Campaigns
- Push Notifications
- Countries
- States
- Cities
- Currencies
- Languages
- Business Reports
- Sales Reports
- Revenue Reports
- Export Reports
- Audit Logs
- Business Settings
- Platform Settings
- Profile

---

## Navigation State Management

### Active State Indicators

**User Dashboard**
- Active section highlighted with indigo-50 background
- Active item with indigo-600 text and left border accent
- Badge indicators for notifications

**Moderator Dashboard**
- Active section highlighted with blue-50 background
- Active item with blue-600 text and left border accent
- Badge indicators for pending items (red badge with count)

**Super Admin Dashboard**
- Active section highlighted with violet-50 background
- Active item with violet-600 text and left border accent
- Badge indicators for alerts

### Collapsible Sections

**User Dashboard**
- All sections expanded by default
- Sections can be collapsed on mobile
- Remember collapse state in localStorage

**Moderator Dashboard**
- All sections expanded by default
- High-priority sections (Pending Listings, Pending KYC) always expanded

**Super Admin Dashboard**
- All sections collapsed by default
- Most-used sections (Revenue, Users, Moderators) expanded by default
- Remember collapse state in localStorage

### Breadcrumb Navigation

**User Dashboard**
```
Dashboard > My Listings > Edit Listing
```

**Moderator Dashboard**
```
Dashboard > Pending Listings > Review Listing
```

**Super Admin Dashboard**
```
Dashboard > Moderators > Edit Moderator
```

---

## Navigation Accessibility

### Keyboard Navigation

- **Tab**: Navigate through navigation items
- **Enter/Space**: Activate navigation item
- **Escape**: Close mobile menu
- **Arrow Keys**: Navigate within sections

### Screen Reader Support

- All navigation items have proper ARIA labels
- Active states announced
- Badge counts announced
- Collapsible sections have expand/collapse states

### Touch Navigation

- Swipe gestures for mobile menu
- Long press for context menus
- Haptic feedback on mobile actions

---

## Navigation Performance

### Lazy Loading

- Navigation components lazy-loaded per dashboard
- Sub-sections loaded on demand
- Icons loaded as SVG sprites

### Caching

- Navigation structure cached in memory
- User preferences (collapsed state) in localStorage
- Badge counts cached with TTL

### Optimizations

- Virtual scrolling for long lists
- Debounced search in navigation
- Prefetch likely next routes
