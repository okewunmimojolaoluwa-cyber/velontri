'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { usersApi, userKeys } from '@/lib/api/endpoints/users';
import { useAuth } from '@/features/auth/auth-provider';
import { VelontriApiError } from '@/types/api';

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10 transition-all';

type Tab = 'profile' | 'security';

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
  const { session } = useAuth();
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

  const profile = data?.data;

  return (
      <div className="max-w-xl space-y-5">
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Settings</h1>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {(['profile', 'security'] as Tab[]).map(t => (
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
          </>
        )}
      </div>
  );
}
