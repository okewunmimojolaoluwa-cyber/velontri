'use client';

import dynamic from 'next/dynamic';

export const BottomNavWrapper = dynamic(
  () => import('@/components/layout/bottom-nav').then(m => ({ default: m.BottomNav })),
  { ssr: false }
);
