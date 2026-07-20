'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES } from '@/config/routes';

const UserShell = dynamic(
  () => import('@/components/layout/user-shell').then(m => ({ default: m.UserShell })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    ),
  }
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace(ROUTES.login);
    }
    // Redirect moderators/admins to their correct portal
    if (session.role === 'super_admin') router.replace(ROUTES.admin.overview);
    if (session.role === 'moderator') router.replace(ROUTES.mod.overview);
  }, [session, router]);

  if (!session.isAuthenticated || session.role === 'super_admin' || session.role === 'moderator') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
    </div>;
  }

  return <UserShell>{children}</UserShell>;
}
