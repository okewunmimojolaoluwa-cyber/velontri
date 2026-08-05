'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
const SECRET_TAPS = 5;           // how many times to tap the title
const TAP_WINDOW_MS = 4000;      // taps must happen within this window

interface MaintenanceData {
  enabled: boolean;
  message: string;
}

export function MaintenanceBanner() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [success, setSuccess] = useState(false);

  // Secret tap tracking
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/platform/maintenance`)
      .then(r => r.json())
      .then(body => { if (body?.data) setData(body.data); })
      .catch(() => {});
  }, []);

  if (!data?.enabled || success) return null;

  function handleTitleTap() {
    tapCount.current += 1;
    // Reset timer on each tap
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, TAP_WINDOW_MS);

    if (tapCount.current >= SECRET_TAPS) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      setShowAuth(true);
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/platform/maintenance/emergency-disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const body = await res.json();
      if (res.ok && body?.data?.disabled) {
        setSuccess(true);
        // Redirect to admin after 1.5s
        setTimeout(() => { window.location.href = '/admin'; }, 1500);
      } else {
        setAuthError(body?.error?.message || body?.detail || 'Invalid credentials.');
      }
    } catch {
      setAuthError('Could not reach server. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-2xl">

        {success ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-[18px] font-black text-slate-900">Maintenance Disabled</p>
            <p className="text-[14px] text-slate-500">Redirecting to admin dashboard…</p>
          </div>
        ) : !showAuth ? (
          /* ── Normal maintenance screen (secret: tap title 5×) ── */
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 mx-auto mb-5">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <h1
              className="text-[22px] font-black text-slate-900 mb-3 cursor-default select-none"
              onClick={handleTitleTap}
              title=""
            >
              🔧 Under Maintenance
            </h1>
            <p className="text-[15px] text-slate-600 leading-relaxed mb-6">
              {data.message || "We are currently performing scheduled maintenance. We'll be back shortly."}
            </p>
            <div className="flex items-center justify-center gap-2 text-[13px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              We'll be back soon
            </div>
          </>
        ) : (
          /* ── Secret admin unlock form ── */
          <form onSubmit={handleUnlock} className="text-left space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                <AlertTriangle className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-[15px] font-black text-slate-900">Admin Override</p>
                <p className="text-[12px] text-slate-400">Enter your admin credentials to disable maintenance</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setAuthError(''); }}
                placeholder="admin@velontri.com"
                required
                autoFocus
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px]
                  text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400
                  focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setAuthError(''); }}
                  placeholder="Your admin password"
                  required
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-[14px]
                    text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400
                    focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-[12px] font-medium text-red-600">{authError}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl
                  bg-indigo-600 text-[14px] font-bold text-white hover:bg-indigo-700
                  transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Verifying…' : 'Disable Maintenance'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAuth(false); setEmail(''); setPassword(''); setAuthError(''); }}
                className="h-11 rounded-xl border border-slate-200 px-4 text-[13px]
                  font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
