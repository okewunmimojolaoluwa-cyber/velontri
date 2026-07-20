# Velontri Feature Mapping Matrix

## Overview

This document maps every Velontri feature to its correct dashboard, ensuring no features are misplaced between User, Moderator, and Super Admin dashboards.

---

## Feature Mapping Table

| Feature | User Dashboard | Moderator Dashboard | Super Admin Dashboard | Notes |
|---------|----------------|---------------------|----------------------|-------|
| **MARKETPLACE** | | | | |
| Browse Listings | ✅ | ✅ | ✅ | Public marketplace access |
| Search Listings | ✅ | ✅ | ✅ | Public marketplace access |
| View Listing Details | ✅ | ✅ | ✅ | Public marketplace access |
| Create Listings | ✅ | ❌ | ✅ | Users can create, Admin can create for testing |
| Edit Own Listings | ✅ | ❌ | ✅ | Users edit own, Admin edits any |
| Delete Own Listings | ✅ | ❌ | ✅ | Users delete own, Admin deletes any |
| Edit Any Listing | ❌ | ❌ | ✅ | Admin only |
| Delete Any Listing | ❌ | ❌ | ✅ | Admin only |
| Promote Listings | ✅ | ❌ | ✅ | Users promote own, Admin manages promotions |
| Buy Items | ✅ | ❌ | ✅ | Users buy, Admin can test |
| Sell Items | ✅ | ❌ | ✅ | Users sell, Admin can test |
| Save Listings | ✅ | ❌ | ✅ | Users save, Admin can save |
| Follow Stores | ✅ | ❌ | ✅ | Users follow, Admin can follow |
| **FINANCIAL** | | | | |
| View Own Wallet Balance | ✅ | ❌ | ✅ | Users view own, Admin views any |
| Add Funds to Wallet | ✅ | ❌ | ✅ | Users add funds, Admin can add |
| Withdraw from Wallet | ✅ | ❌ | ✅ | Users withdraw, Admin can withdraw |
| View Any Wallet Balance | ❌ | ❌ | ✅ | Admin only |
| View Own Escrow Balance | ✅ | ❌ | ✅ | Users view own, Admin views any |
| View Any Escrow Balance | ❌ | ❌ | ✅ | Admin only |
| View Own Transactions | ✅ | ❌ | ✅ | Users view own, Admin views any |
| View Any Transactions | ❌ | ❌ | ✅ | Admin only |
| Request Refunds | ✅ | ❌ | ✅ | Users request, Admin processes |
| Process Refunds | ❌ | ❌ | ✅ | Admin only |
| View Revenue Reports | ❌ | ❌ | ✅ | Admin only |
| View Sales Reports | ❌ | ❌ | ✅ | Admin only |
| **COMMUNICATION** | | | | |
| Send Messages | ✅ | ❌ | ✅ | Users send, Admin can send |
| Receive Messages | ✅ | ❌ | ✅ | Users receive, Admin can receive |
| View Any Messages | ❌ | ❌ | ✅ | Admin only |
| Leave Reviews | ✅ | ❌ | ✅ | Users leave, Admin can leave |
| Reply to Reviews | ✅ | ❌ | ✅ | Users reply to own, Admin replies to any |
| Delete Own Reviews | ✅ | ❌ | ✅ | Users delete own, Admin deletes any |
| Delete Any Reviews | ❌ | ❌ | ✅ | Admin only |
| View Notifications | ✅ | ✅ | ✅ | All roles receive notifications |
| Send Announcements | ❌ | ✅ | ✅ | Moderators send, Admin sends |
| Send Email Campaigns | ❌ | ❌ | ✅ | Admin only |
| Send SMS Campaigns | ❌ | ❌ | ✅ | Admin only |
| Send Push Notifications | ❌ | ❌ | ✅ | Admin only |
| **STORE** | | | | |
| Create Store | ✅ | ❌ | ✅ | Users create, Admin can create |
| Edit Own Store | ✅ | ❌ | ✅ | Users edit own, Admin edits any |
| Delete Own Store | ✅ | ❌ | ✅ | Users delete own, Admin deletes any |
| Edit Any Store | ❌ | ❌ | ✅ | Admin only |
| Delete Any Store | ❌ | ❌ | ✅ | Admin only |
| View Store Analytics | ✅ | ❌ | ✅ | Users view own, Admin views any |
| View Any Store Analytics | ❌ | ❌ | ✅ | Admin only |
| Manage Store Followers | ✅ | ❌ | ✅ | Users manage own, Admin manages any |
| **MODERATION** | | | | |
| Approve Listings | ❌ | ✅ | ✅ | Moderators approve, Admin can approve |
| Reject Listings | ❌ | ✅ | ✅ | Moderators reject, Admin can reject |
| Suspend Listings | ❌ | ✅ | ✅ | Moderators suspend, Admin can suspend |
| Approve Stores | ❌ | ✅ | ✅ | Moderators approve, Admin can approve |
| Reject Stores | ❌ | ✅ | ✅ | Moderators reject, Admin can reject |
| Suspend Stores | ❌ | ✅ | ✅ | Moderators suspend, Admin can suspend |
| Approve KYC | ❌ | ✅ | ✅ | Moderators approve, Admin can approve |
| Reject KYC | ❌ | ✅ | ✅ | Moderators reject, Admin can reject |
| Suspend Users | ❌ | ✅ | ✅ | Moderators suspend, Admin can suspend |
| View Reports | ❌ | ✅ | ✅ | Moderators view, Admin views |
| Resolve Disputes | ❌ | ✅ | ✅ | Moderators resolve, Admin resolves |
| Handle Support Tickets | ❌ | ✅ | ✅ | Moderators handle, Admin handles |
| View Moderation Logs | ❌ | ✅ | ✅ | Moderators view own, Admin views all |
| **ADMIN** | | | | |
| Create Moderators | ❌ | ❌ | ✅ | Super Admin only |
| Edit Moderators | ❌ | ❌ | ✅ | Super Admin only |
| Suspend Moderators | ❌ | ❌ | ✅ | Super Admin only |
| Delete Moderators | ❌ | ❌ | ✅ | Super Admin only |
| Assign Permissions | ❌ | ❌ | ✅ | Super Admin only |
| Remove Permissions | ❌ | ❌ | ✅ | Super Admin only |
| View Audit Logs | ❌ | ❌ | ✅ | Super Admin only |
| Configure Platform | ❌ | ❌ | ✅ | Super Admin only |
| Manage Homepage | ❌ | ❌ | ✅ | Super Admin only |
| Manage Categories | ❌ | ❌ | ✅ | Super Admin only |
| Manage Locations | ❌ | ❌ | ✅ | Super Admin only |
| Manage Currencies | ❌ | ❌ | ✅ | Super Admin only |
| Manage Languages | ❌ | ❌ | ✅ | Super Admin only |
| Create Coupons | ❌ | ❌ | ✅ | Super Admin only |
| Create Promotions | ❌ | ❌ | ✅ | Super Admin only |
| Manage Subscriptions | ❌ | ❌ | ✅ | Super Admin only |
| Export Reports | ❌ | ❌ | ✅ | Super Admin only |
| View Business Settings | ❌ | ❌ | ✅ | Super Admin only |
| Edit Business Settings | ❌ | ❌ | ✅ | Super Admin only |
| View Platform Settings | ❌ | ❌ | ✅ | Super Admin only |
| Edit Platform Settings | ❌ | ❌ | ✅ | Super Admin only |

