# Velontri User Flow Diagrams

## Authentication Flows

### Registration Flow

```
[Guest User]
    ↓
[Visit /register]
    ↓
┌─────────────────────────────────────┐
│  Registration Form                  │
│  • Email                            │
│  • Phone Number                     │
│  • Password                        │
│  • Full Name                        │
│  • Country                          │
└─────────────────────────────────────┘
    ↓
[Submit Form]
    ↓
[Validate Input]
    ├─ Invalid → Show Error
    └─ Valid → Continue
    ↓
[Send Phone Verification SMS]
    ↓
[Enter OTP Code]
    ├─ Invalid → Retry (3 attempts)
    └─ Valid → Continue
    ↓
[Create User Account]
    ↓
[Assign User Role]
    ↓
[Create Wallet]
    ↓
[Send Welcome Email]
    ↓
[Redirect to /dashboard]
    ↓
[Show Onboarding Tour]
    ↓
[User Dashboard]
```

### Login Flow

```
[Guest User]
    ↓
[Visit /login]
    ↓
┌─────────────────────────────────────┐
│  Login Form                         │
│  • Email or Phone                   │
│  • Password                         │
└─────────────────────────────────────┘
    ↓
[Submit Form]
    ↓
[Validate Credentials]
    ├─ Invalid → Show Error
    └─ Valid → Check 2FA
    ↓
[2FA Enabled?]
    ├─ Yes → [Enter 2FA Code]
    │       ├─ Invalid → Retry
    │       └─ Valid → Continue
    └─ No → Continue
    ↓
[Generate JWT Token]
    ↓
[Extract Role from Token]
    ↓
[Resolve Home Path]
    ├─ user → /dashboard
    ├─ moderator → /mod
    └─ super_admin → /admin
    ↓
[Redirect to Dashboard]
```

### Logout Flow

```
[Authenticated User]
    ↓
[Click Logout]
    ↓
[Clear Session]
    ↓
[Clear Tokens]
    ↓
[Call Logout API]
    ↓
[Redirect to /]
    ↓
[Guest State]
```

---

## User Dashboard Flows

### Create Listing Flow

```
[User Dashboard]
    ↓
[Click "Create Listing" or SELL button]
    ↓
[Category Selection Modal]
    ├─ Electronics
    ├─ Vehicles
    ├─ Property
    ├─ Fashion
    ├─ Services
    ├─ Jobs
    ├─ Agriculture
    ├─ Animals
    ├─ Business Equipment
    ├─ Furniture
    ├─ Phones
    ├─ Computers
    └─ Others
    ↓
[Select Category]
    ↓
[Listing Wizard - Step 1: Basic Info]
┌─────────────────────────────────────┐
│  • Title                            │
│  • Description                      │
│  • Price                            │
│  • Condition (New/Used)             │
│  • Location                         │
└─────────────────────────────────────┘
    ↓
[Next]
    ↓
[Listing Wizard - Step 2: Media]
┌─────────────────────────────────────┐
│  • Upload Images (max 10)           │
│  • Set Cover Image                  │
│  • Add Video (optional)             │
└─────────────────────────────────────┘
    ↓
[Next]
    ↓
[Listing Wizard - Step 3: Details]
┌─────────────────────────────────────┐
│  • Category-specific attributes     │
│  • Shipping Options                 │
│  • Delivery Methods                 │
│  • Negotiable?                      │
└─────────────────────────────────────┘
    ↓
[Next]
    ↓
[Review Listing]
    ↓
[Submit for Review]
    ↓
[Listing Created]
    ├─ Auto-approved → [Listing Live]
    └─ Pending Review → [Pending State]
    ↓
[Redirect to My Listings]
```

### Buy Item Flow

