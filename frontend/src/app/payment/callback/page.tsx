'use client';

/**
 * PUBLIC payment callback page — NOT inside the dashboard layout.
 * Paystack redirects here after payment. This page handles the verification
 * even if the user's session has expired, then redirects appropriately.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { ROUTES } from '@/config/routes';

type Status = 'verifying' | 'success' | 'failed';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

async function verifyPayment(reference: string, plan: string, token: string) {
  const res = await fetch(`${API_BASE}/subscriptions/paystack/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reference, plan }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function getToken(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(`(?:^|;)\\s*velontri_access=([^;]*)`);
  return m ? decodeURIComponent(m[1]) : '';
}

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus]   = useState<Status>('verifying');
  const [planName, setPlanName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const reference   = searchParams.get('reference') || searchParams.get('trxref') || '';
    const plan        = searchParams.get('plan') || '';
    const fromCreate  = searchParams.get('from') === 'create';

    // Recover from localStorage if URL params are missing
    let ref  = reference;
    let pid  = plan;
    let from = fromCreate;

    if (!ref || !pid) {
      try {
        const stored = localStorage.getItem('velontri_pending_payment');
        if (stored) {
          const p = JSON.parse(stored);
          if (Date.now() - p.savedAt < 3_600_000) {
            ref  = ref  || p.reference || '';
            pid  = pid  || p.plan      || '';
            from = from || p.fromCreate || false;
          }
        }
      } catch {}
    }

    if (!ref || !pid) {
      setStatus('failed');
      setErrorMsg('Missing payment reference. If you were charged, please contact support.');
      return;
    }

    setPlanName(pid.charAt(0).toUpperCase() + pid.slice(1));

    const token = getToken();

    if (!token) {
      // No token — save pending and redirect to login, then come back here
      try {
        localStorage.setItem('velontri_pending_payment', JSON.stringify({
          reference: ref, plan: pid, fromCreate: from, savedAt: Date.now(),
        }));
      } catch {}
      const returnUrl = `/payment/callback?reference=${ref}&plan=${pid}${from ? '&from=create' : ''}`;
      router.replace(`${ROUTES.login}?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    verifyPayment(ref, pid, token)
      .then(() => {
        // Activate plan locally
        try { localStorage.removeItem('velontri_pending_payment'); } catch {}
        try { localStorage.setItem('velontri_plan', pid); } catch {}
        setStatus('success');

        setTimeout(() => {
          const nextParam = from ? '&next=create' : '';
          router.replace(`${ROUTES.user.subscription}?success=true&plan=${pid}${nextParam}`);
        }, 2500);
      })
      .catch((err: Error) => {
        const msg = err.message || '';

        if (msg.includes('Authentication') || msg.includes('401') || msg.includes('token')) {
          // Token expired — save and go to login
          try {
            localStorage.setItem('velontri_pending_payment', JSON.stringify({
              reference: ref, plan: pid, fromCreate: from, savedAt: Date.now(),
            }));
          } catch {}
          const returnUrl = `/payment/callback?reference=${ref}&plan=${pid}${from ? '&from=create' : ''}`;
          router.replace(`${ROUTES.login}?redirect=${encodeURIComponent(returnUrl)}`);
          return;
        }

        setErrorMsg(msg || `Verification failed. Your money is safe — reference: ${ref}`);
        setStatus('failed');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">

        {status === 'verifying' && (
          <>
            <Loader2 className="h-14 w-14 animate-spin text-indigo-600 mx-auto mb-5" />
            <h2 className="text-[18px] font-black text-slate-900 mb-2">Verifying payment…</h2>
            <p className="text-[14px] text-slate-500">
              Please wait while we confirm your payment with Paystack.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-5">
              <CheckCircle className="h-9 w-9 text-emerald-600" />
            </div>
            <h2 className="text-[20px] font-black text-slate-900 mb-2">
              {planName} Plan Activated!
            </h2>
            <p className="text-[14px] text-slate-500 mb-1">Payment confirmed. Your plan is now active.</p>
            <p className="text-[13px] text-slate-400">Taking you to your dashboard…</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mx-auto mb-5">
              <XCircle className="h-9 w-9 text-red-500" />
            </div>
            <h2 className="text-[20px] font-black text-slate-900 mb-2">Verification Failed</h2>
            <p className="text-[14px] text-slate-500 mb-5 leading-relaxed">{errorMsg}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => window.location.reload()}
                className="h-11 rounded-xl bg-indigo-600 px-6 text-[14px] font-bold text-white
                  hover:bg-indigo-700 transition-colors">
                Retry
              </button>
              <button onClick={() => router.replace(ROUTES.user.subscription)}
                className="h-11 rounded-xl border border-slate-200 px-6 text-[14px] font-semibold
                  text-slate-600 hover:bg-slate-50 transition-colors">
                Back to Plans
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
