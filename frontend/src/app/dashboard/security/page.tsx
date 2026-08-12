'use client';

import { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, Shield, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { authApi } from '@/lib/api/endpoints';

const RESEND_COUNTDOWN = 60;

type Step = 'password' | 'otp' | 'done';

const inputCls = 'w-full h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 text-[14px] text-slate-100 placeholder-slate-500 outline-none focus:border-violet-500 focus:bg-slate-800 focus:ring-2 focus:ring-violet-500/15 transition-all';

/* ── Password strength indicator ───────────────────────────── */
function PwStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const score = [/[A-Z]/, /[a-z]/, /\d/, /[!@#$%^&*\-_+=]/, /.{8,}/].filter(r => r.test(pw)).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < score ? colors[score - 1] : 'bg-slate-700'}`} />
        ))}
      </div>
      <p className="text-[11px] text-slate-500">{labels[score - 1] ?? 'Enter a password'}</p>
    </div>
  );
}

/* ── OTP input box ──────────────────────────────────────────── */
function OtpBox({
  value, index, onChange, onKeyDown, inputRef,
}: {
  value: string; index: number;
  onChange: (i: number, v: string) => void;
  onKeyDown: (i: number, e: React.KeyboardEvent) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="text" inputMode="numeric" pattern="[0-9]*"
      maxLength={1} value={value}
      onChange={e => onChange(index, e.target.value.replace(/\D/g, ''))}
      onKeyDown={e => onKeyDown(index, e)}
      onFocus={e => e.target.select()}
      className="h-12 w-10 rounded-xl border-2 bg-slate-900 text-center text-[20px] font-black
        text-white outline-none border-slate-700
        focus:border-violet-500 focus:bg-slate-800 focus:ring-4 focus:ring-violet-500/20 transition-all"
      aria-label={`Digit ${index + 1} of 6`}
    />
  );
}