---

## Dashboard Feature Summary

### User Dashboard Features (27 features)

**Marketplace (11)**
- Browse Listings
- Search Listings
- View Listing Details
- Create Listings
- Edit Own Listings
- Delete Own Listings
- Promote Listings
- Buy Items
- Sell Items
- Save Listings
- Follow Stores

**Financial (6)**
- View Own Wallet Balance
- Add Funds to Wallet
- Withdraw from Wallet
- View Own Escrow Balance
- View Own Transactions
- Request Refunds

**Communication (6)**
- Send Messages
- Receive Messages
- Leave Reviews
- Reply to Reviews
- Delete Own Reviews
- View Notifications

**Store (4)**
- Create Store
- Edit Own Store
- Delete Own Store
- View Store Analytics

### Moderator Dashboard Features (16 features)

**Marketplace (3)**
- Browse Listings
- Search Listings
- View Listing Details

**Communication (2)**
- View Notifications
- Send Announcements

**Moderation (11)**
- Approve Listings
- Reject Listings
- Suspend Listings
- Approve Stores
- Reject Stores
- Suspend Stores
- Approve KYC
- Reject KYC
- Suspend Users
- View Reports
- Resolve Disputes
- Handle Support Tickets
- View Moderation Logs

### Super Admin Dashboard Features (67 features)

**All User Features (27)**
- All User Dashboard features

**All Moderator Features (16)**
- All Moderator Dashboard features

