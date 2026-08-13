/**
 * BackendWakeup — silently pings the backend /health endpoint as soon
 * as the auth page loads, so Render's free-tier service warms up before
 * the user submits the form.
 *
 * Shows a subtle banner while the server is starting up.
 */
'use client';

import { useEffect, useState } from 'react';
import { siteConfig } from '@/config/site';

type Status = 'checking' | 'ready' | 'slow';

export function BackendWakeup() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const healthUrl = siteConfig.apiUrl.replace('/api/v1', '') + '/health';
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    fetch(healthUrl, { signal: controller.signal, cache: 'no-store' })
      .then((r) => {
        clearTimeout(timeout);
        if (r.ok) {
          setStatus('ready');
        } else {
          setStatus('slow');
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        // If it failed, mark as slow — server may still be waking up
        if (Date.now() - start > 5000) {
          setStatus('slow');
        } else {
          setStatus('ready');
        }
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (status === 'ready') return null;

  return (
    <div
      className={`
        flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px]
        ${status === 'checking'
          ? 'border-blue-100 bg-blue-50 text-blue-700'
          : 'border-amber-100 bg-amber-50 text-amber-700'}
      `}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75
            ${status === 'checking' ? 'bg-blue-400' : 'bg-amber-400'}`}
        />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full
            ${status === 'checking' ? 'bg-blue-500' : 'bg-amber-500'}`}
        />
      </span>
      {status === 'checking'
        ? 'Connecting to server\u2026'
        : 'Server is starting up \u2014 this may take 30\u201360 seconds on first load.'}
    </div>
  );
}
