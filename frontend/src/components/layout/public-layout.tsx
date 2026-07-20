'use client';

import type { ReactNode } from 'react';
import { Navbar } from './navbar';

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {children}
    </div>
  );
}