export default function UserSecurityPage() {
  const { session } = useAuth();
  const [step, setStep] = useState<Step>('password');

  // Step 1: current + new password
  const [curPw,   setCurPw]   = useState('');
  const [newPw,   setNewPw]   = useState('');
  const [confPw,  setConfPw]  = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [isLoadingStep1, setIsLoadingStep1] = useState(false);

  // Step 2: OTP
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const [isLoadingStep2, setIsLoadingStep2] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [err, setErr] = useState('');

  const otp = digits.join('');

  // Focus first OTP box when step changes to otp
  useEffect(() => {
    if (step === 'otp') setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [step]);

  // Countdown
  useEffect(() => {
    if (step !== 'otp') return;
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown, step]);

  // ── Step 1: Verify current password, send OTP ────────────────────────
  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (newPw !== confPw)  { setErr('New passwords do not match.'); return; }
    if (newPw.length < 8)  { setErr('Password must be at least 8 characters.'); return; }
    if (curPw === newPw)   { setErr('New password must be different from current.'); return; }

    setIsLoadingStep1(true);
    try {
      await authApi.changePasswordRequest(curPw);
      setStep('otp');
      setCountdown(RESEND_COUNTDOWN);
      setCanResend(false);
    } catch (e: any) {
      setErr(
        e?.response?.data?.error?.message ||
        e?.message ||
        'Incorrect current password.'
      );
    } finally {
      setIsLoadingStep1(false);
    }
  }

  // ── Step 2: Verify OTP, update password ──────────────────────────────
  async function handleStep2() {
    if (otp.length !== 6) { setErr('Please enter all 6 digits.'); return; }
    setErr('');
    setIsLoadingStep2(true);
    try {
      await authApi.changePasswordConfirm(otp, newPw);
      setStep('done');
    } catch (e: any) {
      setErr(
        e?.response?.data?.error?.message ||
        e?.message ||
        'Incorrect or expired code.'
      );
      setDigits(Array(6).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setIsLoadingStep2(false);
    }
  }

  async function handleResend() {
    setCanResend(false);
    setCountdown(RESEND_COUNTDOWN);
    setErr('');
    setDigits(Array(6).fill(''));
    try { await authApi.changePasswordRequest(curPw); } catch { /* silent */ }
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  }

  function handleOtpChange(index: number, val: string) {
    if (!val) { const n = [...digits]; n[index] = ''; setDigits(n); return; }
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, '').slice(0, 6);
      const next = Array(6).fill('');
      for (let i = 0; i < pasted.length && i + index < 6; i++) next[i + index] = pasted[i];
      setDigits(next);
      setTimeout(() => inputRefs.current[Math.min(index + pasted.length, 5)]?.focus(), 10);
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

  function reset() {
    setStep('password');
    setCurPw(''); setNewPw(''); setConfPw('');
    setDigits(Array(6).fill(''));
    setErr('');
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-[1.4rem] font-black text-slate-100 tracking-tight">Security</h1>
        <p className="text-[12px] text-slate-500 mt-0.5">Manage your account security</p>
      </div>

      {/* ── Change Password card ─────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-5 py-4">
          <Lock className="h-4 w-4 text-violet-400" />
          <span className="text-[14px] font-bold text-slate-100">Change Password</span>
          {step !== 'password' && (
            <span className="ml-auto text-[11px] font-semibold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
              {step === 'otp' ? 'Step 2 of 2 — Verify' : 'Done'}
            </span>
          )}
        </div>

        <div className="px-5 py-5">
          {/* Error */}
          {err && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[13px] font-medium text-red-400">{err}</p>
            </div>
          )}

          {/* ── Step 1: Enter passwords ── */}
          {step === 'password' && (
            <form onSubmit={handleStep1} className="space-y-4">
              {/* Current password */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-400 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCur ? 'text' : 'password'}
                    value={curPw}
                    onChange={e => setCurPw(e.target.value)}
                    placeholder="Your current password"
                    required
                    disabled={isLoadingStep1}
                    className={inputCls + ' pr-10'}
                  />
                  <button type="button" onClick={() => setShowCur(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-400 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    disabled={isLoadingStep1}
                    className={inputCls + ' pr-10'}
                  />
                  <button type="button" onClick={() => setShowNew(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PwStrength pw={newPw} />
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-400 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConf ? 'text' : 'password'}
                    value={confPw}
                    onChange={e => setConfPw(e.target.value)}
                    placeholder="Repeat your new password"
                    required
                    disabled={isLoadingStep1}
                    className={inputCls + ' pr-10'}
                  />
                  <button type="button" onClick={() => setShowConf(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1 bg-slate-800/50 rounded-xl p-3 flex gap-2">
                <Shield className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  We'll email a 6-digit verification code to your registered address before updating your password.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoadingStep1 || !curPw || !newPw || !confPw}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                  text-white font-semibold text-[13px] disabled:opacity-50 disabled:cursor-not-allowed
                  hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-[0.98]"
              >
                {isLoadingStep1 ? 'Sending code…' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <div className="space-y-5">
              <p className="text-[13px] text-slate-400 text-center leading-relaxed">
                Enter the 6-digit code sent to your registered email.
              </p>

              <div className="flex items-center justify-center gap-2">
                {digits.map((d, i) => (
                  <OtpBox
                    key={i} value={d} index={i}
                    onChange={handleOtpChange}
                    onKeyDown={handleOtpKeyDown}
                    inputRef={el => { inputRefs.current[i] = el; }}
                  />
                ))}
              </div>

              <button
                onClick={handleStep2}
                disabled={otp.length !== 6 || isLoadingStep2}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                  text-white font-semibold text-[13px] disabled:opacity-40 disabled:cursor-not-allowed
                  hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-[0.98]"
              >
                {isLoadingStep2 ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                        strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                    </svg>
                    Verifying…
                  </span>
                ) : 'Confirm Password Change'}
              </button>

              <div className="text-center space-y-1">
                <p className="text-[12px] text-slate-500">Didn't receive the code?</p>
                {canResend ? (
                  <button onClick={handleResend}
                    className="flex items-center justify-center gap-1.5 mx-auto text-[12px]
                      font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                    <RefreshCw className="h-3 w-3" />
                    Resend code
                  </button>
                ) : (
                  <p className="text-[12px] text-slate-600">
                    Resend in <span className="font-semibold text-slate-400">{countdown}s</span>
                  </p>
                )}
              </div>

              <button onClick={reset}
                className="w-full text-center text-[12px] text-slate-600 hover:text-slate-400 transition-colors">
                ← Back
              </button>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-[16px] font-black text-slate-100">Password changed!</p>
                <p className="text-[13px] text-slate-500 mt-1">All other sessions have been signed out.</p>
              </div>
              <button
                onClick={reset}
                className="text-[13px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
              >
                Change again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
