# Velontri Component Hierarchy

## Overview

Velontri uses a strict component hierarchy to ensure maintainability and reusability. Each dashboard has its own component tree with no shared layouts between dashboards.

---

## User Dashboard Component Hierarchy

```
src/app/dashboard/
├── layout.tsx                          # UserDashboardLayout
│   ├── UserSidebar
│   │   ├── UserSidebarHeader
│   │   ├── UserSidebarNav
│   │   │   ├── UserNavLink
│   │   │   ├── UserNavLinkGroup
│   │   │   └── UserNavLinkItem
│   │   ├── UserSidebarFooter
│   │   └── UserSidebarUserMenu
│   ├── UserHeader
│   │   ├── UserHeaderLogo
│   │   ├── UserHeaderSearch
│   │   ├── UserHeaderActions
│   │   │   ├── UserHeaderMessages
│   │   │   ├── UserHeaderNotifications
│   │   │   └── UserHeaderUserMenu
│   └── UserBottomNav (mobile only)
│       ├── BottomNavItem
│       └── BottomNavSellButton
└── page.tsx                            # UserDashboardHomepage
    ├── UserWelcomeBanner
    ├── UserStatsCards
    │   ├── WalletCard
    │   ├── EscrowCard
    │   ├── OrdersCard
    │   └── ListingsCard
    ├── UserQuickActions
    │   ├── QuickActionButton
    ├── UserActivityChart
    ├── UserRecentTransactions
    │   ├── TransactionItem
    ├── UserGetStarted
    │   ├── GetStartedCard
    └── UserRecommendations
        ├── RecommendationCard
```

### User Dashboard Components

#### Layout Components
- **UserDashboardLayout**: Main layout wrapper for user dashboard
- **UserSidebar**: Desktop sidebar navigation
- **UserHeader**: Top header bar
- **UserBottomNav**: Mobile bottom navigation

#### Navigation Components
- **UserSidebarNav**: Sidebar navigation menu
- **UserNavLink**: Individual navigation link
- **UserNavLinkGroup**: Grouped navigation items
- **BottomNavItem**: Mobile bottom nav item
- **BottomNavSellButton**: Prominent sell button

#### Dashboard Components
- **UserWelcomeBanner**: Personalized welcome message
- **UserStatsCards**: Statistics cards grid
- **WalletCard**: Wallet balance display
- **EscrowCard**: Escrow balance display
- **UserQuickActions**: Quick action buttons
- **UserActivityChart**: Activity visualization
- **UserRecentTransactions**: Recent transactions list
- **UserGetStarted**: Onboarding cards for new users
- **UserRecommendations**: AI-powered recommendations

---

## Moderator Dashboard Component Hierarchy

```
src/app/mod/
├── layout.tsx                          # ModeratorDashboardLayout
│   ├── ModSidebar
│   │   ├── ModSidebarHeader
│   │   ├── ModSidebarNav
│   │   │   ├── ModNavLink
│   │   │   └── ModNavLinkBadge
│   │   ├── ModSidebarFooter
│   │   └── ModSidebarUserMenu
│   ├── ModHeader
│   │   ├── ModHeaderLogo
│   │   ├── ModHeaderSearch
│   │   ├── ModHeaderActions
│   │   └── ModHeaderUserMenu
│   └── ModTopNav (mobile only)
│       ├── ModTopNavItem
└── page.tsx                            # ModeratorDashboardHomepage
    ├── ModOverviewStats
    │   ├── StatCard
    │   ├── PendingListingsCard
    │   ├── ReportedListingsCard
    │   ├── PendingKycCard
    │   ├── DisputesCard
    │   └── TicketsCard
    ├── ModPendingListings
    │   ├── ListingReviewCard
    │   │   ├── ListingImage
    │   │   ├── ListingInfo
    │   │   ├── ListingActions
    │   │   │   ├── ApproveButton
    │   │   │   ├── RejectButton
    │   │   │   └── ReviewButton
    │   └── ListingFilterBar
    ├── ModRecentActions
    │   ├── ActionLogItem
    └── ModPerformanceChart
```

