'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, Shield, CheckCircle, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all';

/* ── Password strength indicator ─────────────────── */
function PwStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const score = [/[A-Z]/, /[a-z]/, /\d/, /[!@#$%^&*\-_+=]/, /.{8,}/].filter(r => r.test(pw)).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < score ? colors[score - 1] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{labels[score - 1] ?? 'Enter a password'}</p>
    </div>
  );
}

/* ── OTP input — 6 digit boxes ───────────────────── */
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = value.padEnd(6, '').slice(0, 6).split('');

  function handleChange(i: number, v: string) {
    const cleaned = v.replace(/\D/g, '').slice(-1);
    const arr = value.padEnd(6, '').slice(0, 6).split('');
    arr[i] = cleaned;
    const joined = arr.join('').replace(/\s/g, '').slice(0, 6);
    onChange(joined);
    if (cleaned && i < 5) {
      const next = document.getElementById(`otp-${i + 1}`);
      (next as HTMLInputElement)?.focus();
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const prev = document.getElementById(`otp-${i - 1}`);
      (prev as HTMLInputElement)?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(text);
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] === ' ' ? '' : digits[i]}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="w-12 h-14 rounded-xl border-2 border-slate-200 bg-slate-50 text-center
            text-[22px] font-black text-slate-900 outline-none transition-all
            focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10
            caret-indigo-500"
        />
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────── */
type Step = 'form' | 'otp' | 'done';

