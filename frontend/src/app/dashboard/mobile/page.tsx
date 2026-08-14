'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Mobile dashboard redirect — full mobile view not yet implemented
export default function MobileDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, [router]);
  return null;
}
