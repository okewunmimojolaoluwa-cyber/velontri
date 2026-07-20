'use client';

import { Suspense, useCallback } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, CheckCircle, Mail, Lock } from 'lucide-react';
import { authApi } from '@/lib/api/endpoints/auth';
import { setTokens } from '@/lib/auth/token-refresh';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES, resolveHomePath } from '@/config/routes';
import { VelontriApiError } from '@/types/api';
import { parseJwtPayload, payloadToSession } from '@/lib/auth/jwt';
import { GoogleSignInButton, AuthDivider } from '@/components/auth/google-sign-in';

const inputCls = [
  'w-full h-12 rounded-xl border border-slate-200 bg-slate-50',
  'text-[14px] text-slate-900 placeholder-slate-400',
  'transition-all outline-none',
  'focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10',
  'disabled:opacity-40',
].join(' ');

function LoginInner() {
  const router   = useRouter();
  const sp       = useSearchParams();
  const redirect = sp.get('redirect') ?? '';
  const verified = sp.get('verified') === '1';
  const { setSessionFromToken } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function handleTokens(accessToken: string, refreshToken: string) {
    setTokens(accessToken, refreshToken);
    setSessionFromToken(accessToken);
    const payload = parseJwtPayload(accessToken);
    const session = payload ? payloadToSession(payload) : null;
    const role = session?.role ?? 'user';
    const dest = redirect ? decodeURIComponent(redirect) : resolveHomePath(role);
    router.push(dest);
  }

  async function doLogin(id: string, pw: string) {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ identifier: id, password: pw });
      const d = res.data;
      if (d.requires_2fa && d.two_fa_session_id) {
        router.push(`/verify-2fa?session=${d.two_fa_session_id}`);
        return;
      }
      if (!d.tokens?.access_token) { setError('No token returned. Please try again.'); return; }
      handleTokens(d.tokens.access_token, d.tokens.refresh_token);
    } catch (err) {
      if (err instanceof VelontriApiError) {
        setError(err.status === 422 ? 'Invalid email/phone or password.' : err.message);
      } else {
        setError('Sign in failed. Please try again.');
      }
    } finally { setLoading(false); }
  }

  const handleGoogleSuccess = useCallback(async (idToken: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      const res = await authApi.googleLogin(idToken);
      const d = res.data;
      if (!d.tokens?.access_token) { setError('Google sign-in failed. Please try again.'); return; }
      handleTokens(d.tokens.access_token, d.tokens.refresh_token);
    } catch (err) {
      if (err instanceof VelontriApiError) {
        setError(err.message);
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally { setGoogleLoading(false); }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doLogin(identifier, password);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[1.75rem] font-black tracking-tight text-slate-900 leading-tight">
          Welcome back
        </h1>
        <p className="mt-1.5 text-[14px] text-slate-500">
          Sign in to your Velontri account
        </p>
      </div>

      {/* Verified banner */}
      {verified && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <p className="text-[13px] font-semibold text-emerald-700">
            Phone verified. You can now sign in.
          </p>
        </div>
      )}

      {/* Google Sign-In */}
      <div className="space-y-3">
        {googleLoading ? (
          <div className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
            <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
            </svg>
          </div>
        ) : (
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={setError}
            label="Continue with Google"
            disabled={loading}
          />
        )}
      </div>

      <AuthDivider label="or sign in with email" />

      {/* Email/password form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-slate-700">Email or Phone</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="you@example.com or +234…"
              required
              autoComplete="username"
              className={`${inputCls} pl-10`}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[13px] font-semibold text-slate-700">Password</label>
            <Link href="/forgot-password" className="text-[12px] font-medium text-indigo-600 hover:underline no-underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
              className={`${inputCls} pl-10 pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-[13px] font-medium text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full h-12 rounded-xl bg-indigo-600 text-white text-[14px] font-bold
            shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.99]
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
              </svg>
              Signing in…
            </span>
          ) : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-[14px] text-slate-500">
        No account?{' '}
        <Link href={ROUTES.register} className="font-bold text-indigo-600 hover:underline no-underline">
          Create one free
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
