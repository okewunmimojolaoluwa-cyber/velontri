# Velontri Dashboard Wireframes

## Design Philosophy

### User Dashboard
- **Style**: Premium marketplace experience (Jiji-like but elevated)
- **Feel**: Personal, welcoming, dynamic
- **Inspiration**: Airbnb, Facebook Marketplace, Amazon Marketplace
- **Key Elements**: Large imagery, soft shadows, rounded corners, vibrant colors

### Moderator Dashboard
- **Style**: Clean, focused moderation workspace
- **Feel**: Professional, efficient, distraction-free
- **Inspiration**: Content moderation tools, review platforms
- **Key Elements**: Clear actions, status indicators, efficient workflows

### Super Admin Dashboard
- **Style**: Billion-dollar business command center
- **Feel**: Powerful, data-rich, executive
- **Inspiration**: Shopify Admin, Stripe Dashboard, Meta Business Suite
- **Key Elements**: Colorful KPI cards, large charts, professional tables

---

## User Dashboard Wireframe

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [LOGO] Velontri    [Search]    [Messages]  [Notifications] [User] │
└─────────────────────────────────────────────────────────────────┘
┌──────────────────┬──────────────────────────────────────────────┐
│                  │                                              │
│  [SIDEBAR]       │  [MAIN CONTENT AREA]                         │
│                  │                                              │
│  Dashboard       │  ┌────────────────────────────────────────┐  │
│  My Listings     │  │  Welcome back, [User Name]!            │  │
│  Create Listing  │  │                                        │  │
│  Orders          │  │  [Wallet Card]  [Escrow Card]          │  │
│  Purchases       │  │  ₦500,000       ₦125,000               │  │
│  Sales           │  │                                        │  │
│  Messages        │  └────────────────────────────────────────┘  │
│  Saved           │                                              │
│  Wishlist        │  ┌────────────────────────────────────────┐  │
│  Wallet          │  │  Quick Actions                        │  │
│  Escrow          │  │                                        │  │
│  My Store        │  │  [Create Listing] [Browse] [Messages] │  │
│  Store Analytics │  │  [Wallet] [My Store] [Saved]          │  │
│  Followers       │  └────────────────────────────────────────┘  │
│  Following       │                                              │
│  Reviews         │  ┌────────────────────────────────────────┐  │
│  Notifications   │  │  Activity This Week                    │  │
│  Profile         │  │  [Chart: Views on your listings]       │  │
│  Security        │  └────────────────────────────────────────┘  │
│  Settings        │                                              │
│  Support         │  ┌────────────────────────────────────────┐  │
│                  │  │  Recent Transactions                   │  │
│                  │  │  [Transaction List]                    │  │
│                  │  │  [View All →]                          │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                              │
│                  │  ┌────────────────────────────────────────┐  │
│                  │  │  Get Started                           │  │
│                  │  │                                        │  │
│                  │  │  [Post your first listing]             │  │
│                  │  │  Reach buyers across Africa             │  │
│                  │  │  [Post Now]                            │  │
│                  │  │                                        │  │
│                  │  │  [Open your store]                     │  │
│                  │  │  Build a trusted brand                  │  │
│                  │  │  [Create Store]                         │  │
│                  │  │                                        │  │
│                  │  │  [Fund your wallet]                    │  │
│                  │  │  Buy safely with escrow                  │  │
│                  │  │  [Add Funds]                           │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

### Mobile Layout (Bottom Navigation)

```
┌─────────────────────────────────────────┐
│  [LOGO] Velontri    [Notifications] [User]│
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│                                         │
│  [MAIN CONTENT AREA - SCROLLABLE]       │
│                                         │
│  Welcome back, [User Name]!             │
│                                         │
│  [Wallet Card]  ₦500,000               │
│  [Escrow Card]   ₦125,000               │
│                                         │
│  Quick Actions                          │
│  [Create] [Browse] [Messages]           │
│                                         │
│  Recent Transactions                    │
│  [Transaction List]                     │
│                                         │
│  Get Started                            │
│  [Post Listing]                         │
│  [Create Store]                          │
│  [Add Funds]                            │
│                                         │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  [Home]  [Saved]  [SELL]  [Messages]  [Dash]│
│                      ↑                   │
│                 (Floating Button)         │
└─────────────────────────────────────────┘
```

### Dynamic Content States

#### State 1: New User (No Listings)
```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome to Velontri!                                            │
│                                                                  │
│  You can buy and sell from this one account.                     │
│  Start exploring or post your first listing.                      │
│                                                                  │
│  [Start Selling]  [Browse Listings]                             │
└─────────────────────────────────────────────────────────────────┘
```

