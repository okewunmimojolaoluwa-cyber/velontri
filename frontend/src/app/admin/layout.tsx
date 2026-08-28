'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES } from '@/config/routes';

const AdminShell = dynamic(
 () => import('@/components/layout/admin-shell').then(m => ({ default: m.AdminShell })),
 {
 ssr: false,
 loading: () => (
 <div className="flex min-h-screen items-center justify-center bg-slate-50">
 <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
 </div>
 ),
 }
);

const Spinner = () => (
 <div className="flex min-h-screen items-center justify-center bg-slate-50">
 <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
 </div>
);

export default function AdminLayout({ children }: { children: ReactNode }) {
 const { session, isLoading } = useAuth();
 const router = useRouter();

 useEffect(() => {
 if (isLoading) return;
 if (!session.isAuthenticated) {
 router.replace(`${ROUTES.login}?redirect=/admin`);
 return;
 }
    // Only super_admin can access admin panel
    // moderator → mod portal, user → dashboard
 if (session.role === 'moderator') {
 router.replace(ROUTES.mod.overview);
 return;
 }
 if (session.role !== 'super_admin') {
 router.replace(ROUTES.dashboard);
 }
 }, [session, isLoading, router]);

 if (isLoading) return <Spinner />;

  // Block render until confirmed super_admin
 if (!session.isAuthenticated || session.role !== 'super_admin') {
 return <Spinner />;
 }

 return <AdminShell>{children}</AdminShell>;
}
