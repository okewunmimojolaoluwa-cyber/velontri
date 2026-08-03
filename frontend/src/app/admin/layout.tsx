'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES } from '@/config/routes';

// Load AdminShell client-only to prevent hydration mismatch
// (aside element differs between SSR and client due to session state)
const AdminShell = dynamic(
  () => import('@/components/layout/admin-shell').then(m => ({ default: m.AdminShell })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    ),
  }
);

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
  </div>
);

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!session.isAuthenticated) router.replace(ROUTES.login);
    else if (session.role !== 'super_admin') router.replace(ROUTES.dashboard);
  }, [session, isLoading, router]);

  if (isLoading) return <Spinner />;

  if (!session.isAuthenticated || session.role !== 'super_admin') {
    return <Spinner />;
  }

  return <AdminShell>{children}</AdminShell>;
}
