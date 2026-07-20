# Velontri Information Architecture

## System Roles (4 Total)

### 1. Guest
- Unauthenticated users
- Public browsing only
- Can view listings
- Can search marketplace
- Cannot perform transactions

### 2. User
- Registered marketplace participants
- Can buy AND sell from one account
- Can open stores
- Can use wallet, escrow, chat
- Can leave reviews, save listings, follow stores
- Dynamic dashboard based on activity

### 3. Moderator
- Internal staff only
- Cannot register themselves
- Cannot buy or sell
- Cannot own stores
- Only moderate platform content
- Created by Super Admin only

### 4. Super Admin
- Business owner (single account)
- Non-technical business focus
- Full platform control
- Can create/manage moderators
- Business analytics focus
- No technical/developer tools

---

## Dashboard Structure (3 Total)

### User Dashboard
**Purpose**: Personal marketplace account management
**Style**: Premium marketplace experience (Jiji-like but elevated)
**Target**: Everyday users buying and selling

### Moderator Dashboard
**Purpose**: Platform content moderation
**Style**: Clean moderation workspace
**Target**: Internal staff reviewers

### Super Admin Dashboard
**Purpose**: Business command center
**Style**: Billion-dollar business dashboard (Shopify/Stripe-like)
**Target**: Non-technical business owner

---

## User Dashboard Features

### Core Capabilities
- Buy listings
- Sell listings
- Open/manage stores
- Wallet management
- Escrow transactions
- Messaging
- Reviews
- Save listings
- Follow stores
- Promote listings

### Dynamic Content
The dashboard adapts based on user activity:
- No listings → "Start Selling Today" CTA
- Has stores → Store analytics
- Frequent buyer → Purchase analytics
- Frequent seller → Sales analytics

### Navigation Structure
```
Dashboard
├── My Listings
├── Create Listing
├── Orders
│   ├── Purchases
│   └── Sales
├── Messages
├── Saved Listings
├── Wishlist
├── Wallet
├── Escrow
├── My Store
├── Store Analytics
├── Followers
├── Following
├── Reviews
├── Notifications
├── Profile
├── Security
├── Settings
└── Support
```

### Homepage Elements
- Wallet Balance
- Escrow Balance
- Pending Orders
- Pending Sales
- Unread Messages
- Saved Listings count
- Store Performance
- Recent Purchases
- Recent Sales
- AI Recommendations
- Recently Viewed Listings
- Promote Listing CTA
- Create Listing CTA
- Continue Browsing
- Suggested Categories
- Recommended Products

---

## Moderator Dashboard Features

### Core Capabilities
- Approve/reject listings
- Suspend listings
- Approve/reject stores
- Approve/reject KYC
- Suspend users
- Review reports
- Resolve disputes
- Handle support tickets
- View moderation history

### Navigation Structure
```
Dashboard
├── Pending Listings
├── Reported Listings
├── Pending KYC
├── Users
├── Stores
├── Reported Reviews
├── Disputes
├── Support Tickets
├── Announcements
├── Notifications
├── Moderation Logs
├── Profile
└── Settings
```

### What Moderators NEVER See
- Wallet
- Escrow
- Purchases/Sales
- Wishlist
- Store Analytics
- Revenue
- Financial Reports
- Platform Settings
- Homepage Management
- Moderator Management
- Business Reports
- Developer Tools

---

## Super Admin Dashboard Features

### Core Capabilities
- Business overview and analytics
- User management
- Store management
- Listing management
- Moderator management (create/edit/suspend/delete)
- Permission assignment
- Financial management
- Marketing management
- CMS management
- Platform configuration
- Location management
- Business reporting

