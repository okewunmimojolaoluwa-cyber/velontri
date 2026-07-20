'use client';

/**
 * DashboardShell — compatibility barrel.
 *
 * All /dashboard/* pages use UserShell.
 * All /mod/* pages use ModShell.
 * All /admin/* pages use AdminShell.
 *
 * This file provides a single `DashboardShell` export so pages generated
 * before the architecture split continue to compile without modification.
 *
 * Each portal's layout.tsx already wraps children in the correct shell,
 * so this wrapper is effectively a pass-through for pages inside a portal.
 */

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { UserShell } from './user-shell';
import { ModShell } from './mod-shell';
import { AdminShell } from './admin-shell';

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() as string;

  // Each portal layout already provides the shell wrapper, so pages that
  // render DashboardShell inside a portal will get a no-op pass-through.
  // For any edge-case standalone use, route to the correct shell.
  if (pathname.startsWith('/admin')) return <AdminShell>{children}</AdminShell>;
  if (pathname.startsWith('/mod'))   return <ModShell>{children}</ModShell>;
  return <UserShell>{children}</UserShell>;
}
