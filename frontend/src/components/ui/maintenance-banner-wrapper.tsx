'use client';

import dynamic from 'next/dynamic';

export const MaintenanceBannerWrapper = dynamic(
  () => import('@/components/ui/maintenance-banner').then(m => ({ default: m.MaintenanceBanner })),
  { ssr: false }
);
