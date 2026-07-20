'use client';

import { useState } from 'react';
import {
  Settings, Bell, Lock, LogOut, Eye, EyeOff,
  CheckCircle, Shield, Smartphone,
} from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { clearTokens, getRefreshToken } from '@/lib/auth/token-refresh';
import { authApi } from '@/lib/api/endpoints/auth';

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-500/10 transition-all';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-amber-500' : 'bg-slate-200'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

function PwStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const score = [/[A-Z]/, /[a-z]/, /\d/, /[!@#$%^&*\-_+=]/, /.{8,}/].filter(r => r.test(pw)).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < score ? colors[score-1] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{labels[score-1] ?? 'Enter a password'}</p>
    </div>
  );
}

type Tab = 'general' | 'notifications' | 'security';

export default function ModSettingsPage() {
  const { session, logout: authLogout } = useAuth();
  const [tab, setTab] = useState<Tab>('general');

  // General preferences (local state — no backend endpoint for mod preferences yet)
  const [prefs, setPrefs] = useState({
    auto_assign_tickets: true,
    sound_alerts: false,
  });
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Notification preferences
  const [notifs, setNotifs] = useState({
    email_notifications: true,
    push_notifications: false,
    new_listing_alerts: true,
    dispute_alerts: true,
  });
  const [notifsSaved, setNotifsSaved] = useState(false);

  // Change password
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  const { mutate: changePw, isPending: changingPw } = useMutation({
    mutationFn: () =>
      apiClient.post('/users/me/change-password', {
        current_password: curPw,
        new_password: newPw,
      }),
    onSuccess: () => {
      setPwMsg('Password changed successfully.');
      setCurPw(''); setNewPw(''); setConfPw('');
      setTimeout(() => setPwMsg(''), 4000);
    },
    onError: (e: any) => {
      setPwErr(e?.response?.data?.error?.message || e?.message || 'Failed to change password.');
    },
  });

  // Sign out all devices
  const { mutate: signOutAll, isPending: signingOut } = useMutation({
    mutationFn: async () => {
      // Revoke current refresh token, then clear local session
      try {
        const rt = getRefreshToken();
        if (rt) await authApi.logout(rt);
      } catch {}
    },
    onSuccess: () => {
      authLogout();
      window.location.href = '/login';
    },
  });

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwErr('');
    if (newPw !== confPw) { setPwErr('New passwords do not match.'); return; }
    if (newPw.length < 8) { setPwErr('Password must be at least 8 characters.'); return; }
    changePw();
  }

  const TAB_CLS = (t: Tab) =>
    `py-3 px-1 border-b-2 text-[13px] font-semibold capitalize transition-all ${
      tab === t
        ? 'border-amber-500 text-amber-600'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 text-amber-500" /> Settings
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Manage your moderator account preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200">
        {(['general', 'notifications', 'security'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={TAB_CLS(t)}>{t}</button>
        ))}
      </div>

      {/* ── General ─────────────────────────────────── */}
      {tab === 'general' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">General Preferences</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              {
                key: 'auto_assign_tickets' as const,
                label: 'Auto-assign Support Tickets',
                desc: 'Automatically get assigned new support tickets when available',
              },
              {
                key: 'sound_alerts' as const,
                label: 'Sound Alerts',
                desc: 'Play a sound when new items need moderation',
              },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">{label}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle
                  checked={prefs[key]}
                  onChange={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                />
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-slate-100">
            {prefsSaved && (
              <p className="text-[12px] font-semibold text-emerald-600 mb-2 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" /> Preferences saved.
              </p>
            )}
            <button
              onClick={() => { setPrefsSaved(true); setTimeout(() => setPrefsSaved(false), 3000); }}
              className="h-10 rounded-xl bg-amber-500 px-5 text-[13px] font-bold text-white
                hover:bg-amber-600 transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ── Notifications ────────────────────────────── */}
      {tab === 'notifications' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Notification Preferences</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { key: 'email_notifications' as const, label: 'Email Notifications', desc: 'Receive moderation alerts via email' },
              { key: 'push_notifications' as const,  label: 'Push Notifications',  desc: 'Real-time browser push notifications' },
              { key: 'new_listing_alerts' as const,  label: 'New Listing Alerts',  desc: 'Get notified when listings need review' },
              { key: 'dispute_alerts' as const,      label: 'Dispute Alerts',      desc: 'Get notified about new disputes' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">{label}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle
                  checked={notifs[key]}
                  onChange={() => setNotifs(n => ({ ...n, [key]: !n[key] }))}
                />
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-slate-100">
            {notifsSaved && (
              <p className="text-[12px] font-semibold text-emerald-600 mb-2 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" /> Preferences saved.
              </p>
            )}
            <button
              onClick={() => { setNotifsSaved(true); setTimeout(() => setNotifsSaved(false), 3000); }}
              className="h-10 rounded-xl bg-amber-500 px-5 text-[13px] font-bold text-white
                hover:bg-amber-600 transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ── Security ─────────────────────────────────── */}
      {tab === 'security' && (
        <div className="space-y-4">

          {/* Change password */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Change Password</h2>
            </div>
            <form onSubmit={handlePwSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-700">Current password</label>
                <div className="relative">
                  <input type={showCur ? 'text' : 'password'} value={curPw}
                    onChange={e => setCurPw(e.target.value)}
                    className={`${inputCls} pr-11`} autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowCur(v => !v)} tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[13px] font-semibold text-slate-700">New password</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} value={newPw}
                    onChange={e => { setNewPw(e.target.value); setPwErr(''); }}
                    className={`${inputCls} pr-11`} autoComplete="new-password" required />
                  <button type="button" onClick={() => setShowNew(v => !v)} tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PwStrength pw={newPw} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-700">Confirm new password</label>
                <input type="password" value={confPw} onChange={e => setConfPw(e.target.value)}
                  className={inputCls} autoComplete="new-password" required />
              </div>
              {pwErr && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                  <p className="text-[12px] font-medium text-red-600">{pwErr}</p>
                </div>
              )}
              {pwMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-[12px] font-semibold text-emerald-700">{pwMsg}</p>
                </div>
              )}
              <button type="submit" disabled={changingPw || !curPw || !newPw || !confPw}
                className="h-10 rounded-xl bg-amber-500 px-5 text-[13px] font-bold text-white
                  hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {changingPw ? 'Changing…' : 'Change password'}
              </button>
            </form>
          </div>

          {/* 2FA */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-amber-500" />
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Two-Factor Authentication</h2>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[14px] font-semibold text-slate-900">Authenticator App</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Add an extra layer of security to your account</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                Coming soon
              </span>
            </div>
          </div>

          {/* Sign out all devices */}
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50/50 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[14px] font-bold text-red-900">Sign Out All Devices</p>
                <p className="text-[12px] text-red-700/70 mt-0.5">
                  Immediately sign out from all active sessions. You'll need to log in again.
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Sign out from all devices? You will be logged out immediately.')) {
                    signOutAll();
                  }
                }}
                disabled={signingOut}
                className="flex items-center gap-2 h-9 rounded-xl bg-red-600 px-4 text-[12px]
                  font-bold text-white hover:bg-red-700 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ml-4">
                <LogOut className="h-3.5 w-3.5" />
                {signingOut ? 'Signing out…' : 'Sign Out All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