**Admin-Only Features (24)**
- Edit Any Listing
- Delete Any Listing
- View Any Wallet Balance
- View Any Escrow Balance
- View Any Transactions
- Process Refunds
- View Revenue Reports
- View Sales Reports
- View Any Messages
- Delete Any Reviews
- Send Email Campaigns
- Send SMS Campaigns
- Send Push Notifications
- Edit Any Store
- Delete Any Store
- View Any Store Analytics
- Manage Store Followers
- Create Moderators
- Edit Moderators
- Suspend Moderators
- Delete Moderators
- Assign Permissions
- Remove Permissions
- View Audit Logs
- Configure Platform
- Manage Homepage
- Manage Categories
- Manage Locations
- Manage Currencies
- Manage Languages
- Create Coupons
- Create Promotions
- Manage Subscriptions
- Export Reports
- View Business Settings
- Edit Business Settings
- View Platform Settings
- Edit Platform Settings

---

## Feature Dashboard Assignment Rules

### Rule 1: User-Only Features
Features that only regular users should access:
- Creating/editing own listings
- Buying/selling items
- Managing own wallet
- Managing own store
- Personal messaging

### Rule 2: Moderator-Only Features
Features that only internal staff should access:
- Content moderation (approve/reject)
- KYC verification
- Dispute resolution
- Support ticket handling
- Announcement creation

### Rule 3: Super Admin-Only Features
Features that only the business owner should access:
- Moderator management
- Platform configuration
- Business analytics
- Financial oversight
- System administration

### Rule 4: Shared Features
Features that multiple roles can access:
- Public marketplace browsing
- Viewing notifications
- Viewing reports (different scopes)

---

## Feature Migration Checklist

### Features to Remove from User Dashboard
- ❌ Approve listings (move to Moderator)
- ❌ Reject listings (move to Moderator)
- ❌ Approve KYC (move to Moderator)
- ❌ Reject KYC (move to Moderator)
- ❌ View moderation logs (move to Moderator)
- ❌ Handle support tickets (move to Moderator)
- ❌ Resolve disputes (move to Moderator)
- ❌ Create moderators (move to Super Admin)
- ❌ Edit moderators (move to Super Admin)
- ❌ Platform settings (move to Super Admin)
- ❌ Business reports (move to Super Admin)

### Features to Add to User Dashboard
- ✅ Dynamic homepage based on activity
- ✅ Store analytics
- ✅ Purchase analytics
- ✅ Sales analytics
- ✅ AI recommendations
- ✅ Recently viewed listings

### Features to Add to Moderator Dashboard
- ✅ Pending listings queue
- ✅ Reported listings queue
- ✅ Pending KYC queue
- ✅ Moderation performance metrics
- ✅ Recent moderation actions

### Features to Add to Super Admin Dashboard
- ✅ Business overview KPIs
- ✅ Revenue analytics
- ✅ Sales analytics
- ✅ Moderator management
- ✅ Permission management
- ✅ Audit logs
- ✅ Platform configuration
- ✅ Marketing campaigns
- ✅ Homepage management

---

## Feature Validation Matrix

### User Dashboard Validation

| Feature | Required | Implemented | Notes |
|---------|-----------|--------------|-------|
| Browse Listings | ✅ | ✅ | Public access |
| Create Listings | ✅ | ✅ | User only |
| Edit Own Listings | ✅ | ✅ | Ownership check |
| Buy Items | ✅ | ✅ | User only |
| Sell Items | ✅ | ✅ | User only |
| Wallet Management | ✅ | ✅ | User only |
| Store Management | ✅ | ✅ | User only |
| Messaging | ✅ | ✅ | User only |
| Reviews | ✅ | ✅ | User only |
| Notifications | ✅ | ✅ | User only |

### Moderator Dashboard Validation

| Feature | Required | Implemented | Notes |
|---------|-----------|--------------|-------|
| Approve Listings | ✅ | ✅ | Moderator only |
| Reject Listings | ✅ | ✅ | Moderator only |
| Approve KYC | ✅ | ✅ | Moderator only |
| Reject KYC | ✅ | ✅ | Moderator only |
| Suspend Users | ✅ | ✅ | Moderator only |
| Resolve Disputes | ✅ | ✅ | Moderator only |
| Handle Tickets | ✅ | ✅ | Moderator only |
| View Logs | ✅ | ✅ | Moderator only |
| Announcements | ✅ | ✅ | Moderator only |

### Super Admin Dashboard Validation

