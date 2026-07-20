'use client';

import { Suspense } from 'react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Mail, RefreshCw } from 'lucide-react';
import { useVerifyPhone, useResendOtp } from '@/features/auth/hooks';
import { ROUTES } from '@/config/routes';
import { VelontriLogo } from '@/components/ui/velontri-logo';

const RESEND_COUNTDOWN = 60;

/* ── Individual OTP digit input ──────────────────────────────── */
function OtpInput({
  value, index, total, onChange, onKeyDown,
  inputRef,
}: {
  value: string; index: number; total: number;
  onChange: (index: number, val: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={1}
      value={value}
      onChange={e => {
        const v = e.target.value.replace(/\D/g, '');
        onChange(index, v);
      }}
      onKeyDown={e => onKeyDown(index, e)}
      onFocus={e => e.target.select()}
      className="h-14 w-12 rounded-xl border-2 bg-slate-50 text-center text-[22px] font-black
        text-slate-900 transition-all outline-none
        focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15
        border-slate-200"
      aria-label={`Digit ${index + 1} of ${total}`}
    />
  );
}

/* ── Main page ───────────────────────────────────────────────── */
function VerifyEmailInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('user_id') ?? '';
  const email  = searchParams.get('email') ? decodeURIComponent(searchParams.get('email')!) : '';

  const [digits,    setDigits]    = useState<string[]>(Array(6).fill(''));
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const verifyPhone = useVerifyPhone();
  const resendOtp   = useResendOtp();

  // Focus first input on mount
  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  // Resend countdown
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // Auto-submit when all 6 digits are filled
  const otp = digits.join('');
  useEffect(() => {
    if (otp.length === 6 && !verifyPhone.isPending && !success) {
      handleVerify(otp);
    }
  }, [otp]);

  function handleVerify(code: string) {
    if (!userId) return;
    setError('');
    verifyPhone.mutate({ userId, otp: code }, {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => router.push(`${ROUTES.login}?verified=1`), 1800);
      },
      onError: (err: any) => {
        setError(err.message || 'Incorrect code. Please try again.');
        setDigits(Array(6).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      },
    });
  }

  function handleChange(index: number, val: string) {
    if (!val) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    // Handle paste of multiple digits
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, '').slice(0, 6);
      const next = Array(6).fill('');
      for (let i = 0; i < pasted.length && i + index < 6; i++) {
        next[i + index] = pasted[i];
      }
      setDigits(next);
      const nextFocus = Math.min(index + pasted.length, 5);
      setTimeout(() => inputRefs.current[nextFocus]?.focus(), 10);
      return;
    }
    const next = [...digits];
    next[index] = val;
    setDigits(next);
    if (val && index < 5) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleResend() {
    setCanResend(false);
    setCountdown(RESEND_COUNTDOWN);
    setError('');
    setDigits(Array(6).fill(''));
    resendOtp.mutate(userId, {
      onError: (err: any) => setError(err.message || 'Failed to resend. Please try again.'),
    });
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
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
          <p className="text-[14px] text-slate-500">Signing you in…</p>
        </div>
      ) : (
        <>
          {/* OTP input boxes */}
          <div className="flex items-center justify-center gap-2.5">
            {digits.map((d, i) => (
              <OtpInput
                key={i}
                value={d}
                index={i}
                total={6}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                inputRef={el => { inputRefs.current[i] = el; }}
              />
            ))}
          </div>

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
