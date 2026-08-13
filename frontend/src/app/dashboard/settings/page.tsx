'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { usersApi, userKeys } from '@/lib/api/endpoints/users';
import { useAuth } from '@/features/auth/auth-provider';
import { apiClient } from '@/lib/api/client';
import { VelontriApiError } from '@/types/api';
import { authApi } from '@/lib/api/endpoints/auth';
import { getRefreshToken, clearTokens } from '@/lib/auth/token-refresh';

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10 transition-all';

type Tab = 'profile' | 'security' | 'account';

function PwStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const score = [/[A-Z]/, /[a-z]/, /\d/, /[!@#$%^&*]/, /.{8,}/].filter(r => r.test(pw)).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => <div key={i} className={`flex-1 h-1.5 rounded-full ${i < score ? colors[score-1] : 'bg-slate-200'} transition-all`} />)}
      </div>
      <p className="text-[11px] text-slate-400">{labels[score-1] ?? 'Enter a password'}</p>
    </div>
  );
}

export default function SettingsPage() {
  const { session, logout: authLogout } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const fullNameRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLInputElement>(null);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  // Deactivate state
  const [deactivatePw, setDeactivatePw] = useState('');
  const [deactivateErr, setDeactivateErr] = useState('');
  const [showDeactivatePw, setShowDeactivatePw] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: userKeys.profile(),
    queryFn: () => usersApi.getProfile(),
    enabled: session.isAuthenticated,
  });

  const { mutate: updateProfile, isPending: updatingProfile } = useMutation({
    mutationFn: (p: { full_name?: string; bio?: string }) => usersApi.updateProfile(p),
    onSuccess: () => { setProfileMsg('Saved.'); qc.invalidateQueries({ queryKey: userKeys.profile() }); setTimeout(() => setProfileMsg(''), 3000); },
    onError: (e) => { if (e instanceof VelontriApiError) setProfileErr(e.message); else setProfileErr('Failed.'); },
  });

  const { mutate: changePw, isPending: changingPw } = useMutation({
    mutationFn: () => usersApi.changePassword({ current_password: curPw, new_password: newPw }),
    onSuccess: () => { setPwMsg('Password changed.'); setCurPw(''); setNewPw(''); setTimeout(() => setPwMsg(''), 3000); },
    onError: (e) => { if (e instanceof VelontriApiError) setPwErr(e.message); else setPwErr('Failed.'); },
  });

  const { mutate: deactivate, isPending: deactivating } = useMutation({
    mutationFn: () => apiClient.post('/users/me/deactivate', { password: deactivatePw }),
    onSuccess: async () => {
      // Log out immediately after deactivation
      try { const rt = getRefreshToken(); if (rt) await authApi.logout(rt); } catch {}
      clearTokens();
      authLogout();
      window.location.href = '/?deactivated=1';
    },
    onError: (e: any) => {
      setDeactivateErr(e?.response?.data?.error?.message || e?.message || 'Failed to deactivate account.');
    },
  });

  const profile = data?.data;

  return (
      <div className="max-w-xl space-y-5">
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Settings</h1>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {(['profile', 'security', 'account'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold capitalize transition-all
                ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-11 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Profile tab */}
            {tab === 'profile' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-slate-500" />
                  <h2 className="text-[14px] font-bold text-slate-900">Profile Information</h2>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Full name</label>
                  <input ref={fullNameRef} defaultValue={profile?.full_name ?? ''} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Bio</label>
                  <input ref={bioRef} defaultValue={profile?.bio ?? ''} placeholder="Tell buyers about yourself…" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Email</label>
                  <input value={profile?.email ?? ''} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Phone</label>
                  <input value={profile?.phone ?? ''} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
                </div>
                {profileErr && <p className="text-[12px] text-red-500">{profileErr}</p>}
                {profileMsg && <p className="text-[12px] text-emerald-600 font-semibold">{profileMsg}</p>}
                <button
                  disabled={updatingProfile}
                  onClick={() => { setProfileErr(''); updateProfile({ full_name: fullNameRef.current?.value, bio: bioRef.current?.value }); }}
                  className="h-11 w-full rounded-xl bg-indigo-600 text-[14px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {updatingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}

            {/* Security tab */}
            {tab === 'security' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-slate-500" />
                  <h2 className="text-[14px] font-bold text-slate-900">Change Password</h2>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Current password</label>
                  <div className="relative">
                    <input type={showCur ? 'text' : 'password'} value={curPw} onChange={e => setCurPw(e.target.value)}
                      className={`${inputCls} pr-11`} autoComplete="current-password" />
                    <button type="button" onClick={() => setShowCur(v => !v)} tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-semibold text-slate-700">New password</label>
                  <div className="relative">
                    <input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => { setNewPw(e.target.value); setPwErr(''); }}
                      className={`${inputCls} pr-11`} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowNew(v => !v)} tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PwStrength pw={newPw} />
                </div>
                {pwErr && <p className="text-[12px] text-red-500">{pwErr}</p>}
                {pwMsg && <p className="text-[12px] text-emerald-600 font-semibold">{pwMsg}</p>}
                <button
                  disabled={changingPw || !curPw || !newPw}
                  onClick={() => { setPwErr(''); changePw(); }}
                  className="h-11 w-full rounded-xl bg-indigo-600 text-[14px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {changingPw ? 'Changing…' : 'Change password'}
                </button>
              </div>
            )}

            {/* Account tab — deactivate */}
            {tab === 'account' && (
              <div className="space-y-4">
                {/* Info card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-[14px] font-bold text-slate-900 mb-1">Account Status</h2>
                  <p className="text-[13px] text-slate-500 mb-4">
                    Your account is currently <span className="font-semibold text-emerald-600">active</span>.
                    All your listings, messages, and data are intact.
                  </p>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-[12px] text-slate-500 space-y-1">
                    <p>• Email: <span className="font-semibold text-slate-700">{profile?.email}</span></p>
                    <p>• Member since: <span className="font-semibold text-slate-700">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' }) : '—'}</span></p>
                  </div>
                </div>

                {/* Deactivate section */}
                <div className="rounded-2xl border-2 border-red-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-[14px] font-bold text-red-900">Deactivate Account</h2>
                      <p className="text-[12px] text-red-700 mt-0.5 leading-relaxed">
                        Your account will be deactivated and you will be logged out immediately.
                        Your listings will be hidden. You can contact support to reactivate.
                      </p>
                    </div>
                  </div>

                  {!confirmDeactivate ? (
                    <button
                      onClick={() => setConfirmDeactivate(true)}
                      className="h-10 w-full rounded-xl border-2 border-red-300 bg-red-50 text-[13px] font-bold text-red-700 hover:bg-red-100 transition-colors"
                    >
                      Deactivate my account
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[12px] font-semibold text-slate-700">
                        Enter your password to confirm deactivation:
                      </p>
                      <div className="relative">
                        <input
                          type={showDeactivatePw ? 'text' : 'password'}
                          value={deactivatePw}
                          onChange={e => { setDeactivatePw(e.target.value); setDeactivateErr(''); }}
                          placeholder="Your current password"
                          className={`${inputCls} pr-11 border-red-200 focus:border-red-400`}
                        />
                        <button type="button" onClick={() => setShowDeactivatePw(v => !v)} tabIndex={-1}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showDeactivatePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {deactivateErr && (
                        <p className="text-[12px] font-medium text-red-600">{deactivateErr}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setConfirmDeactivate(false); setDeactivatePw(''); setDeactivateErr(''); }}
                          disabled={deactivating}
                          className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => { setDeactivateErr(''); deactivate(); }}
                          disabled={deactivating || !deactivatePw.trim()}
                          className="flex-1 h-10 rounded-xl bg-red-600 text-[13px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {deactivating ? 'Deactivating…' : 'Confirm Deactivate'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
  );
}