| Feature | Required | Implemented | Notes |
|---------|-----------|--------------|-------|
| Create Moderators | ✅ | ✅ | Super Admin only |
| Edit Moderators | ✅ | ✅ | Super Admin only |
| Assign Permissions | ✅ | ✅ | Super Admin only |
| View Audit Logs | ✅ | ✅ | Super Admin only |
| Configure Platform | ✅ | ✅ | Super Admin only |
| Manage Homepage | ✅ | ✅ | Super Admin only |
| Business Analytics | ✅ | ✅ | Super Admin only |
| Financial Oversight | ✅ | ✅ | Super Admin only |

---

## Feature Dependencies

### User Dashboard Dependencies
- Wallet → Requires user account
- Store → Requires user account
- Listings → Requires user account
- Messaging → Requires user account
- Reviews → Requires purchase/listing

### Moderator Dashboard Dependencies
- Approve Listings → Requires pending listings
- Approve KYC → Requires KYC submissions
- Resolve Disputes → Requires open disputes
- Handle Tickets → Requires support tickets

### Super Admin Dashboard Dependencies
- Create Moderators → Requires Super Admin role
- Business Analytics → Requires transaction data
- Platform Settings → Requires configuration access
- Audit Logs → Requires system logging

---

## Feature Priority Matrix

### Phase 1: Core Features (High Priority)
- User authentication
- User dashboard navigation
- Create/edit listings
- Buy/sell items
- Wallet management
- Messaging

### Phase 2: Moderation Features (High Priority)
- Moderator dashboard navigation
- Approve/reject listings
- KYC verification
- Dispute resolution
- Support tickets

### Phase 3: Admin Features (High Priority)
- Super Admin dashboard navigation
- Moderator management
- Business analytics
- Platform configuration
- Audit logs

### Phase 4: Enhanced Features (Medium Priority)
- Store management
- Reviews system
- Notifications
- Announcements
- Campaigns

### Phase 5: Advanced Features (Low Priority)
- AI recommendations
- Advanced analytics
- Marketing automation
- Export reports
- Multi-language support

---

## Feature Testing Checklist

### User Dashboard Features
- [ ] User can create listing
- [ ] User can edit own listing
- [ ] User cannot edit others' listings
- [ ] User can buy item
- [ ] User can sell item
- [ ] User can add funds to wallet
- [ ] User can withdraw from wallet
- [ ] User can create store
- [ ] User can send message
- [ ] User can leave review
- [ ] User can delete own review
- [ ] User cannot delete others' reviews

### Moderator Dashboard Features
- [ ] Moderator can approve listing
- [ ] Moderator can reject listing
- [ ] Moderator can approve KYC
- [ ] Moderator can reject KYC
- [ ] Moderator can suspend user
- [ ] Moderator can resolve dispute
- [ ] Moderator can handle ticket
- [ ] Moderator can view logs
- [ ] Moderator cannot create moderator
- [ ] Moderator cannot access financial data

### Super Admin Dashboard Features
- [ ] Super Admin can create moderator
- [ ] Super Admin can edit moderator
- [ ] Super Admin can suspend moderator
- [ ] Super Admin can delete moderator
- [ ] Super Admin can assign permissions
- [ ] Super Admin can view audit logs
- [ ] Super Admin can configure platform
- [ ] Super Admin can manage homepage
- [ ] Super Admin can view business analytics
- [ ] Super Admin can export reports

---

## Feature Rollout Plan

### Week 1: User Dashboard
- Implement user dashboard layout
- Implement user navigation
- Implement create/edit listings
- Implement buy/sell items
- Implement wallet management

### Week 2: User Dashboard Continued
- Implement store management
- Implement messaging
- Implement reviews
- Implement notifications
- Implement dynamic homepage

### Week 3: Moderator Dashboard
- Implement moderator dashboard layout
- Implement moderator navigation
- Implement approve/reject listings
- Implement KYC verification
- Implement dispute resolution

### Week 4: Moderator Dashboard Continued
- Implement support tickets
- Implement announcements
- Implement moderation logs
- Implement performance metrics
- Test moderation workflows

### Week 5: Super Admin Dashboard
- Implement super admin dashboard layout
- Implement super admin navigation
- Implement moderator management
- Implement permission management
- Implement audit logs

### Week 6: Super Admin Dashboard Continued
- Implement business analytics
- Implement platform configuration
- Implement homepage management
- Implement marketing campaigns
- Implement export reports

### Week 7: Integration & Testing
- Integrate all dashboards
- Test role-based access
- Test navigation between dashboards
- Test permission system
- Fix bugs and issues

### Week 8: Polish & Launch
- Optimize performance
- Improve responsive layouts
- Enhance accessibility
- Final testing
- Launch
