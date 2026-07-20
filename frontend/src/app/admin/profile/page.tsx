'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { usersApi, userKeys } from '@/lib/api/endpoints/users';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Crown, Shield, CheckCircle } from 'lucide-react';

export default function AdminProfilePage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [err,   setErr]   = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    country_code: 'NG',
  });

  /* Load real profile */
  const { data: profileData, isLoading } = useQuery({
    queryKey: userKeys.profile(),
    queryFn: () => usersApi.getProfile(),
    enabled: !!session.isAuthenticated,
    staleTime: 60_000,
  });

  useEffect(() => {
    const p = profileData?.data;
    if (p) {
      setForm({
        full_name:    p.full_name    || '',
        email:        p.email        || '',
        phone:        p.phone        || '',
        country_code: p.country_code || 'NG',
      });
    }
  }, [profileData]);

  const { mutate: update, isPending } = useMutation({
    /* Use /users/me — the correct authenticated profile endpoint */
    mutationFn: (d: typeof form) =>
      apiClient.patch('/users/me', d).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.profile() });
      setSaved(true);
      setErr('');
      setTimeout(() => setSaved(false), 4000);
    },
    onError: (e: any) => {
      setErr(e?.response?.data?.error?.message || e?.message || 'Failed to save.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    update(form);
  }

  const initials = form.full_name
    ? form.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SA';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your business owner account details</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-emerald-700">Profile updated successfully</p>
        </div>
      )}
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[13px] font-medium text-red-600">{err}</p>
        </div>
      )}

      <div className="flex items-start gap-6 flex-wrap">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-600
            text-2xl font-black text-white ring-4 ring-indigo-100">
            {initials}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 border
              border-indigo-100 px-3 py-1 text-[11px] font-bold text-indigo-700">
              <Crown className="h-3 w-3" /> Super Admin
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border
              border-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <Shield className="h-3 w-3" /> Business Owner
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}
          className="flex-1 min-w-[280px] bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-24 rounded bg-slate-100 mb-2" />
                  <div className="h-11 rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Full Name</label>
                <Input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@velontri.com"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Phone</label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+2348000000000"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Country Code</label>
                <Input
                  value={form.country_code}
                  onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase().slice(0, 2) }))}
                  placeholder="NG"
                  maxLength={2}
                />
              </div>
            </>
          )}

          <Button type="submit" disabled={isPending || isLoading} className="w-full">
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      </div>
    </div>
  );
}
