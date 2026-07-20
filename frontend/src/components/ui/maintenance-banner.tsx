'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePathname } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

interface MaintenanceData {
  enabled: boolean;
  message: string;
}

export function MaintenanceBanner() {
  const pathname = usePathname();
  const [data, setData] = useState<MaintenanceData | null>(null);

  // Don't show on admin routes — admins need access during maintenance
  const isAdmin = pathname?.startsWith('/admin');

  useEffect(() => {
    if (isAdmin) return;
    fetch(`${API_BASE}/platform/maintenance`)
      .then(r => r.json())
      .then(body => {
        if (body?.data) setData(body.data);
      })
      .catch(() => {});
  }, [isAdmin]);

  if (!data?.enabled || isAdmin) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 mx-auto mb-5">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-[22px] font-black text-slate-900 mb-3">
          🔧 Under Maintenance
        </h1>
        <p className="text-[15px] text-slate-600 leading-relaxed mb-6">
          {data.message || 'We are currently performing scheduled maintenance. We\'ll be back shortly.'}
        </p>
        <div className="flex items-center justify-center gap-2 text-[13px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          We'll be back soon
        </div>
      </div>
    </div>
  );
}
