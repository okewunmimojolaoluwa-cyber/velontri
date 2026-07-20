'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Mail, Phone, Globe, Calendar, Camera, Loader2, CheckCircle2, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { usersApi, userKeys } from '@/lib/api/endpoints/users';
import type { ApiResponse } from '@/types/api';
import { useAuth } from '@/features/auth/auth-provider';

interface UserProfile {
  id: string; email: string; phone: string; full_name: string;
  country_code: string; avatar_url?: string;
  is_phone_verified: boolean; is_email_verified: boolean; created_at: string;
}

const inputCls =
  'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 ' +
  'placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white ' +
  'focus:ring-[3px] focus:ring-indigo-500/10 transition-all';

export default function UserProfilePage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session.userId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [edit, setEdit]           = useState(false);
  const [form, setForm]           = useState({ full_name: '', country_code: '' });
  const [msg, setMsg]             = useState('');
  const [err, setErr]             = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState('');

  /* ── Fetch profile ─────────────────────────────────────── */
  const { data, isLoading } = useQuery({
    queryKey: [uid, 'profile'],
    queryFn: () =>
      apiClient.get<ApiResponse<UserProfile>>('/users/me').then(r => r.data),
    enabled: session.isAuthenticated,
    staleTime: 2 * 60_000,
  });

  useEffect(() => {
    if (data?.data) {
      setForm({
        full_name:    data.data.full_name    ?? '',
        country_code: data.data.country_code ?? 'NG',
      });
    }
  }, [data]);

  /* ── Save profile text ─────────────────────────────────── */
  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      apiClient
        .patch<ApiResponse<UserProfile>>('/users/me', form)
        .then(r => r.data),
    onSuccess: () => {
      setMsg('Profile saved.');
      setEdit(false);
      setErr('');
      qc.invalidateQueries({ queryKey: [uid, 'profile'] });
      qc.invalidateQueries({ queryKey: userKeys.profile() });
      setTimeout(() => setMsg(''), 3000);
    },
    onError: (e: any) => {
      setErr(e?.response?.data?.error?.message ?? e?.message ?? 'Save failed.');
    },
  });

  /* ── Avatar upload ─────────────────────────────────────── */
  const { mutate: uploadAvatar, isPending: uploading } = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: (res) => {
      const url = res?.data?.avatar_url;
      if (url) setAvatarPreview(url);
      setUploadErr('');
      qc.invalidateQueries({ queryKey: [uid, 'profile'] });
      qc.invalidateQueries({ queryKey: userKeys.profile() });
    },
    onError: (e: any) => {
      setUploadErr(
        e?.response?.data?.error?.message ?? e?.message ?? 'Upload failed.'
      );
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadErr('Only JPEG, PNG or WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadErr('Image must be smaller than 5 MB.');
      return;
    }

    setUploadErr('');

    // Show instant local preview while uploading
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    uploadAvatar(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  const profile   = data?.data;
  const avatarUrl = avatarPreview ?? profile?.avatar_url;
  const initials  = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'VL';

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Profile</h1>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : profile ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Gradient banner */}
          <div className="h-20 bg-gradient-to-r from-indigo-500 to-violet-600" />

          <div className="-mt-10 px-6 pb-6 pt-0">
            <div className="flex items-end gap-3 mb-5">

              {/* Avatar + upload button */}
              <div className="relative flex-shrink-0">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Avatar circle */}
                <div className="h-[68px] w-[68px] rounded-2xl border-4 border-white bg-white shadow-lg overflow-hidden">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-indigo-50 text-xl font-black text-indigo-600">
                      {initials}
                    </div>
                  )}
                </div>

                {/* Camera button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Change profile photo"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center
                    rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700
                    disabled:opacity-60 transition-all active:scale-95"
                >
                  {uploading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Camera className="h-3.5 w-3.5" />
                  }
                </button>
              </div>

              {/* Name + role (view mode) */}
              {!edit && (
                <div className="mb-1 min-w-0">
                  <p className="text-[16px] font-black text-slate-900 truncate">
                    {profile.full_name}
                  </p>
                  <p className="text-[12px] text-slate-400">Velontri User</p>
                </div>
              )}
            </div>

            {/* Upload error */}
            {uploadErr && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5">
                <X className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-[13px] text-red-600">{uploadErr}</p>
              </div>
            )}

            {/* Upload success hint */}
            {uploading && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5">
                <Loader2 className="h-4 w-4 text-indigo-500 animate-spin flex-shrink-0" />
                <p className="text-[13px] text-indigo-600">Uploading photo…</p>
              </div>
            )}

            {/* ── Edit form ─────────────────────────────── */}
            {edit ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">
                    Full name
                  </label>
                  <input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className={inputCls}
                    placeholder="Your full name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">
                    Country code
                  </label>
                  <input
                    value={form.country_code}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        country_code: e.target.value.toUpperCase().slice(0, 2),
                      }))
                    }
                    maxLength={2}
                    className={inputCls}
                    placeholder="NG"
                  />
                </div>
                {err && <p className="text-[12px] text-red-500">{err}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => save()}
                    disabled={saving}
                    className="h-11 rounded-xl bg-indigo-600 px-6 text-[14px] font-bold text-white
                      hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => { setEdit(false); setErr(''); }}
                    className="h-11 rounded-xl border border-slate-200 px-6 text-[14px] font-semibold
                      text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── View mode ────────────────────────────── */
              <div className="space-y-3">
                {[
                  {
                    icon: Mail,
                    label: 'Email',
                    value: profile.email,
                    verified: profile.is_email_verified,
                  },
                  {
                    icon: Phone,
                    label: 'Phone',
                    value: profile.phone,
                    verified: profile.is_phone_verified,
                  },
                  {
                    icon: Globe,
                    label: 'Country',
                    value: profile.country_code,
                    verified: null,
                  },
                  {
                    icon: Calendar,
                    label: 'Joined',
                    value: new Date(profile.created_at).toLocaleDateString('en-NG', {
                      month: 'long',
                      year: 'numeric',
                    }),
                    verified: null,
                  },
                ].map(({ icon: Icon, label, value, verified }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {label}
                      </p>
                      <p className="text-[14px] text-slate-900 font-medium truncate">
                        {value}
                      </p>
                    </div>
                    {verified === true && (
                      <BadgeCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    )}
                    {verified === false && (
                      <span className="text-[11px] font-semibold text-amber-500">
                        Unverified
                      </span>
                    )}
                  </div>
                ))}

                {msg && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <p className="text-[13px] font-semibold text-emerald-600">{msg}</p>
                  </div>
                )}

                <button
                  onClick={() => setEdit(true)}
                  className="h-11 w-full rounded-xl border border-slate-200 text-[14px] font-semibold
                    text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Edit profile
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[14px] text-slate-400">Profile unavailable.</p>
      )}
    </div>
  );
}