```
[View Listing Details]
    ↓
[Click "Buy Now" or "Make Offer"]
    ↓
[Authenticated?]
    ├─ No → [Redirect to Login with return URL]
    └─ Yes → Continue
    ↓
[Check Item Availability]
    ├─ Sold → Show "Item Sold" message
    └─ Available → Continue
    ↓
[Select Quantity]
    ↓
[Select Delivery Method]
    ├─ Pickup
    ├─ Delivery
    └─ Shipping
    ↓
[Select Payment Method]
    ├─ Wallet
    ├─ Escrow
    └─ Card
    ↓
[Review Order]
    ↓
[Confirm Order]
    ↓
[Process Payment]
    ├─ Wallet → [Deduct from Wallet]
    ├─ Escrow → [Hold in Escrow]
    └─ Card → [Process Payment]
    ↓
[Create Order]
    ↓
[Notify Seller]
    ↓
[Order Confirmation]
    ↓
[Redirect to Orders → Purchases]
```

### Create Store Flow

```
[User Dashboard]
    ↓
[Click "My Store" or "Create Store"]
    ↓
[Has Store?]
    ├─ Yes → [Redirect to Store Dashboard]
    └─ No → [Show Create Store Form]
    ↓
[Store Creation Wizard]
┌─────────────────────────────────────┐
│  Step 1: Store Information          │
│  • Store Name                       │
│  • Store Description                │
│  • Store Category                   │
│  • Store Logo                       │
│  • Store Banner                     │
└─────────────────────────────────────┘
    ↓
[Next]
    ↓
┌─────────────────────────────────────┐
│  Step 2: Location                   │
│  • Address                          │
│  • City                             │
│  • State                            │
│  • Country                          │
│  • Map Location                     │
└─────────────────────────────────────┘
    ↓
[Next]
    ↓
┌─────────────────────────────────────┐
│  Step 3: Contact Information        │
│  • Phone Number                     │
│  • Email                            │
│  • WhatsApp (optional)              │
│  • Social Media (optional)          │
└─────────────────────────────────────┘
    ↓
[Next]
    ↓
[Review Store]
    ↓
[Submit Store]
    ↓
[Store Created]
    ↓
[Redirect to Store Dashboard]
```

### Wallet Flow

```
[User Dashboard]
    ↓
[Click "Wallet"]
    ↓
[Wallet Dashboard]
┌─────────────────────────────────────┐
│  • Available Balance                │
│  • Escrow Balance                   │
│  • Recent Transactions              │
└─────────────────────────────────────┘
    ↓
[Add Funds]
    ↓
[Select Payment Method]
    ├─ Card
    ├─ Bank Transfer
    └─ USSD
    ↓
[Enter Amount]
    ↓
[Process Payment]
    ↓
[Funds Added]
    ↓
[Withdraw Funds]
    ↓
[Select Withdrawal Method]
    ├─ Bank Transfer
    └─ USSD
    ↓
[Enter Amount]
    ↓
[Enter Bank Details]
    ↓
[Confirm Withdrawal]
    ↓
[Process Withdrawal]
    ↓
[Withdrawal Requested]
```

---

## Moderator Dashboard Flows

### Review Listing Flow

```
[Moderator Dashboard]
    ↓
[Click "Pending Listings"]
    ↓
[Pending Listings Queue]
    ↓
[Select Listing to Review]
    ↓
[Listing Review Page]
┌─────────────────────────────────────┐
│  • Listing Details                  │
│  • Images                           │
│  • Seller Information              │
│  • Category Compliance Check        │
│  • Price Validation                │
│  • Description Quality Check        │
└─────────────────────────────────────┘
    ↓
[Review Decision]
    ├─ Approve → [Listing Goes Live]
    │           → [Notify Seller]
    │           → [Next Pending Listing]
    │
    ├─ Reject → [Select Reason]
    │           ├─ Inappropriate Content
    │           ├─ Invalid Price
    │           ├─ Fake Item
    │           ├─ Duplicate Listing
    │           └─ Other
    │           → [Notify Seller]
    │           → [Next Pending Listing]
    │
    └─ Flag for Manual Review
                → [Escalate to Senior Moderator]
                → [Next Pending Listing]
```

### KYC Review Flow