### Navigation Structure
```
Dashboard
├── Business Overview
├── Revenue
│   ├── Today's Sales
│   ├── Today's Revenue
│   ├── Weekly Revenue
│   ├── Monthly Revenue
│   ├── Annual Revenue
│   └── Revenue Analytics
├── Sales Analytics
├── Users
│   ├── Total Users
│   └── Verified Users
├── Stores
├── Listings
│   └── Featured Listings
├── Categories
│   ├── Categories
│   └── Subcategories
├── Content
│   ├── Products
│   ├── Vehicles
│   ├── Properties
│   ├── Services
│   └── Jobs
├── Moderators
│   ├── Create Moderator
│   ├── Edit Moderator
│   ├── Suspend Moderator
│   ├── Delete Moderator
│   └── Assign Permissions
├── Financial
│   ├── Wallet
│   ├── Escrow
│   ├── Payments
│   ├── Withdrawals
│   ├── Refund Requests
│   └── Transactions
├── Subscriptions
│   ├── Subscriptions
│   └── Subscription Plans
├── Marketing
│   ├── Advertisements
│   ├── Featured Ads
│   ├── Coupons
│   └── Promotions
├── Homepage
│   ├── Homepage Manager
│   ├── Banner Manager
│   └── Homepage Sections
├── CMS
│   ├── CMS
│   └── Blog
├── Reviews
├── Reports
├── Disputes
├── Support Tickets
├── Notifications
│   ├── Email Campaigns
│   ├── SMS Campaigns
│   └── Push Notifications
├── Locations
│   ├── Countries
│   ├── States
│   └── Cities
├── Configuration
│   ├── Currencies
│   └── Languages
├── Business Reports
│   ├── Sales Reports
│   ├── Revenue Reports
│   └── Export Reports
├── Audit Logs
├── Settings
│   ├── Business Settings
│   └── Platform Settings
└── Profile
```

### What Super Admin NEVER See
- Docker
- Redis
- RabbitMQ
- PostgreSQL
- FastAPI
- API endpoints
- Server metrics
- CPU/RAM usage
- Database tables
- Source code
- Environment variables
- Technical logs
- Infrastructure settings
- Cache management
- Queue monitoring
- Programming tools
- Developer options

---

## Mobile Navigation (User Only)

### Bottom Navigation Bar
```
Home | Saved | [SELL] | Messages | Dashboard
```

- **Home**: Marketplace homepage
- **Saved**: Saved listings
- **SELL**: Center floating button (prominent)
- **Messages**: Chat/messaging
- **Dashboard**: User dashboard

### Sell Flow
1. Tap SELL button
2. Choose category modal
   - Electronics
   - Vehicles
   - Property
   - Fashion
   - Services
   - Jobs
   - Agriculture
   - Animals
   - Business Equipment
   - Furniture
   - Phones
   - Computers
   - Others
3. Open Listing Wizard

---

## Role Hierarchy

```
Guest
  ↓ (register)
User
  ↓ (assigned by Super Admin)
Moderator
  ↓ (single account)
Super Admin
```

### Role Promotion Rules
- Guest → User: Self-registration
- User → Moderator: Cannot self-promote
- Moderator → Super Admin: Cannot self-promote
- Only Super Admin can create Moderators
- Only Super Admin can delete/suspend Moderators

---

## Permission Categories

### Marketplace Permissions
- View listings
- Create listings
- Edit own listings
- Delete own listings
- Promote listings
- Buy items
- Sell items
- Save listings
- Follow stores

### Financial Permissions
- View wallet balance
- Add funds
- Withdraw funds
- View escrow balance
- View transactions
- Request refunds

### Communication Permissions
- Send messages
- Receive messages
- Leave reviews
- Reply to reviews

### Store Permissions
- Create store
- Edit store
- Delete store
- View store analytics
- Manage store followers

### Moderation Permissions
- Approve listings
- Reject listings
- Suspend listings
- Approve stores
- Reject stores
- Approve KYC
- Reject KYC
- Suspend users
- View reports
- Resolve disputes
- Handle tickets

### Admin Permissions
- Create moderators
- Edit moderators
- Suspend moderators
- Delete moderators
- Assign permissions
- View audit logs
- Configure platform
- Manage homepage
- Manage campaigns
- View business reports
