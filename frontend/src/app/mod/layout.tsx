'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES } from '@/config/routes';

const ModShell = dynamic(
  () => import('@/components/layout/mod-shell').then(m => ({ default: m.ModShell })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    ),
  }
);

export default function ModLayout({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session.isAuthenticated) router.replace(ROUTES.login);
    else if (session.role !== 'moderator') router.replace(ROUTES.dashboard);
  }, [session, router]);

  if (!session.isAuthenticated || session.role !== 'moderator') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return <ModShell>{children}</ModShell>;
}