```
[Moderator Dashboard]
    ↓
[Click "Pending KYC"]
    ↓
[Pending KYC Queue]
    ↓
[Select KYC Request]
    ↓
[KYC Review Page]
┌─────────────────────────────────────┐
│  • User Information                 │
│  • ID Document (Front)             │
│  • ID Document (Back)              │
│  • Selfie Photo                     │
│  • Address Proof                    │
│  • Document Validation Check       │
│  • Face Match Check                │
└─────────────────────────────────────┘
    ↓
[Review Decision]
    ├─ Approve → [KYC Verified]
    │           → [User Badge Updated]
    │           → [Notify User]
    │           → [Next Pending KYC]
    │
    └─ Reject → [Select Reason]
                ├─ Invalid Document
                ├• Blurred Image
                ├• Expired Document
                ├• Mismatch Information
                └• Other
                → [Notify User]
                → [Next Pending KYC]
```

### Dispute Resolution Flow

```
[Moderator Dashboard]
    ↓
[Click "Disputes"]
    ↓
[Open Disputes List]
    ↓
[Select Dispute]
    ↓
[Dispute Details Page]
┌─────────────────────────────────────┐
│  • Dispute Information              │
│  • Buyer Statement                  │
│  • Seller Statement                 │
│  • Order Details                    │
│  • Evidence Files                  │
│  • Communication History           │
└─────────────────────────────────────┘
    ↓
[Review Evidence]
    ↓
[Make Decision]
    ├─ Resolve in Favor of Buyer
    │   → [Refund to Buyer]
    │   → [Return Item to Seller]
    │   → [Notify Both Parties]
    │   → [Close Dispute]
    │
    ├─ Resolve in Favor of Seller
    │   → [Release Funds to Seller]
    │   → [Item Stays with Buyer]
    │   → [Notify Both Parties]
    │   → [Close Dispute]
    │
    └─ Escalate to Super Admin
        → [Super Admin Review]
        → [Await Decision]
```

---

## Super Admin Dashboard Flows

### Create Moderator Flow

```
[Super Admin Dashboard]
    ↓
[Click "Moderators" → "Create Moderator"]
    ↓
[Moderator Creation Form]
┌─────────────────────────────────────┐
│  • Full Name                        │
│  • Email                            │
│  • Phone Number                     │
│  • Department                      │
│  • Assigned Permissions             │
│    ☑ Approve Listings              │
│    ☑ Approve KYC                   │
│    ☑ Handle Disputes               │
│    ☑ View Reports                  │
└─────────────────────────────────────┘
    ↓
[Send Invitation Email]
    ↓
[Moderator Account Created]
    ↓
[Set Temporary Password]
    ↓
[Notify Moderator]
    ↓
[Moderator Can Login]
```

### Assign Permissions Flow

```
[Super Admin Dashboard]
    ↓
[Click "Moderators"]
    ↓
[Select Moderator]
    ↓
[Click "Assign Permissions"]
    ↓
[Permission Matrix]
┌─────────────────────────────────────┐
│  Marketplace Permissions           │
│  ☑ Approve Listings                │
│  ☐ Reject Listings                 │
│  ☐ Suspend Listings                │
│                                     │
│  KYC Permissions                   │
│  ☑ Approve KYC                     │
│  ☐ Reject KYC                      │
│                                     │
│  Dispute Permissions               │
│  ☐ Resolve Disputes                │
│  ☐ Handle Tickets                  │
└─────────────────────────────────────┘
    ↓
[Save Permissions]
    ↓
[Permissions Updated]
    ↓
[Notify Moderator]
```

### Business Report Flow

```
[Super Admin Dashboard]
    ↓
[Click "Reports" → "Business Reports"]
    ↓
[Report Selection]
┌─────────────────────────────────────┐
│  • Date Range                       │
│  • Report Type                     │
│    • Revenue                        │
│    • Sales                          │
│    • Users                          │
│    • Stores                         │
│  • Export Format                    │
│    • PDF                            │
│    • Excel                          │
│    • CSV                            │
└─────────────────────────────────────┘
    ↓
[Generate Report]
    ↓
[Report Generated]
    ↓
[View Report]
    ↓
[Download Report]
    ↓
[Share Report]
    ├─ Email
    └─ Share Link
```

---

## Error Handling Flows

### Session Expired Flow

