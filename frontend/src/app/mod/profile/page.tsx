'use client';

import { useState, useEffect } from 'react';
import { User, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface ModProfile {
  id: string;
  full_name: string;
  email: string;
  actions_count?: number;
  created_at?: string;
}

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-500/10 transition-all';

export default function ModProfilePage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '' });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['mod-profile'],
    queryFn: () =>
      apiClient.get<ApiResponse<ModProfile>>('/mod/profile').then((r) => r.data),
    enabled: session.isAuthenticated,
    retry: false,
  });

  const profile = profileData?.data;

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '' });
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.put('/mod/profile', data),
    onSuccess: () => {
      setMessage('Profile updated successfully.');
      setIsError(false);
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ['mod-profile'] });
      setTimeout(() => setMessage(''), 4000);
    },
    onError: (err: any) => {
      setMessage(err?.message || 'Failed to update profile.');
      setIsError(true);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <User className="h-5 w-5 text-amber-500" /> Moderator Profile
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Manage your moderator account</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="h-9 rounded-xl bg-amber-500 px-4 text-[13px] font-bold text-white hover:bg-amber-600 transition-colors"
          >
            PencilSimple Profile
          </button>
        )}
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${
          isError ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
        }`}>
          {isError
            ? <WarningCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            : <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
          <p className={`text-[13px] font-medium ${isError ? 'text-red-600' : 'text-emerald-700'}`}>
            {message}
          </p>
        </div>
      )}

      {isEditing ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">PencilSimple Profile</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Full Name</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ full_name: e.target.value })}
                placeholder="Your full name"
                className={inputCls}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Email</label>
              <input
                value={profile?.email || ''}
                disabled
                className={`${inputCls} opacity-60 cursor-not-allowed`}
              />
              <p className="text-[11px] text-slate-400">Email cannot be changed</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending || !form.full_name.trim()}
                className="h-10 rounded-xl bg-amber-500 px-5 text-[13px] font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'FloppyDisk Changes'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="h-10 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6 flex items-center gap-5">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[28px] font-black text-amber-700">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[20px] font-black text-slate-900">{profile?.full_name || 'Moderator'}</p>
              <p className="text-[13px] text-slate-500 mt-0.5">{profile?.email}</p>
              <span className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-3 py-0.5 text-[11px] font-bold text-amber-700">
                Moderator
              </span>
            </div>
          </div>
          <div className="border-t border-slate-100 px-6 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Status</p>
              <p className="text-[13px] font-semibold text-emerald-600 mt-0.5">Active</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Actions Taken</p>
              <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{profile?.actions_count ?? 0}</p>
            </div>
            {profile?.created_at && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Member Since</p>
                <p className="text-[13px] font-semibold text-slate-900 mt-0.5">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}