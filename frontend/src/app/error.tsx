'use client';

import { useEffect } from 'react';
import { VelontriLogo } from '@/components/ui/velontri-logo';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] px-5 text-center">
      {/* Velontri logo */}
      <a href="/" className="mb-12 flex items-center gap-2.5 no-underline">
        <VelontriLogo size={36} showWordmark wordmarkSize="md"
          wordmarkClassName="text-slate-900" />
      </a>

      {/* Error icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 border border-red-100">
        <svg className="h-9 w-9 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h1 className="font-black text-slate-900"
        style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.025em' }}>
        Something went wrong
      </h1>

      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>

      {error.digest && (
        <p className="mt-2 text-[11px] font-mono text-slate-400">
          ID: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-6 text-[14px]
            font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          Try again
        </button>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-6 text-[14px]
            font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