### Moderator Dashboard Components

#### Layout Components
- **ModeratorDashboardLayout**: Main layout wrapper for moderator dashboard
- **ModSidebar**: Desktop sidebar navigation
- **ModHeader**: Top header bar
- **ModTopNav**: Mobile top navigation

#### Navigation Components
- **ModSidebarNav**: Sidebar navigation menu
- **ModNavLink**: Individual navigation link
- **ModNavLinkBadge**: Badge for pending items

#### Dashboard Components
- **ModOverviewStats**: Moderation statistics overview
- **StatCard**: Generic statistic card
- **PendingListingsCard**: Pending listings count card
- **ListingReviewCard**: Individual listing review card
- **ListingActions**: Action buttons for listing review
- **ModRecentActions**: Recent moderation actions
- **ModPerformanceChart**: Moderator performance visualization

---

## Super Admin Dashboard Component Hierarchy

```
src/app/admin/
├── layout.tsx                          # SuperAdminDashboardLayout
│   ├── AdminSidebar
│   │   ├── AdminSidebarHeader
│   │   ├── AdminSidebarNav
│   │   │   ├── AdminNavLink
│   │   │   ├── AdminNavLinkGroup
│   │   │   └── AdminNavLinkItem
│   │   ├── AdminSidebarFooter
│   │   └── AdminSidebarUserMenu
│   ├── AdminHeader
│   │   ├── AdminHeaderLogo
│   │   ├── AdminHeaderSearch
│   │   ├── AdminHeaderActions
│   │   └── AdminHeaderUserMenu
│   └── AdminMobileMenu (mobile only)
│       ├── AdminMobileMenuItem
└── page.tsx                            # SuperAdminDashboardHomepage
    ├── AdminBusinessOverview
    ├── AdminRevenueCards
    │   ├── RevenueCard
    │   ├── TodayRevenueCard
    │   ├── WeeklyRevenueCard
    │   ├── MonthlyRevenueCard
    │   └── AnnualRevenueCard
    ├── AdminSalesCards
    │   ├── SalesCard
    │   └── TodaySalesCard
    ├── AdminRevenueChart
    │   ├── LineChart
    │   ├── ChartTooltip
    │   └── ChartLegend
    ├── AdminSalesChart
    │   ├── BarChart
    │   ├── ChartTooltip
    │   └── ChartLegend
    ├── AdminQuickStats
    │   ├── QuickStatCard
    │   ├── TotalUsersCard
    │   ├── VerifiedUsersCard
    │   ├── ActiveStoresCard
    │   └── TotalListingsCard
    ├── AdminTopCategories
    │   ├── CategoryRankItem
    └── AdminRecentActivity
        ├── ActivityLogItem
```

### Super Admin Dashboard Components

#### Layout Components
- **SuperAdminDashboardLayout**: Main layout wrapper for super admin dashboard
- **AdminSidebar**: Desktop sidebar navigation
- **AdminHeader**: Top header bar
- **AdminMobileMenu**: Mobile hamburger menu

#### Navigation Components
- **AdminSidebarNav**: Sidebar navigation menu
- **AdminNavLink**: Individual navigation link
- **AdminNavLinkGroup**: Grouped navigation items

#### Dashboard Components
- **AdminBusinessOverview**: Business overview section
- **AdminRevenueCards**: Revenue statistics cards
- **RevenueCard**: Generic revenue card
- **AdminRevenueChart**: Revenue line chart
- **AdminSalesChart**: Sales bar chart
- **AdminQuickStats**: Quick statistics grid
- **QuickStatCard**: Generic quick stat card
- **AdminTopCategories**: Top performing categories
- **AdminRecentActivity**: Recent system activity

---

## Shared Component Library