#### State 2: Active Seller (Has Listings)
```
┌─────────────────────────────────────────────────────────────────┐
│  Store Performance                                                │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Views    │  │ Sales    │  │ Revenue  │  │ Orders   │      │
│  │ 1,234    │  │ 45       │  │ ₦125,000 │  │ 12       │      │
│  │ +15%     │  │ +8%      │  │ +22%     │  │ +5%      │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                  │
│  [Full Analytics →]                                             │
└─────────────────────────────────────────────────────────────────┘
```

#### State 3: Active Buyer (Frequent Purchases)
```
┌─────────────────────────────────────────────────────────────────┐
│  Purchase Activity                                                │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Orders   │  │ Spent    │  │ Saved    │  │ Reviews  │      │
│  │ 23       │  │ ₦450,000 │  │ ₦12,500  │  │ 8        │      │
│  │ +12%     │  │ +18%     │  │ +5%      │  │ +3       │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                  │
│  [View All Orders →]                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Moderator Dashboard Wireframe

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [LOGO] Velontri    [Search]    [Notifications] [User]           │
└─────────────────────────────────────────────────────────────────┘
┌──────────────────┬──────────────────────────────────────────────┐
│                  │                                              │
│  [SIDEBAR]       │  [MAIN CONTENT AREA]                         │
│                  │                                              │
│  Dashboard       │  ┌────────────────────────────────────────┐  │
│  Pending List.   │  │  Moderation Overview                    │  │
│  Reported List.  │  │                                        │  │
│  Pending KYC     │  │  ┌────────┐ ┌────────┐ ┌────────┐     │  │
│  Users           │  │  │Pending │ │Reported│ │Pending │     │  │
│  Stores          │  │  │Listings│ │Listings│ │  KYC   │     │  │
│  Reported Rev.   │  │  │  156   │ │   23   │ │   45   │     │  │
│  Disputes        │  │  └────────┘ └────────┘ └────────┘     │  │
│  Tickets         │  │                                        │  │
│  Announcements   │  │  ┌────────┐ ┌────────┐ ┌────────┐     │  │
│  Notifications   │  │  │Disputes│ │Tickets │ │Reports │     │  │
│  Logs            │  │  │   12   │ │   34   │ │   18   │     │  │
│  Profile         │  │  └────────┘ └────────┘ └────────┘     │  │
│  Settings        │  └────────────────────────────────────────┘  │
│                  │                                              │
│                  │  ┌────────────────────────────────────────┐  │
│                  │  │  Pending Listings (156)                  │  │
│                  │  │  [Filter: All | Electronics | Vehicles] │  │
│                  │  │                                        │  │
│                  │  │  ┌──────────────────────────────────┐  │  │
│                  │  │  │ [IMG] iPhone 15 Pro Max         │  │  │
│                  │  │  │ ₦850,000 • 2h ago • Electronics │  │  │
│                  │  │  │ [Approve] [Reject] [Review]      │  │  │
│                  │  │  └──────────────────────────────────┘  │  │
│                  │  │                                        │  │
│                  │  │  ┌──────────────────────────────────┐  │  │
│                  │  │  │ [IMG] Toyota Camry 2020          │  │  │
│                  │  │  │ ₦8,500,000 • 4h ago • Vehicles  │  │  │
│                  │  │  │ [Approve] [Reject] [Review]      │  │  │
│                  │  │  └──────────────────────────────────┘  │  │
│                  │  │                                        │  │
│                  │  │  [View All Pending →]                  │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                              │
│                  │  ┌────────────────────────────────────────┐  │
│                  │  │  Recent Actions                       │  │
│                  │  │                                        │  │
│                  │  │  ✓ Approved listing: iPhone 15       │  │
│                  │  │  ✗ Rejected listing: Fake watch       │  │
│                  │  │  ✓ Approved KYC: John Doe             │  │
│                  │  │  ⚠ Flagged user: Suspicious activity  │  │
│                  │  │                                        │  │
│                  │  │  [View All Logs →]                     │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

### Mobile Layout

```
┌─────────────────────────────────────────┐
│  [LOGO] Velontri    [Notifications] [User]│
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  [Dashboard] [Pending] [Reported] [KYC] │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│                                         │
│  Moderation Overview                    │
│                                         │
│  ┌────────┐ ┌────────┐ ┌────────┐     │
│  │Pending │ │Reported│ │Pending │     │
│  │Listings│ │Listings│ │  KYC   │     │
│  │  156   │ │   23   │ │   45   │     │
│  └────────┘ └────────┘ └────────┘     │
│                                         │
│  ┌────────┐ ┌────────┐ ┌────────┐     │
│  │Disputes│ │Tickets │ │Reports │     │
│  │   12   │ │   34   │ │   18   │     │
│  └────────┘ └────────┘ └────────┘     │
│                                         │
│  Pending Listings (156)                 │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [IMG] iPhone 15 Pro Max        │   │
│  │ ₦850,000 • 2h ago              │   │
│  │ [Approve] [Reject]             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [IMG] Toyota Camry 2020          │   │
│  │ ₦8,500,000 • 4h ago             │   │
│  │ [Approve] [Reject]             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [View All →]                          │
│                                         │
└─────────────────────────────────────────┘
```

---

## Super Admin Dashboard Wireframe

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [LOGO] Velontri    [Search]    [Notifications] [User]           │
└─────────────────────────────────────────────────────────────────┘
┌──────────────────┬──────────────────────────────────────────────┐
│                  │                                              │
│  [SIDEBAR]       │  [MAIN CONTENT AREA]                         │
│                  │                                              │
│  Dashboard       │  ┌────────────────────────────────────────┐  │
│  Business Ovw.   │  │  Business Overview                      │  │
│  Revenue         │  │                                        │  │
│  Sales           │  │  ┌──────────────┐ ┌──────────────┐     │  │
│  Users           │  │  │ Today's      │ │ Today's      │     │  │
│  Stores          │  │  │ Revenue      │ │ Sales        │     │  │
│  Listings        │  │  │ ₦2,450,000   │ │ 45           │     │  │
│  Categories      │  │  │ +12% ↑       │ │ +8% ↑        │     │  │
│  Moderators      │  │  └──────────────┘ └──────────────┘     │  │
│  Financial       │  │                                        │  │
│  Subscriptions   │  │  ┌──────────────┐ ┌──────────────┐     │  │
│  Marketing       │  │  │ Weekly       │ │ Monthly      │     │  │
│  Homepage        │  │  │ Revenue      │ │ Revenue      │     │  │
│  CMS             │  │  │ ₦15,200,000  │ │ ₦62,800,000  │     │  │
│  Reviews         │  │  │ +8% ↑        │ │ +15% ↑       │     │  │
│  Reports         │  │  └──────────────┘ └──────────────┘     │  │
│  Disputes        │  └────────────────────────────────────────┘  │
│  Tickets         │                                              │
│  Notifications   │  ┌────────────────────────────────────────┐  │
│  Locations       │  │  Revenue Analytics (Chart)              │  │
│  Configuration   │  │  [Large Line Chart - 6 months]          │  │
│  Reports         │  └────────────────────────────────────────┘  │
│  Audit           │                                              │
│  Settings        │  ┌────────────────────────────────────────┐  │
│  Profile         │  │  Sales Analytics (Chart)                │  │
│                  │  │  [Large Bar Chart - Categories]         │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                              │
│                  │  ┌────────────────────────────────────────┐  │
│                  │  │  Quick Stats                            │  │
│                  │  │                                        │  │
│                  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐│  │
│                  │  │  │Total     │ │Verified  │ │Active    ││  │
│                  │  │  │Users     │ │Users     │ │Stores    ││  │
│                  │  │  │12,456    │ │8,234     │ │1,234     ││  │
│                  │  │  │+156 today │ │+89 today │ │+12 today ││  │
│                  │  │  └──────────┘ └──────────┘ └──────────┘│  │
│                  │  │                                        │  │
│                  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐│  │
│                  │  │  │Total     │ │Featured  │ │Pending   ││  │
│                  │  │  │Listings  │ │Listings  │ │Listings  ││  │
│                  │  │  │45,678    │ │234       │ │156       ││  │
│                  │  │  │+892 today│ │+12 today │ │          ││  │
│                  │  │  └──────────┘ └──────────┘ └──────────┘│  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                              │
│                  │  ┌────────────────────────────────────────┐  │
│                  │  │  Top Performing Categories              │  │
│                  │  │                                        │  │
│                  │  │  1. Electronics - ₦12.5M (45%)         │  │
│                  │  │  2. Vehicles - ₦8.2M (30%)            │  │
│                  │  │  3. Property - ₦4.1M (15%)            │  │
│                  │  │  4. Fashion - ₦2.1M (8%)              │  │
│                  │  │  5. Services - ₦0.8M (2%)             │  │
│                  │  │                                        │  │
│                  │  │  [View Full Report →]                  │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                              │
│                  │  ┌────────────────────────────────────────┐  │
│                  │  │  Recent Activity                       │  │
│                  │  │                                        │  │
│                  │  │  ✓ New store created: Tech Gadgets Ltd │  │
│                  │  │  ✓ Moderator created: Sarah Johnson   │  │
│                  │  │  ⚠ Dispute escalated: Order #12345   │  │
│                  │  │  ✓ Campaign launched: Summer Sale     │  │
│                  │  │                                        │  │
│                  │  │  [View All Activity →]                  │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

### Mobile Layout

```
┌─────────────────────────────────────────┐
│  [LOGO] Velontri    [Notifications] [User]│
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  [≡] Menu                               │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│                                         │
│  Business Overview                      │
│                                         │
│  ┌──────────────┐ ┌──────────────┐     │
│  │ Today's      │ │ Today's      │     │
│  │ Revenue      │ │ Sales        │     │
│  │ ₦2,450,000   │ │ 45           │     │
│  │ +12% ↑       │ │ +8% ↑        │     │
│  └──────────────┘ └──────────────┘     │
│                                         │
│  ┌──────────────┐ ┌──────────────┐     │
│  │ Weekly       │ │ Monthly      │     │
│  │ Revenue      │ │ Revenue      │     │
│  │ ₦15,200,000  │ │ ₦62,800,000  │     │
│  │ +8% ↑        │ │ +15% ↑       │     │
│  └──────────────┘ └──────────────┘     │
│                                         │
│  Revenue Analytics                      │
│  [Chart - 6 months]                     │
│                                         │
│  Quick Stats                            │
│                                         │
│  ┌──────────┐ ┌──────────┐             │
│  │Total     │ │Verified  │             │
│  │Users     │ │Users     │             │
│  │12,456    │ │8,234     │             │
│  └──────────┘ └──────────┘             │
│                                         │
│  ┌──────────┐ ┌──────────┐             │
│  │Active    │ │Total     │             │
│  │Stores    │ │Listings  │             │
│  │1,234     │ │45,678    │             │
│  └──────────┘ └──────────┘             │
│                                         │
│  Top Categories                         │
│  1. Electronics                         │
│  2. Vehicles                            │
│  3. Property                            │
│                                         │
│  [View Full Report →]                   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Design System Specifications

