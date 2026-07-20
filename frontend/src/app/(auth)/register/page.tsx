'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, User, Mail, Phone, Lock, Globe } from 'lucide-react';
import { authApi } from '@/lib/api/endpoints/auth';
import { ROUTES, resolveHomePath } from '@/config/routes';
import { VelontriApiError } from '@/types/api';
import { setTokens } from '@/lib/auth/token-refresh';
import { useAuth } from '@/features/auth/auth-provider';
import { parseJwtPayload, payloadToSession } from '@/lib/auth/jwt';
import { GoogleSignInButton, AuthDivider } from '@/components/auth/google-sign-in';

const inputCls = [
  'w-full h-12 rounded-xl border border-slate-200 bg-slate-50',
  'text-[14px] text-slate-900 placeholder-slate-400',
  'transition-all outline-none',
  'focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10',
].join(' ');

const COUNTRIES = [
  { code: 'NG', label: '🇳🇬 Nigeria (+234)' },
  { code: 'GH', label: '🇬🇭 Ghana (+233)' },
  { code: 'KE', label: '🇰🇪 Kenya (+254)' },
  { code: 'ZA', label: '🇿🇦 South Africa (+27)' },
  { code: 'TZ', label: '🇹🇿 Tanzania (+255)' },
  { code: 'UG', label: '🇺🇬 Uganda (+256)' },
  { code: 'CM', label: '🇨🇲 Cameroon (+237)' },
  { code: 'RW', label: '🇷🇼 Rwanda (+250)' },
  { code: 'ET', label: '🇪🇹 Ethiopia (+251)' },
];

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Add an uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Add a lowercase letter.';
  if (!/\d/.test(pw)) return 'Add a number.';
  if (!/[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]/.test(pw)) return 'Add a special character (!@#$%...).';
  return null;
}

function PasswordStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const checks = [/[A-Z]/, /[a-z]/, /\d/, /[!@#$%^&*]/, /.{8,}/];
  const score = checks.filter(r => r.test(pw)).length;
  const colours = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'];
  const labels  = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < score ? colours[score - 1] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{labels[score - 1] ?? 'Enter a password'}</p>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { setSessionFromToken } = useAuth();

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', country_code: 'NG',
  });
  const [showPw,        setShowPw]        = useState(false);
  const [pwErr,         setPwErr]         = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(p => ({ ...p, [k]: e.target.value }));
      if (k === 'password') setPwErr('');
      setError('');
    };
  }

  /** After Google sign-in succeeds, user lands on dashboard directly */
  const handleGoogleSuccess = useCallback(async (idToken: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      const res = await authApi.googleLogin(idToken);
      const d = res.data;
      if (!d.tokens?.access_token) { setError('Google sign-in failed. Please try again.'); return; }
      setTokens(d.tokens.access_token, d.tokens.refresh_token);
      setSessionFromToken(d.tokens.access_token);
      const payload = parseJwtPayload(d.tokens.access_token);
      const session = payload ? payloadToSession(payload) : null;
      const role = session?.role ?? 'user';
      router.push(resolveHomePath(role));
    } catch (err) {
      if (err instanceof VelontriApiError) {
        setError(err.message);
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally { setGoogleLoading(false); }
  }, [router, setSessionFromToken]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const pwE = validatePassword(form.password);
    if (pwE) { setPwErr(pwE); return; }
    if (!/^\+[1-9]\d{6,14}$/.test(form.phone)) {
      setError('Phone must be E.164 format — e.g. +2348012345678');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({ ...form, country_code: form.country_code.toUpperCase() });
      const email = res.data?.email || form.email;
      router.push(`${ROUTES.verifyPhone}?user_id=${res.data.user_id}&email=${encodeURIComponent(email)}`);
    } catch (err) {
      if (err instanceof VelontriApiError) {
        setError(err.code === 'ALREADY_EXISTS' ? 'An account with this email or phone already exists.' : err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.75rem] font-black tracking-tight text-slate-900 leading-tight">
          Create your account
        </h1>
        <p className="mt-1.5 text-[14px] text-slate-500">
          Join millions of traders across Africa
        </p>
      </div>

      {/* Google Sign-Up */}
      <div>
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
            label="Sign up with Google"
            disabled={loading}
          />
        )}
      </div>

      <AuthDivider label="or sign up with email" />

      {/* Email registration form */}
      <form onSubmit={submit} className="space-y-4">
        {/* Full name */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-slate-700">Full name</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Ada Okonkwo" value={form.full_name}
              onChange={set('full_name')} required autoComplete="name"
              className={`${inputCls} pl-10`} />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-slate-700">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="email" placeholder="ada@example.com" value={form.email}
              onChange={set('email')} required autoComplete="email"
              className={`${inputCls} pl-10`} />
          </div>
        </div>

        {/* Country */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-slate-700">Country</label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select value={form.country_code} onChange={set('country_code')}
              className={`${inputCls} pl-10 appearance-none`}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-slate-700">
            Phone <span className="font-normal text-slate-400">(include country code)</span>
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="tel" placeholder="+2348012345678" value={form.phone}
              onChange={set('phone')} required autoComplete="tel"
              className={`${inputCls} pl-10`} />
          </div>
          <p className="text-[11px] text-slate-400">E.164 format — e.g. +234 for Nigeria, +233 for Ghana</p>
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="block text-[13px] font-semibold text-slate-700">Password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Min 8 chars with A-Z, a-z, 0-9, !@#"
              value={form.password}
              onChange={set('password')}
              required
              autoComplete="new-password"
              className={`${inputCls} pl-10 pr-11`}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {pwErr && <p className="text-[12px] text-red-500 font-medium mt-1">{pwErr}</p>}
          <PasswordStrength pw={form.password} />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-[13px] font-medium text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full h-12 rounded-xl bg-indigo-600 text-white text-[14px] font-bold
            shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.99]
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
              </svg>
              Creating account…
            </span>
          ) : 'Create free account'}
        </button>
      </form>

      <p className="text-center text-[14px] text-slate-500">
        Already have an account?{' '}
        <Link href={ROUTES.login} className="font-bold text-indigo-600 hover:underline no-underline">
          Sign in
        </Link>
      </p>

      <p className="text-center text-[12px] text-slate-400">
        By signing up you agree to our{' '}
        <Link href="/terms" className="hover:underline no-underline text-slate-500">Terms</Link>{' '}
        and{' '}
        <Link href="/privacy" className="hover:underline no-underline text-slate-500">Privacy Policy</Link>.
      </p>
    </div>
  );
}