```
[User Action]
    ↓
[API Call]
    ↓
[401 Unauthorized]
    ↓
[Check Token Validity]
    ├─ Valid → Retry
    └─ Expired → Continue
    ↓
[Attempt Token Refresh]
    ├─ Success → [Retry Original Request]
    └─ Failed → Continue
    ↓
[Clear Session]
    ↓
[Clear Tokens]
    ↓
[Show Session Expired Modal]
┌─────────────────────────────────────┐
│  Your session has expired.          │
│  Please log in again.               │
│                                     │
│  [Login Now]                         │
└─────────────────────────────────────┘
    ↓
[Redirect to /login]
```

### Permission Denied Flow

```
[User Action]
    ↓
[API Call]
    ↓
[403 Forbidden]
    ↓
[Check User Permissions]
    ↓
[Show Permission Denied Modal]
┌─────────────────────────────────────┐
│  Access Denied                       │
│                                     │
│  You don't have permission to      │
│  perform this action.               │
│                                     │
│  [Contact Support]                  │
└─────────────────────────────────────┘
    ↓
[Log Attempt]
    ↓
[Return to Previous Page]
```

### Resource Not Found Flow

```
[User Navigation]
    ↓
[Route Not Found]
    ↓
[Show 404 Page]
┌─────────────────────────────────────┐
│  404 - Page Not Found               │
│                                     │
│  The page you're looking for        │
│  doesn't exist or has been moved.   │
│                                     │
│  [Go to Dashboard]                  │
│  [Go to Homepage]                   │
└─────────────────────────────────────┘
    ↓
[Log 404 Error]
```

---

## Mobile-Specific Flows

### Mobile Sell Flow

```
[Mobile User]
    ↓
[Tap SELL Button (Bottom Nav)]
    ↓
[Category Sheet Slides Up]
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
[Select Category]
    ↓
[Camera Opens for Photo Upload]
    ↓
[Take Photos or Select from Gallery]
    ↓
[Fill Listing Details]
    ↓
[Submit Listing]
    ↓
[Listing Created]
```

### Mobile Navigation Flow

```
[Mobile User]
    ↓
[Swipe Right]
    ↓
[Sidebar Slides In]
    ↓
[Tap Navigation Item]
    ↓
[Navigate to Page]
    ↓
[Sidebar Slides Out]
```

---

## Notification Flows

### New Message Notification

```
[New Message Received]
    ↓
[Push Notification Sent]
    ↓
[User Taps Notification]
    ↓
[Open Messages]
    ↓
[Scroll to Conversation]
    ↓
[Mark as Read]
```

### Order Status Notification

```
[Order Status Changed]
    ↓
[Send Notification]
    ├─ Push Notification
    ├─ Email Notification
    └─ SMS Notification
    ↓
[User Views Notification]
    ↓
[Redirect to Order Details]
```

### Moderation Notification

```
[Listing Approved/Rejected]
    ↓
[Notify Seller]
    ├─ Email Notification
    └─ In-App Notification
    ↓
[Seller Views Notification]
    ↓
[Redirect to My Listings]
```

---

## Onboarding Flows

### New User Onboarding

```
[User Registration Complete]
    ↓
[First Login]
    ↓
[Show Welcome Modal]
┌─────────────────────────────────────┐
│  Welcome to Velontri!               │
│                                     │
│  Let's get you started.             │
│                                     │
│  [Start Tour]  [Skip Tour]          │
└─────────────────────────────────────┘
    ↓
[Tour Step 1: Dashboard]
    ↓
[Tour Step 2: Create Listing]
    ↓
[Tour Step 3: Browse Listings]
    ↓
[Tour Step 4: Messages]
    ↓
[Tour Complete]
    ↓
[Show "Get Started" Tips]
```

### New Moderator Onboarding

```
[Moderator Account Created]
    ↓
[First Login]
    ↓
[Show Moderator Welcome]
┌─────────────────────────────────────┐
│  Welcome, Moderator!               │
│                                     │
│  Here's how to moderate listings:  │
│                                     │
│  [Watch Tutorial]  [Start Working]  │
└─────────────────────────────────────┘
    ↓
[Moderation Guidelines]
    ↓
[Start Moderating]
```