```
src/components/shared/
├── ui/                                  # shadcn/ui components
│   ├── button/
│   ├── card/
│   ├── input/
│   ├── select/
│   ├── dialog/
│   ├── dropdown-menu/
│   ├── tabs/
│   ├── table/
│   ├── badge/
│   ├── avatar/
│   ├── toast/
│   └── ...
├── charts/                              # Recharts components
│   ├── LineChart/
│   ├── BarChart/
│   ├── PieChart/
│   ├── AreaChart/
│   └── ChartComponents/
│       ├── ChartTooltip/
│       ├── ChartLegend/
│       └── ChartContainer/
├── forms/                               # Form components
│   ├── FormField/
│   ├── FormLabel/
│   ├── FormMessage/
│   ├── FormError/
│   └── FormSuccess/
├── loading/                             # Loading states
│   ├── Spinner/
│   ├── Skeleton/
│   ├── PageLoader/
│   └── ContentLoader/
├── feedback/                            # User feedback
│   ├── Toast/
│   ├── Alert/
│   ├── ConfirmDialog/
│   └── EmptyState/
├── data-display/                        # Data presentation
│   ├── DataTable/
│   ├── StatCard/
│   ├── Progress/
│   ├── Tag/
│   └── Badge/
└── layout/                              # Layout utilities
    ├── Container/
    ├── Grid/
    ├── Flex/
    ├── Stack/
    └── Spacer/
```

---

## Feature-Specific Component Hierarchies

### Listing Components

```
src/components/listings/
├── ListingCard/
│   ├── ListingImage/
│   ├── ListingInfo/
│   ├── ListingPrice/
│   ├── ListingLocation/
│   ├── ListingActions/
│   └── ListingBadges/
├── ListingGrid/
├── ListingList/
├── ListingWizard/
│   ├── WizardStep1/
│   ├── WizardStep2/
│   ├── WizardStep3/
│   └── WizardReview/
├── ListingFilters/
│   ├── CategoryFilter/
│   ├── PriceFilter/
│   ├── LocationFilter/
│   └── ConditionFilter/
└── ListingSort/
    ├── SortDropdown/
    └── SortButton/
```

### Messaging Components

```
src/components/messaging/
├── MessageList/
│   ├── MessageItem/
│   ├── MessagePreview/
│   └── MessageTimestamp/
├── MessageThread/
│   ├── MessageBubble/
│   ├── MessageInput/
│   ├── MessageActions/
│   └── MessageAttachments/
├── MessageCompose/
│   ├── RecipientSelect/
│   ├── SubjectInput/
│   ├── MessageBody/
│   └── AttachmentUpload/
└── MessageNotifications/
    ├── UnreadBadge/
    └── NotificationToast/
```

### Wallet Components

```
src/components/wallet/
├── WalletBalance/
│   ├── BalanceDisplay/
│   ├── BalanceChange/
│   └── BalanceChart/
├── WalletActions/
│   ├── AddFundsButton/
│   ├── WithdrawButton/
│   └── TransferButton/
├── TransactionList/
│   ├── TransactionItem/
│   ├── TransactionDetails/
│   └── TransactionFilters/
└── PaymentMethods/
    ├── CardPayment/
    ├── BankTransfer/
    └── USSDPayment/
```

### Store Components

```
src/components/store/
├── StoreCard/
│   ├── StoreLogo/
│   ├── StoreName/
│   ├── StoreRating/
│   ├── StoreLocation/
│   └── StoreFollowButton/
├── StoreDashboard/
│   ├── StoreOverview/
│   ├── StoreAnalytics/
│   ├── StoreListings/
│   └── StoreReviews/
├── StoreWizard/
│   ├── WizardStep1/
│   ├── WizardStep2/
│   └── WizardStep3/
└── StoreFollowers/
    ├── FollowerList/
    └── FollowingList/
```

---

## Component Naming Conventions

### File Naming
- **PascalCase** for component files: `UserDashboard.tsx`
- **kebab-case** for utility files: `user-utils.ts`
- **camelCase** for hooks: `useUserAuth.ts`

