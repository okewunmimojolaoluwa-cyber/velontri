'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, CheckCircle, RefreshCw, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/api/endpoints';
import { OTPInput } from '@/components/auth/otp-input';
import { ROUTES } from '@/config/routes';

const RESEND_COUNTDOWN = 60;
type Step = 'email' | 'otp' | 'done';

function ForgotPasswordInner() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (step !== 'otp') return;
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown, step]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authApi.passwordResetRequest(email);
    } catch {
      // Always continue — prevents email enumeration
    } finally {
      setIsLoading(false);
    }
    setStep('otp');
    setCountdown(RESEND_COUNTDOWN);
    setCanResend(false);
  }

  async function handleResend() {
    setCanResend(false);
    setCountdown(RESEND_COUNTDOWN);
    setError('');
    setOtpValue('');
    try { await authApi.passwordResetRequest(email); } catch { /* silent */ }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (otpValue.length !== 6) { setError('Please enter all 6 digits of your code.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setIsLoading(true);
    try {
      await authApi.passwordResetOtp(email, otpValue, newPassword);
      setStep('done');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to reset password.';
      setError(msg);
      if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('code') || msg.toLowerCase().includes('incorrect')) {
        setOtpValue('');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[#111827] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-7">
            <div className="flex items-center gap-3">
              {step === 'otp' && (
                <button
                  onClick={() => { setStep('email'); setError(''); setOtpValue(''); }}
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-black text-white">
                  {step === 'email' && 'Reset Password'}
                  {step === 'otp' && 'Enter Code & New Password'}
                  {step === 'done' && 'Password Reset!'}
                </h1>
                <p className="text-white/60 text-xs mt-0.5">
                  {step === 'email' && "We'll send a 6-digit code to your email"}
                  {step === 'otp' && `Code sent to ${email}`}
                  {step === 'done' && 'You can now log in with your new password'}
                </p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            {/* Progress */}
            {step !== 'done' && (
              <div className="flex gap-2 mb-8">
                {(['email', 'otp'] as Step[]).map((s, i) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      ['email', 'otp'].indexOf(step) >= i ? 'bg-violet-500' : 'bg-slate-700'
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

            {/* Step 1: Email */}
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

            {/* Step 2: OTP + New Password (validated together on submit) */}
            {step === 'otp' && (
              <form onSubmit={handleResetSubmit} className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[13px] text-slate-400 text-center leading-relaxed">
                    Enter the 6-digit code sent to{' '}
                    <span className="font-semibold text-slate-200">{email}</span>
                  </p>
                  <OTPInput
                    value={otpValue}
                    onChange={val => { setOtpValue(val); setError(''); }}
                    theme="dark"
                    autoFocus
                  />
                  <div className="text-center pt-1">
                    {canResend ? (
                      <button
                        type="button"
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
                </div>

                {/* New password fields */}
                <div className="space-y-4 pt-2 border-t border-slate-700/50">
                  <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider pt-1">New Password</p>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required minLength={8} disabled={isLoading}
                      className="w-full pl-10 pr-11 py-3 bg-slate-900 border border-slate-700 rounded-xl
                        text-white placeholder-slate-500 text-sm outline-none
                        focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      required disabled={isLoading}
                      className="w-full pl-10 pr-11 py-3 bg-slate-900 border border-slate-700 rounded-xl
                        text-white placeholder-slate-500 text-sm outline-none
                        focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    />
                    <button type="button" onClick={() => setShowConfirmPw(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpValue.length !== 6 || !newPassword || !confirmPassword}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                    text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed
                    hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-[0.98]"
                >
                  {isLoading ? 'Resetting…' : 'Reset Password'}
                </button>
                <p className="text-[11px] text-slate-600 text-center">Check your spam folder if you don't see the code.</p>
              </form>
            )}

            {/* Done */}
            {step === 'done' && (
              <div className="text-center space-y-6 py-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 mx-auto">
                  <CheckCircle className="h-10 w-10 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-black text-white">Password reset!</p>
                  <p className="text-sm text-slate-400 mt-1">All other sessions have been signed out for your security.</p>
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