### User Dashboard Colors
- **Primary**: Indigo-600 (#4F46E5)
- **Secondary**: Emerald-500 (#10B981)
- **Accent**: Amber-500 (#F59E0B)
- **Background**: White (#FFFFFF)
- **Surface**: Slate-50 (#F8FAFC)
- **Text**: Slate-900 (#0F172A)
- **Text Muted**: Slate-500 (#64748B)

### Moderator Dashboard Colors
- **Primary**: Blue-600 (#2563EB)
- **Success**: Green-500 (#22C55E)
- **Warning**: Yellow-500 (#EAB308)
- **Danger**: Red-500 (#EF4444)
- **Background**: White (#FFFFFF)
- **Surface**: Gray-50 (#F9FAFB)
- **Text**: Gray-900 (#111827)
- **Text Muted**: Gray-500 (#6B7280)

### Super Admin Dashboard Colors
- **Primary**: Violet-600 (#7C3AED)
- **Success**: Emerald-500 (#10B981)
- **Warning**: Orange-500 (#F97316)
- **Danger**: Rose-500 (#F43F5E)
- **Background**: White (#FFFFFF)
- **Surface**: Slate-50 (#F8FAFC)
- **Text**: Slate-900 (#0F172A)
- **Text Muted**: Slate-500 (#64748B)

### Typography Scale
- **Display**: 48px / 56px (Bold)
- **H1**: 36px / 44px (Bold)
- **H2**: 30px / 38px (SemiBold)
- **H3**: 24px / 32px (SemiBold)
- **H4**: 20px / 28px (Medium)
- **Body**: 16px / 24px (Regular)
- **Small**: 14px / 20px (Regular)
- **XSmall**: 12px / 16px (Medium)

### Spacing Scale
- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **2xl**: 48px
- **3xl**: 64px

### Border Radius
- **sm**: 4px
- **md**: 8px
- **lg**: 12px
- **xl**: 16px
- **2xl**: 24px
- **full**: 9999px

### Shadows
- **sm**: 0 1px 2px 0 rgb(0 0 0 / 0.05)
- **md**: 0 4px 6px -1px rgb(0 0 0 / 0.1)
- **lg**: 0 10px 15px -3px rgb(0 0 0 / 0.1)
- **xl**: 0 20px 25px -5px rgb(0 0 0 / 0.1)
- **2xl**: 0 25px 50px -12px rgb(0 0 0 / 0.25)
