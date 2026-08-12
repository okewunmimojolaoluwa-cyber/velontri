'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, CheckCircle, RefreshCw, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/api/endpoints';
import { ROUTES } from '@/config/routes';

const RESEND_COUNTDOWN = 60;

type Step = 'email' | 'otp' | 'password' | 'done';

function OtpBox({
  value, index, total, onChange, onKeyDown, inputRef,
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
      className="h-14 w-12 rounded-xl border-2 bg-slate-900 text-center text-[22px] font-black
        text-white transition-all outline-none border-slate-700
        focus:border-violet-500 focus:bg-slate-800 focus:ring-4 focus:ring-violet-500/20"
      aria-label={`Digit ${index + 1} of ${total}`}
    />
  );
}

function ForgotPasswordInner() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Focus first OTP box when step changes to otp
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // Countdown timer
  useEffect(() => {
    if (step !== 'otp') return;
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown, step]);

  const otp = digits.join('');

  // ── Step 1: Email ─────────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authApi.passwordResetRequest(email);
    } catch {
      // Always continue — backend returns success even for unknown emails
    } finally {
      setIsLoading(false);
    }
    setStep('otp');
    setCountdown(RESEND_COUNTDOWN);
    setCanResend(false);
  }

  // ── Step 2: OTP ───────────────────────────────────────────────────────
  function handleOtpChange(index: number, val: string) {
    if (!val) {
      const next = [...digits]; next[index] = ''; setDigits(next); return;
    }
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, '').slice(0, 6);
      const next = Array(6).fill('');
      for (let i = 0; i < pasted.length && i + index < 6; i++) next[i + index] = pasted[i];
      setDigits(next);
      const nextFocus = Math.min(index + pasted.length, 5);
      setTimeout(() => inputRefs.current[nextFocus]?.focus(), 10);
      return;
    }
    const next = [...digits]; next[index] = val; setDigits(next);
    if (val && index < 5) setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (digits[index]) { const n = [...digits]; n[index] = ''; setDigits(n); }
      else if (index > 0) inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpContinue() {
    if (otp.length !== 6) { setError('Please enter all 6 digits.'); return; }
    setError('');
    setStep('password');
  }

  async function handleResend() {
    setCanResend(false);
    setCountdown(RESEND_COUNTDOWN);
    setError('');
    setDigits(Array(6).fill(''));
    try { await authApi.passwordResetRequest(email); } catch { /* silent */ }
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  }

  // ── Step 3: New Password ──────────────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.passwordResetOtp(email, otp, newPassword);
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[#111827] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          {/* Header strip */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-7">
            <div className="flex items-center gap-3">
              {step !== 'email' && step !== 'done' && (
                <button
                  onClick={() => { setStep(step === 'otp' ? 'email' : 'otp'); setError(''); }}
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-black text-white">
                  {step === 'email' && 'Reset Password'}
                  {step === 'otp' && 'Check your email'}
                  {step === 'password' && 'New Password'}
                  {step === 'done' && 'Password Reset!'}
                </h1>
                <p className="text-white/60 text-xs mt-0.5">
                  {step === 'email' && 'We'll send a 6-digit code to your email'}
                  {step === 'otp' && `Code sent to ${email}`}
                  {step === 'password' && 'Choose a strong new password'}
                  {step === 'done' && 'You can now log in with your new password'}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {/* Progress */}
            {step !== 'done' && (
              <div className="flex gap-2 mb-8">
                {(['email', 'otp', 'password'] as Step[]).map((s, i) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      ['email', 'otp', 'password'].indexOf(step) >= i
                        ? 'bg-violet-500'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-[13px] font-medium text-red-400">{error}</p>
              </div>
            )}

            {/* ── Step 1: Email ── */}
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div>
                  <label htmlFor="fp-email" className="block text-sm font-semibold text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      id="fp-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={isLoading}
                      className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl
                        text-white placeholder-slate-500 text-sm outline-none
                        focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                    text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed
                    hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-[0.98]"
                >
                  {isLoading ? 'Sending…' : 'Send Verification Code'}
                </button>
                <p className="text-center text-sm text-slate-500">
                  <Link href={ROUTES.login} className="text-violet-400 hover:text-violet-300 font-medium no-underline">
                    ← Back to login
                  </Link>
                </p>
              </form>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <div className="space-y-6">
                <p className="text-[13px] text-slate-400 text-center leading-relaxed">
                  If an account exists for <span className="font-semibold text-slate-200">{email}</span>,
                  you'll receive a 6-digit code within a few seconds.
                </p>

                <div className="flex items-center justify-center gap-2.5">
                  {digits.map((d, i) => (
                    <OtpBox
                      key={i} value={d} index={i} total={6}
                      onChange={handleOtpChange}
                      onKeyDown={handleOtpKeyDown}
                      inputRef={el => { inputRefs.current[i] = el; }}
                    />
                  ))}
                </div>

                <button
                  onClick={handleOtpContinue}
                  disabled={otp.length !== 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                    text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed
                    hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-[0.98]"
                >
                  Continue
                </button>

                <div className="text-center space-y-1">
                  <p className="text-[12px] text-slate-500">Didn't receive the code?</p>
                  {canResend ? (
                    <button
                      onClick={handleResend}
                      className="flex items-center justify-center gap-1.5 mx-auto text-[13px]
                        font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Resend code
                    </button>
                  ) : (
                    <p className="text-[12px] text-slate-500">
                      Resend in <span className="font-semibold text-slate-300">{countdown}s</span>
                    </p>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 text-center">
                  Check your spam folder if you don't see it.
                </p>
              </div>
            )}

            {/* ── Step 3: New Password ── */}
            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div>
                  <label htmlFor="fp-newpw" className="block text-sm font-semibold text-slate-300 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      id="fp-newpw"
                      type={showPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      disabled={isLoading}
                      className="w-full pl-10 pr-11 py-3 bg-slate-900 border border-slate-700 rounded-xl
                        text-white placeholder-slate-500 text-sm outline-none
                        focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="fp-confirmpw" className="block text-sm font-semibold text-slate-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      id="fp-confirmpw"
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      required
                      disabled={isLoading}
                      className="w-full pl-10 pr-11 py-3 bg-slate-900 border border-slate-700 rounded-xl
                        text-white placeholder-slate-500 text-sm outline-none
                        focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password strength hint */}
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Use at least 8 characters including uppercase, lowercase, a number and a special character.
                </p>

                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                    text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed
                    hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-[0.98]"
                >
                  {isLoading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            )}

            {/* ── Step 4: Done ── */}
            {step === 'done' && (
              <div className="text-center space-y-6 py-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 mx-auto">
                  <CheckCircle className="h-10 w-10 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-black text-white">Password reset!</p>
                  <p className="text-sm text-slate-400 mt-1">Your password has been updated. All other sessions have been signed out.</p>
                </div>
                <button
                  onClick={() => router.push(ROUTES.login)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                    text-white font-semibold text-sm hover:from-violet-500 hover:to-indigo-500 transition-all"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-violet-500" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
            strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
        </svg>
      </div>
    }>
      <ForgotPasswordInner />
    </Suspense>
  );
}