### Component Naming
- **PascalCase** for components: `UserSidebar`
- **Prefix** with dashboard name: `User*`, `Mod*`, `Admin*`
- **Descriptive** names: `PendingListingsCard` (not `Card1`)

### Props Naming
- **camelCase** for props: `userName`, `isActive`
- **Boolean** props prefix with `is/has`: `isLoading`, `hasError`
- **Function** props prefix with `on`: `onClick`, `onSubmit`

---

## Component Composition Patterns

### Compound Components

```typescript
// Example: UserStatsCards
<UserStatsCards>
  <WalletCard balance={500000} />
  <EscrowCard balance={125000} />
  <OrdersCard pending={12} />
  <ListingsCard count={45} />
</UserStatsCards>
```

### Render Props

```typescript
// Example: ListingCard
<ListingCard
  listing={listing}
  renderActions={(listing) => (
    <ListingActions listing={listing} />
  )}
/>
```

### Higher-Order Components

```typescript
// Example: withPermission
export const withPermission = (permission: string) => {
  return (Component: React.ComponentType) => {
    return (props: any) => {
      const hasPermission = usePermission(permission);
      if (!hasPermission) return null;
      return <Component {...props} />;
    };
  };
};
```

### Custom Hooks

```typescript
// Example: useUserDashboard
export function useUserDashboard() {
  const { session } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserStats(session.userId).then(data => {
      setStats(data);
      setLoading(false);
    });
  }, [session.userId]);

  return { stats, loading };
}
```

---

## Component State Management

### Local State
- Component-specific UI state
- Form inputs
- Modal open/close
- Loading states

### Global State (Zustand)
- User authentication
- Shopping cart
- Notifications
- Theme preferences

### Server State (TanStack Query)
- API data fetching
- Caching
- Background refetching
- Optimistic updates

---

## Component Performance Optimization

### Code Splitting
```typescript
// Lazy load heavy components
const UserActivityChart = lazy(() => import('./UserActivityChart'));
const AdminRevenueChart = lazy(() => import('./AdminRevenueChart'));
```

### Memoization
```typescript
// Memoize expensive computations
const UserStatsCards = memo(({ stats }) => {
  const calculatedStats = useMemo(() => {
    return calculateStats(stats);
  }, [stats]);

  return <div>{/* ... */}</div>;
});
```

### Virtual Scrolling
```typescript
// For long lists
const VirtualizedList = lazy(() => import('./VirtualizedList'));
```

---

## Component Testing Strategy

### Unit Tests
- Individual component logic
- Props validation
- State changes
- Event handlers

### Integration Tests
- Component interactions
- Data flow
- Navigation

### E2E Tests
- User flows
- Cross-dashboard navigation
- Permission checks

---

## Component Documentation

### JSDoc Comments
```typescript
/**
 * UserDashboard - Main user dashboard component
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components
 * @param {string} props.userId - User ID
 * @returns {JSX.Element} Rendered dashboard
 */
export function UserDashboard({ children, userId }: UserDashboardProps) {
  // ...
}
```

### Storybook Stories
```typescript
// UserDashboard.stories.tsx
export default {
  title: 'Dashboard/User/UserDashboard',
  component: UserDashboard,
} as ComponentMeta<typeof UserDashboard>;

export const Default: ComponentStoryObj<typeof UserDashboard> = {
  args: {
    userId: 'test-user-id',
  },
};
```

---

## Component Migration Path

### Phase 1: Create New Components
- Create User Dashboard components
- Create Moderator Dashboard components
- Create Super Admin Dashboard components

### Phase 2: Update Routes
- Update route structure
- Update layouts
- Update navigation

### Phase 3: Delete Old Components
- Delete shared layouts
- Delete generic components
- Clean up unused imports

### Phase 4: Testing
- Test new components
- Test navigation
- Test permissions
- Test responsive layouts
