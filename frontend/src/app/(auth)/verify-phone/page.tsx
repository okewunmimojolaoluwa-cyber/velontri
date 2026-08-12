'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Mail, RefreshCw } from 'lucide-react';
import { useVerifyPhone, useResendOtp } from '@/features/auth/hooks';
import { OTPInput } from '@/components/auth/otp-input';
import { ROUTES } from '@/config/routes';

const RESEND_COUNTDOWN = 60;

function VerifyEmailInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('user_id') ?? '';
  const email  = searchParams.get('email') ? decodeURIComponent(searchParams.get('email')!) : '';

  const [otpValue,  setOtpValue]  = useState('');
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);

  const verifyPhone = useVerifyPhone();
  const resendOtp   = useResendOtp();

  // Countdown
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  function handleVerify(code: string) {
    if (!userId || verifyPhone.isPending || success) return;
    setError('');
    verifyPhone.mutate({ userId, otp: code }, {
      onSuccess: () => {
        setSuccess(true);
        // Auto-logged in — go directly to dashboard
        setTimeout(() => router.push('/dashboard'), 1600);
      },
      onError: (err: any) => {
        setError(err?.response?.data?.error?.message || err?.message || 'Incorrect code. Please try again.');
        setOtpValue('');
      },
    });
  }

  function handleResend() {
    setCanResend(false);
    setCountdown(RESEND_COUNTDOWN);
    setError('');
    setOtpValue('');
    resendOtp.mutate(userId, {
      onError: (err: any) => setError(err?.response?.data?.error?.message || err?.message || 'Failed to resend. Please try again.'),
    });
  }

  if (!userId) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[15px] text-slate-500">No user ID found.</p>
        <Link href={ROUTES.register} className="text-[14px] font-semibold text-indigo-600 hover:underline no-underline">
          Back to register
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 mx-auto">
          <Mail className="h-7 w-7 text-indigo-600" />
        </div>
        <h1 className="text-[1.75rem] font-black tracking-tight text-slate-900">
          Check your email
        </h1>
        <p className="text-[14px] text-slate-500 leading-relaxed">
          We sent a 6-digit code to
          {email ? (
            <> <span className="font-semibold text-slate-700">{email}</span></>
          ) : ' your email address'}
        </p>
      </div>

      {/* Success state */}
      {success ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="text-[17px] font-black text-slate-900">Email verified!</p>
          <p className="text-[14px] text-slate-500">Taking you to your dashboard…</p>
        </div>
      ) : (
        <>
          {/* OTP Input — uses shared component */}
          <OTPInput
            value={otpValue}
            onChange={setOtpValue}
            onComplete={handleVerify}
            disabled={verifyPhone.isPending}
            theme="light"
          />

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center">
              <p className="text-[13px] font-medium text-red-600">{error}</p>
            </div>
          )}

          {/* Loading */}
          {verifyPhone.isPending && (
            <div className="flex items-center justify-center gap-2 text-[13px] text-slate-500">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
              </svg>
              Verifying…
            </div>
          )}

          {/* Resend */}
          <div className="text-center space-y-1">
            <p className="text-[13px] text-slate-400">Didn't receive the email?</p>
            {canResend ? (
              <button
                onClick={handleResend}
                disabled={resendOtp.isPending}
                className="flex items-center justify-center gap-1.5 mx-auto text-[13px]
                  font-semibold text-indigo-600 hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resendOtp.isPending ? 'animate-spin' : ''}`} />
                {resendOtp.isPending ? 'Sending…' : 'Resend code'}
              </button>
            ) : (
              <p className="text-[13px] text-slate-400">
                Resend in <span className="font-semibold text-slate-600">{countdown}s</span>
              </p>
            )}
          </div>

          <p className="text-[12px] text-slate-400 text-center">
            Check your spam folder if you don't see it in your inbox.
          </p>
        </>
      )}

      <p className="text-center text-[13px] text-slate-400">
        <Link href={ROUTES.register} className="hover:underline no-underline text-slate-500">
          ← Back to register
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <svg className="h-6 w-6 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
            strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
        </svg>
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  );
}
