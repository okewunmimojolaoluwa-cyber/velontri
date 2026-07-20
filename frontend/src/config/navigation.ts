import type { VelontriRole } from '@/types/auth';
import { ROUTES } from '@/config/routes';

export interface NavItem {
  label: string;
  href: string;
  roles?: VelontriRole[];
}

export const publicNav: NavItem[] = [
  { label: 'Browse', href: ROUTES.listings },
  { label: 'Search', href: ROUTES.search },
  { label: 'Stores', href: ROUTES.stores },
  { label: 'Pricing', href: '/subscriptions/tiers' },
];

export const userNav: NavItem[] = [
  { label: 'Dashboard',  href: ROUTES.user.overview },
  { label: 'Listings',   href: ROUTES.user.listings },
  { label: 'Orders',     href: ROUTES.user.orders },
  { label: 'Wallet',     href: ROUTES.user.wallet },
  { label: 'Messages',   href: ROUTES.user.messages },
  { label: 'Profile',    href: ROUTES.user.profile },
];

export const modNav: NavItem[] = [
  { label: 'Overview',   href: ROUTES.mod.overview },
  { label: 'Listings',   href: ROUTES.mod.pendingListings },
  { label: 'KYC',        href: ROUTES.mod.kyc },
  { label: 'Disputes',   href: ROUTES.mod.disputes },
];

export const adminNav: NavItem[] = [
  { label: 'Dashboard',  href: ROUTES.admin.overview },
  { label: 'Users',      href: ROUTES.admin.users },
  { label: 'Analytics',  href: ROUTES.admin.analytics },
];
