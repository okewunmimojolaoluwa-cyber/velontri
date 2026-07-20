'use client';
// Redirect legacy callback URL to new public callback page
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LegacyCallbackRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Forward all params to the new public callback page
    const params = searchParams.toString();
    router.replace(`/payment/callback${params ? '?' + params : ''}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
    </div>
  );
}
