'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, Mail, CheckCircle, RefreshCw, Shield } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { userKeys } from '@/lib/api/endpoints/users';

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

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all';

export default function AdminSecurityPage() {
  const qc = useQueryClient();

  /* ── Email change ─────────────────────────── */
  const [newEmail, setNewEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailErr, setEmailErr] = useState('');

  const { mutate: saveEmail, isPending: savingEmail } = useMutation({
    mutationFn: () => apiClient.patch('/users/me', { email: newEmail.trim().toLowerCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.profile() });
      setEmailSaved(true);
      setEmailErr('');
      setNewEmail('');
      setTimeout(() => setEmailSaved(false), 4000);
    },
    onError: (e: any) => {
      setEmailErr(e?.response?.data?.error?.message || e?.message || 'Failed to update email.');
    },
  });

  function handleEmailSave(e: React.FormEvent) {
    e.preventDefault();
    setEmailErr('');
    if (!newEmail.includes('@')) { setEmailErr('Enter a valid email address.'); return; }
    saveEmail();
  }

  /* ── Password change (direct — no OTP) ─────── */
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [pwErr, setPwErr] = useState('');

  const { mutate: changePw, isPending: changingPw } = useMutation({
    mutationFn: () =>
      apiClient.post('/users/me/change-password', {
        current_password: curPw,
        new_password: newPw,
      }),
    onSuccess: () => {
      setPwDone(true);
      setPwErr('');
      setCurPw(''); setNewPw(''); setConfPw('');
    },
    onError: (e: any) => {
      setPwErr(e?.response?.data?.error?.message || e?.message || 'Failed to change password.');
    },
  });

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwErr('');
    if (newPw !== confPw) { setPwErr('New passwords do not match.'); return; }
    if (newPw.length < 8) { setPwErr('Password must be at least 8 characters.'); return; }
    changePw();
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-600" /> Security Settings
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Change your email address or password</p>
      </div>

      {/* ── Email Change ─────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <Mail className="h-4 w-4 text-indigo-600" />
          <h2 className="text-[14px] font-bold text-slate-900">Change Email Address</h2>
        </div>
        <form onSubmit={handleEmailSave} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-slate-700">New email address</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setEmailErr(''); }}
              className={inputCls}
              placeholder="new@example.com"
              required
            />
          </div>
          {emailErr && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
              <p className="text-[12px] font-medium text-red-600">{emailErr}</p>
            </div>
          )}
          {emailSaved && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
              <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <p className="text-[12px] font-semibold text-emerald-700">Email updated successfully.</p>
            </div>
          )}
          <button
            type="submit"
            disabled={savingEmail || !newEmail}
            className="h-10 w-full rounded-xl bg-indigo-600 text-[13px] font-bold text-white
              hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {savingEmail ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Saving…</> : 'Update Email'}
          </button>
        </form>
      </div>

      {/* ── Password Change ─────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <Lock className="h-4 w-4 text-indigo-600" />
          <h2 className="text-[14px] font-bold text-slate-900">Change Password</h2>
        </div>

        {pwDone ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-[16px] font-black text-slate-900 mb-1">Password changed!</p>
              <p className="text-[13px] text-slate-400">Your new password is active immediately.</p>
            </div>
            <button
              onClick={() => setPwDone(false)}
              className="h-9 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Change again
            </button>
          </div>
        ) : (
          <form onSubmit={handlePwSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Current password</label>
              <div className="relative">
                <input
                  type={showCur ? 'text' : 'password'}
                  value={curPw}
                  onChange={e => setCurPw(e.target.value)}
                  className={`${inputCls} pr-11`}
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => setShowCur(v => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[13px] font-semibold text-slate-700">New password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => { setNewPw(e.target.value); setPwErr(''); }}
                  className={`${inputCls} pr-11`}
                  autoComplete="new-password"
                  required
                />
                <button type="button" onClick={() => setShowNew(v => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PwStrength pw={newPw} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Confirm new password</label>
              <input
                type="password"
                value={confPw}
                onChange={e => setConfPw(e.target.value)}
                className={inputCls}
                autoComplete="new-password"
                required
              />
              {confPw && newPw !== confPw && (
                <p className="text-[11px] text-red-500">Passwords do not match</p>
              )}
            </div>

            {pwErr && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <p className="text-[12px] font-medium text-red-600">{pwErr}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={changingPw || !curPw || !newPw || !confPw || newPw !== confPw}
              className="h-11 w-full rounded-xl bg-indigo-600 text-[14px] font-bold text-white
                hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {changingPw
                ? <><RefreshCw className="h-4 w-4 animate-spin" />Changing password…</>
                : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
