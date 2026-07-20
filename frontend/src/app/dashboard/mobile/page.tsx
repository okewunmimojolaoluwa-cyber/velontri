'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { walletApi } from '@/lib/api/endpoints/wallet';
import { sellerApi } from '@/lib/api/endpoints/seller';
import { MobileHeader } from '@/components/dashboard/mobile-header';
import { WelcomeSection } from '@/components/dashboard/welcome-section';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { MyListingsCarousel } from '@/components/dashboard/my-listings-carousel';
import { PurchasesCarousel } from '@/components/dashboard/purchases-carousel';
import { RecommendedSection } from '@/components/dashboard/recommended-section';
import { StoreAnalytics } from '@/components/dashboard/store-analytics';
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav';
import { MobileMenu } from '@/components/dashboard/mobile-menu';

/* ── Helpers ─────────────────────────────────────────────── */
function fmt(n: number, cur = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);
  } catch {
    return `₦${n.toLocaleString()}`;
  }
}

/* ── Mobile Dashboard Page ─ */
export default function MobileDashboardPage() {
  const { session } = useAuth();
  const uid = session.userId;
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: walletData } = useQuery({
    queryKey: [uid, 'wallet', 'balance'],
    queryFn: () => walletApi.getBalance(),
    enabled: session.isAuthenticated,
  });

  const { data: listingsData } = useQuery({
    queryKey: [uid, 'seller', 'listings', { page: 1, page_size: 1 }],
    queryFn: () => sellerApi.getMyListings({ page: 1, page_size: 1 }),
    enabled: session.isAuthenticated,
  });

  const wallet = walletData?.data;
  const totalListings = listingsData?.meta?.total ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Mobile Header */}
      <MobileHeader onMenuOpen={() => setMenuOpen(true)} />

      {/* Mobile Menu */}
      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}

      {/* Welcome Section */}
      <WelcomeSection totalListings={totalListings} />

      {/* KPI Cards */}
      <KPICards
        walletBalance={wallet ? fmt(wallet.available_balance, wallet.currency) : '₦0'}
        escrowBalance={wallet ? fmt(wallet.escrow_balance, wallet.currency) : '₦0'}
        totalListings={totalListings}
        orders={5}
        messages={3}
        wishlist={18}
        followers={245}
        reviews="4.9★"
      />

      {/* Quick Actions */}
      <QuickActions />

      {/* Recent Activity */}
      <RecentActivity />

      {/* My Listings Carousel */}
      <MyListingsCarousel />

      {/* Purchases Carousel */}
      <PurchasesCarousel />

      {/* Recommended Section */}
      <RecommendedSection />

      {/* Store Analytics */}
      <StoreAnalytics hasStore={totalListings > 0} />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