export default function UserSecurityPage() {
  const { session } = useAuth();

  // Step 1 state
  const [curPw,    setCurPw]    = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confPw,   setConfPw]   = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  // Step 2 state
  const [otp,      setOtp]      = useState('');
  const [emailHint, setEmailHint] = useState('');

  const [step, setStep] = useState<Step>('form');
  const [err,  setErr]  = useState('');

  /* Step 1 — request OTP */
  const { mutate: requestOtp, isPending: requesting } = useMutation({
    mutationFn: () => apiClient.post('/users/me/change-password', {
      current_password: curPw,
      new_password:     newPw,
    }),
    onSuccess: (res: any) => {
      setEmailHint(res.data?.data?.email_hint || '');
      setErr('');
      setStep('otp');
    },
    onError: (e: any) => {
      setErr(e?.response?.data?.error?.message || e?.message || 'Failed. Please try again.');
    },
  });

  /* Step 2 — verify OTP */
  const { mutate: verifyOtp, isPending: verifying } = useMutation({
    mutationFn: () => apiClient.post('/users/me/change-password/verify-otp', { otp }),
    onSuccess: () => {
      setStep('done');
      setErr('');
      setCurPw(''); setNewPw(''); setConfPw(''); setOtp('');
    },
    onError: (e: any) => {
      setErr(e?.response?.data?.error?.message || e?.message || 'Incorrect OTP. Please try again.');
      setOtp('');
    },
  });

  /* Re-send OTP */
  const { mutate: resendOtp, isPending: resending } = useMutation({
    mutationFn: () => apiClient.post('/users/me/change-password', {
      current_password: curPw,
      new_password:     newPw,
    }),
    onSuccess: () => {
      setErr('');
      setOtp('');
    },
    onError: () => {},
  });

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (newPw !== confPw)   { setErr('New passwords do not match.'); return; }
    if (newPw.length < 8)   { setErr('Password must be at least 8 characters.'); return; }
    requestOtp();
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (otp.length !== 6)   { setErr('Enter the full 6-digit code.'); return; }
    verifyOtp();
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Security</h1>
        <p className="text-[12px] text-slate-400 mt-0.5">Manage your account security</p>
      </div>

      {/* ── Change Password card ─────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <Lock className="h-4 w-4 text-indigo-600" />
          <h2 className="text-[14px] font-bold text-slate-900">Change Password</h2>
          {step === 'otp' && (
            <button onClick={() => { setStep('form'); setErr(''); setOtp(''); }}
              className="ml-auto flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-700 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
        </div>

        {/* ── Done ─────────── */}
        {step === 'done' && (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-[16px] font-black text-slate-900 mb-1">Password changed!</p>
              <p className="text-[13px] text-slate-400">Your new password is active. Use it next time you sign in.</p>
            </div>
            <button onClick={() => setStep('form')}
              className="h-10 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold
                text-slate-600 hover:bg-slate-50 transition-colors">
              Change again
            </button>
          </div>
        )}

        {/* ── Step 1: Enter passwords ── */}
        {step === 'form' && (
          <form onSubmit={handleStep1} className="p-5 space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Current password</label>
              <div className="relative">
                <input type={showCur ? 'text' : 'password'} value={curPw}
                  onChange={e => setCurPw(e.target.value)}
                  className={`${inputCls} pr-11`}
                  autoComplete="current-password" required />
                <button type="button" onClick={() => setShowCur(v => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1">
              <label className="text-[13px] font-semibold text-slate-700">New password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPw}
                  onChange={e => { setNewPw(e.target.value); setErr(''); }}
                  className={`${inputCls} pr-11`}
                  autoComplete="new-password" required />
                <button type="button" onClick={() => setShowNew(v => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PwStrength pw={newPw} />
              <p className="text-[11px] text-slate-400 mt-1">
                Min 8 chars with uppercase, lowercase, number & special character
              </p>
            </div>

            {/* Confirm */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Confirm new password</label>
              <input type="password" value={confPw}
                onChange={e => setConfPw(e.target.value)}
                className={inputCls} autoComplete="new-password" required />
              {confPw && newPw !== confPw && (
                <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <p className="text-[12px] font-medium text-red-600">{err}</p>
              </div>
            )}

            <button type="submit"
              disabled={requesting || !curPw || !newPw || !confPw || newPw !== confPw}
              className="h-11 w-full rounded-xl bg-indigo-600 text-[14px] font-bold text-white
                hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2">
              {requesting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sending OTP…
                </>
              ) : 'Continue — Send OTP to email'}
            </button>
          </form>
        )}

        {/* ── Step 2: Enter OTP ── */}
        {step === 'otp' && (
          <div className="p-6 space-y-6">
            {/* Icon + info */}
            <div className="text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 mx-auto mb-3">
                <Mail className="h-7 w-7 text-indigo-600" />
              </div>
              <p className="text-[15px] font-black text-slate-900 mb-1">Check your email</p>
              <p className="text-[13px] text-slate-400 max-w-xs mx-auto">
                We sent a 6-digit code to{' '}
                {emailHint
                  ? <strong className="text-slate-700">{emailHint}</strong>
                  : 'your email address'}.
                {' '}Enter it below to confirm the password change.
              </p>
            </div>

            <form onSubmit={handleStep2} className="space-y-4">
              <OtpInput value={otp} onChange={setOtp} />

              {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-center">
                  <p className="text-[12px] font-medium text-red-600">{err}</p>
                </div>
              )}

              <button type="submit"
                disabled={verifying || otp.length !== 6}
                className="h-11 w-full rounded-xl bg-indigo-600 text-[14px] font-bold text-white
                  hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2">
                {verifying ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Verifying…</>
                ) : 'Verify & change password'}
              </button>
            </form>

            {/* Resend */}
            <div className="text-center">
              <p className="text-[12px] text-slate-400 mb-1">Didn&apos;t receive the code?</p>
              <button
                onClick={() => resendOtp()}
                disabled={resending}
                className="text-[13px] font-semibold text-indigo-600 hover:underline disabled:opacity-50">
                {resending ? 'Resending…' : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2FA info ──────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <Shield className="h-4 w-4 text-emerald-600" />
          <h2 className="text-[14px] font-bold text-slate-900">Two-Factor Authentication</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-900">2FA via Authenticator App</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Add an extra layer of security</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
              Coming soon
            </span>
          </div>
        </div>
      </div>

      {/* ── Active session ────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <Shield className="h-4 w-4 text-slate-500" />
          <h2 className="text-[14px] font-bold text-slate-900">Active Session</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-900">Current browser session</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Signed in as {session.userId?.slice(0, 8) ?? '…'}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1
              text-[11px] font-semibold text-emerald-700">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
