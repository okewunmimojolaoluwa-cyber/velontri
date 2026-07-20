'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Shield, Trash2, Lock, CheckSquare, Square,
  Eye, EyeOff, Mail, Phone, User, AlertCircle, CheckCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Moderator {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  roles: string[];
}

const ALL_PERMISSIONS = [
  { key: 'can_approve_listings',   label: 'Approve Listings' },
  { key: 'can_reject_listings',    label: 'Reject Listings' },
  { key: 'can_review_kyc',         label: 'Review KYC' },
  { key: 'can_handle_reports',     label: 'Handle Reports' },
  { key: 'can_moderate_users',     label: 'Moderate Users' },
  { key: 'can_moderate_stores',    label: 'Moderate Stores' },
  { key: 'can_reply_tickets',      label: 'Reply to Tickets' },
  { key: 'can_send_notifications', label: 'Send Notifications' },
  { key: 'can_handle_disputes',    label: 'Handle Disputes' },
];

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all';

export default function ModeratorsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newMod, setNewMod] = useState({
    full_name: '', email: '', phone: '', password: '', country_code: 'NG',
  });
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);

  /* ── Fetch real moderators from DB ────────────────── */
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'moderators'],
    queryFn: async (): Promise<Moderator[]> => {
      const res = await apiClient.get<ApiResponse<Moderator[]>>('/users/admin/list', {
        params: { page_size: 50 },
      });
      const users = Array.isArray(res.data?.data) ? res.data.data : [];
      // Filter to only users with moderator role — exclude enterprise_admin (that's the owner/super admin)
      return users.filter((u: any) =>
        Array.isArray(u.roles) && u.roles.includes('moderator') && !u.roles.includes('enterprise_admin')
      );
    },
    staleTime: 0,  // always refetch when invalidated
    refetchOnWindowFocus: true,
  });

  /* ── Create moderator ──────────────────────────────── */
  const { mutate: createMod, isPending: creating } = useMutation({
    mutationFn: () =>
      apiClient.post('/users/admin/moderators', {
        full_name: newMod.full_name.trim(),
        email: newMod.email.trim(),
        phone: newMod.phone.trim(),
        password: newMod.password,
        country_code: newMod.country_code,
        role: 'moderator',
      }),
    onSuccess: (res: any) => {
      // Check if backend returned an error inside a 200 response
      const backendData = res?.data?.data;
      if (backendData?.error) {
        setCreateError(backendData.error);
        return;
      }
      setCreateSuccess(`Moderator ${newMod.full_name} created successfully.`);
      setNewMod({ full_name: '', email: '', phone: '', password: '', country_code: 'NG' });
      setSelectedPerms([]);
      setShowCreate(false);
      // Refetch with a small delay to allow the backend DB to commit
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['admin', 'moderators'] });
        refetch();
      }, 500);
      setTimeout(() => setCreateSuccess(''), 5000);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to create moderator.';
      setCreateError(msg);
    },
  });

  /* ── Toggle suspend/restore ────────────────────────── */
  const { mutate: toggleStatus } = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/users/admin/${id}`, { is_active: active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'moderators'] });
      refetch();
    },
  });

  /* ── Delete moderator ──────────────────────────────── */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { mutate: deleteMod, isPending: deleting } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/admin/${id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ['admin', 'moderators'] });
      refetch();
    },
    onError: () => setConfirmDelete(null),
  });

  const mods = data ?? [];

  function togglePerm(key: string) {
    setSelectedPerms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');

    // Frontend validation — catches common errors before the network call
    const phoneRe = /^\+[1-9]\d{6,14}$/;
    if (!phoneRe.test(newMod.phone)) {
      setCreateError('Phone must be in E.164 format, e.g. +2348012345678');
      return;
    }

    const pwRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_+=\[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!pwRe.test(newMod.password)) {
      setCreateError('Password must have uppercase, lowercase, number and special character (e.g. Mod@12345)');
      return;
    }

    createMod();
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Moderators</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Create and manage moderator accounts. Only you can do this.
          </p>
        </div>
        <button onClick={() => { setShowCreate(v => !v); setCreateError(''); }}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5
            text-[13px] font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors">
          <UserPlus className="h-4 w-4" />
          Create moderator
        </button>
      </div>

      {/* Success banner */}
      {createSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-emerald-700">{createSuccess}</p>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-indigo-50/50 px-6 py-4">
            <Shield className="h-4 w-4 text-indigo-600" />
            <h2 className="text-[15px] font-bold text-slate-900">New Moderator Account</h2>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-700">Full name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="e.g. Bimpe Adeleke" value={newMod.full_name}
                    onChange={e => setNewMod(p => ({ ...p, full_name: e.target.value }))}
                    required className={`${inputCls} pl-10`} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-700">Email <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="email" placeholder="mod@velontri.com" value={newMod.email}
                    onChange={e => setNewMod(p => ({ ...p, email: e.target.value }))}
                    required className={`${inputCls} pl-10`} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-700">Phone <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="tel" placeholder="+2348012345678" value={newMod.phone}
                    onChange={e => setNewMod(p => ({ ...p, phone: e.target.value }))}
                    required className={`${inputCls} pl-10`} />
                </div>
                <p className="text-[11px] text-slate-400">E.164 format: +countrycode + number (e.g. +2348012345678)</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-700">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} placeholder="e.g. Moderator@2024"
                    value={newMod.password}
                    onChange={e => setNewMod(p => ({ ...p, password: e.target.value }))}
                    required minLength={8} className={`${inputCls} pr-11`} />
                  <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Must have: uppercase (A-Z), lowercase (a-z), number (0-9), special char (@#!$%^&*). Example: <strong className="text-slate-500">Mod@12345</strong>
                </p>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-semibold text-slate-700">Permissions</label>
                <div className="flex gap-3">
                  <button type="button"
                    onClick={() => setSelectedPerms(ALL_PERMISSIONS.map(p => p.key))}
                    className="text-[12px] font-semibold text-indigo-600 hover:underline">
                    Select all
                  </button>
                  <button type="button"
                    onClick={() => setSelectedPerms([])}
                    className="text-[12px] font-semibold text-slate-400 hover:underline">
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ALL_PERMISSIONS.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => togglePerm(key)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-all ${
                      selectedPerms.includes(key)
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}>
                    {selectedPerms.includes(key)
                      ? <CheckSquare className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                      : <Square className="h-4 w-4 text-slate-300 flex-shrink-0" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {createError && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-[13px] font-medium text-red-600">{createError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={creating}
                className="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6
                  text-[14px] font-bold text-white hover:bg-indigo-700 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                      strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                  </svg>
                ) : <UserPlus className="h-4 w-4" />}
                {creating ? 'Creating…' : 'Create moderator'}
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(''); }}
                className="h-11 rounded-xl border border-slate-200 px-6 text-[14px] font-semibold
                  text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Moderators list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-bold text-slate-900">
            Moderators
            <span className="ml-2 text-[13px] font-normal text-slate-400">
              ({isLoading ? '…' : mods.length})
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded-lg bg-slate-100" />
                  <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-[14px] font-semibold text-red-600 mb-2">Failed to load moderators</p>
            <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-500 hover:underline">
              Try again
            </button>
          </div>
        ) : mods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-4">
              <Shield className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-[15px] font-semibold text-slate-900 mb-1">No moderators yet</p>
            <p className="text-[13px] text-slate-400 mb-4">
              Create your first moderator account to start delegating platform management.
            </p>
            <button onClick={() => setShowCreate(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4
                text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors">
              <UserPlus className="h-3.5 w-3.5" /> Create moderator
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {mods.map(mod => (
              <div key={mod.id} className="flex items-start gap-4 px-5 py-5 hover:bg-slate-50 transition-colors">
                {/* Avatar */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full
                  bg-indigo-100 text-[13px] font-bold text-indigo-700 uppercase">
                  {mod.full_name?.charAt(0) ?? '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-semibold text-slate-900">{mod.full_name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      mod.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {mod.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 mt-0.5">{mod.email}</p>
                  {mod.phone && (
                    <p className="text-[11px] text-slate-400">{mod.phone}</p>
                  )}
                  <p className="text-[11px] text-slate-300 mt-1">
                    Added {new Date(mod.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleStatus({ id: mod.id, active: !mod.is_active })}
                    className={`h-8 rounded-lg border px-3 text-[12px] font-semibold transition-all ${
                      mod.is_active
                        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}>
                    {mod.is_active ? 'Suspend' : 'Restore'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(mod.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200
                      text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all"
                    title="Delete moderator">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-[16px] font-black text-slate-900 mb-1">Delete moderator?</h3>
            <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
              This will permanently remove the moderator account and revoke all access.
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-[13px]
                  font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMod(confirmDelete)}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl bg-red-600 text-[13px] font-bold text-white
                  hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
