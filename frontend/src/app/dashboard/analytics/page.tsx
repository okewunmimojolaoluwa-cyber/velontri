'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Analytics redirects to store analytics
export default function AnalyticsRedirect() {
 const router = useRouter();
 useEffect(() => { router.replace('/dashboard/store/analytics'); }, [router]);
 return null;
}
