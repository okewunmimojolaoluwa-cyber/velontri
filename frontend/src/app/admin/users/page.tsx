'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlass, Users, ShieldSlash, ShieldCheck, ChatCircle, CheckCircle, WarningCircle, X, Trash, CalendarBlank, Phone, EnvelopeSimple, Globe } from '@phosphor-icons/react';
import { RoleGate } from '@/components/rbac/role-gate';
import { useAuth } from '@/features/auth/auth-provider';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface AdminUser {
  id: string; email: string; phone: string; full_name: string;
  roles: string[]; is_active: boolean; is_phone_verified: boolean;
  country_code: string; created_at: string;
}

const ROLE_CHIP: Record<string, string> = {
  buyer:            'bg-blue-50 text-blue-700 border-blue-100',
  seller:           'bg-emerald-50 text-emerald-700 border-emerald-100',
  enterprise_admin: 'bg-violet-50 text-violet-700 border-violet-100',
  moderator:        'bg-amber-50 text-amber-700 border-amber-100',
  ops:              'bg-slate-100 text-slate-600 border-slate-200',
};

function MessageModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [content, setContent] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const { mutate: send, isPending } = useMutation({
    mutationFn: () => apiClient.post(`/admin/users/${user.id}/message`, { content }),
    onSuccess: () => { setSent(true); setErr(''); },
    onError: (e: any) => setErr(e?.message || 'Failed to send message.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-[13px] font-bold text-indigo-700">
              {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-[15px] font-black text-slate-900">{user.full_name}</p>
              <p className="text-[12px] text-slate-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-[15px] font-bold text-slate-900">Message sent</p>
            <p className="text-[13px] text-slate-500">{user.full_name} will see it in their inbox.</p>
            <button onClick={onClose}
              className="mt-1 h-10 rounded-xl bg-indigo-600 px-6 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea value={content} onChange={e => { setContent(e.target.value); setErr(''); }}
              placeholder="Write your message to this user…" rows={4}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] text-slate-800
                placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none" />
            {err && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <WarningCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-[12px] font-medium text-red-600">{err}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => content.trim() && send()} disabled={isPending || !content.trim()}
                className="flex-1 h-10 rounded-xl bg-indigo-600 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {isPending ? 'Sending…' : 'PaperPlaneRight'}
              </button>
              <button onClick={onClose}
                className="h-10 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { session } = useAuth();
  const currentUserId = session?.userId;
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');
  const [page, setPage] = useState(1);
  const [msgUser, setMsgUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', { search: committed, page }],
    queryFn: () =>
      apiClient.get<ApiResponse<AdminUser[]>>('/users/admin/list', {
        params: { search: committed || undefined, page, page_size: 20 },
      }).then(r => r.data),
  });

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/users/admin/${id}`, { is_active: active }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const { mutate: deleteAccount, isPending: deleting } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/admin/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setDeleteUser(null); setDeleteConfirm(''); setDeleteErr(''); },
    onError: (e: any) => setDeleteErr(e?.response?.data?.error?.message || e?.message || 'Failed to delete user.'),
  });

  const users = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;

  return (
    <RoleGate
      roles={['enterprise_admin', 'moderator', 'ops', 'super_admin']}
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center space-y-2">
            <ShieldSlash className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-[15px] font-semibold text-slate-900">Access Denied</p>
            <p className="text-[13px] text-slate-400">You don&apos;t have permission to view this page.</p>
          </div>
        </div>
      }
    >
      {msgUser && <MessageModal user={msgUser} onClose={() => setMsgUser(null)} />}

      {/* Delete confirm modal */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 mb-4">
              <Trash className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-[16px] font-black text-slate-900 mb-1">Delete Account</h3>
            <p className="text-[13px] text-slate-500 mb-4 leading-relaxed">
              Permanently delete <strong>{deleteUser.full_name}</strong>. All their listings, messages and data will be lost. This cannot be undone.
            </p>
            <p className="text-[12px] font-semibold text-slate-700 mb-2">
              Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-red-600">DELETE</span> to confirm:
            </p>
            <input value={deleteConfirm} onChange={e => { setDeleteConfirm(e.target.value); setDeleteErr(''); }}
              placeholder="Type DELETE"
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 outline-none focus:border-red-400 transition-all mb-3" />
            {deleteErr && <p className="text-[12px] font-medium text-red-600 mb-3">{deleteErr}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setDeleteUser(null); setDeleteConfirm(''); setDeleteErr(''); }}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { if (deleteConfirm !== 'DELETE') { setDeleteErr('Type DELETE exactly to confirm.'); return; } deleteAccount(deleteUser.id); }}
                disabled={deleting || deleteConfirm !== 'DELETE'}
                className="flex-1 h-10 rounded-xl bg-red-600 text-[13px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-indigo-600" /> Users
            </h1>
            <p className="text-[13px] text-slate-400 mt-0.5">
              {meta?.total != null ? `${meta.total.toLocaleString()} registered users` : 'Manage platform users'}
            </p>
          </div>
          <form onSubmit={e => { e.preventDefault(); setCommitted(search); setPage(1); }} className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input placeholder="Search name, email, phone…" value={search} onChange={e => setSearch(e.target.value)}
                className="h-10 w-full sm:w-64 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px]
                  text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 transition-all" />
            </div>
            <button type="submit"
              className="h-10 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors">
              MagnifyingGlass
            </button>
          </form>
        </div>

        {isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load users</p>
            <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 animate-pulse">
                <div className="h-11 w-11 rounded-full bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-slate-100" /><div className="h-3 w-1/2 rounded bg-slate-100" /></div>
                <div className="h-8 w-20 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <Users className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-[15px] font-semibold text-slate-900 mb-1">
              {committed ? `No results for "${committed}"` : 'No users yet'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile: cards ── */}
            <div className="space-y-3 lg:hidden">
              {users.map(user => (
                <div key={user.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-start gap-3 p-4 pb-3">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                      user.roles.includes('enterprise_admin') ? 'bg-violet-100 text-violet-700'
                      : user.roles.includes('moderator') ? 'bg-amber-100 text-amber-700'
                      : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-bold text-slate-900 truncate">{user.full_name}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          user.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {user.is_active ? 'Active' : 'Suspended'}
                        </span>
                        {user.id === currentUserId && (
                          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">You</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(user.roles.length ? user.roles : ['user']).map(r => (
                          <span key={r} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${ROLE_CHIP[r] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {r.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[12px] text-slate-500">
                      <EnvelopeSimple className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-slate-500">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span>{user.phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-slate-500">
                      <Globe className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span>{user.country_code}</span>
                      <span className="text-slate-300">·</span>
                      <CalendarBlank className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span>{new Date(user.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                    {user.id !== currentUserId ? (
                      <button onClick={() => setMsgUser(user)}
                        className="flex flex-1 items-center justify-center gap-1.5 h-9 rounded-xl border border-indigo-200 bg-indigo-50 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors">
                        <ChatCircle className="h-3.5 w-3.5" /> Message
                      </button>
                    ) : <div className="flex-1" />}

                    {user.id !== currentUserId ? (
                      <button onClick={() => toggle({ id: user.id, active: !user.is_active })}
                        className={`flex flex-1 items-center justify-center gap-1.5 h-9 rounded-xl border text-[12px] font-semibold transition-all ${
                          user.is_active
                            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}>
                        {user.is_active ? <><ShieldSlash className="h-3.5 w-3.5" /> Suspend</> : <><ShieldCheck className="h-3.5 w-3.5" /> Restore</>}
                      </button>
                    ) : <div className="flex-1" />}

                    {user.id !== currentUserId && (
                      <button onClick={() => { setDeleteUser(user); setDeleteConfirm(''); setDeleteErr(''); }}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop: table ── */}
            <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                {['User', 'Contact', 'Roles', 'Status', 'Message', 'Action', ''].map(h => (
                  <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
                ))}
              </div>
              <ul className="divide-y divide-slate-100">
                {users.map(user => (
                  <li key={user.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        user.roles.includes('enterprise_admin') ? 'bg-violet-100 text-violet-700'
                        : user.roles.includes('moderator') ? 'bg-amber-100 text-amber-700'
                        : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-slate-900 truncate">{user.full_name}</p>
                        <p className="text-[11px] text-slate-400">{user.country_code} · {new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-slate-700 truncate">{user.email}</p>
                      <p className="text-[11px] text-slate-400">{user.phone || '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(user.roles.length ? user.roles : ['user']).map(r => (
                        <span key={r} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${ROLE_CHIP[r] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {r.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      user.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {user.is_active ? 'Active' : 'Suspended'}
                    </span>
                    {user.id !== currentUserId ? (
                      <button onClick={() => setMsgUser(user)}
                        className="flex items-center gap-1.5 h-8 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
                        <ChatCircle className="h-3.5 w-3.5" /> Message
                      </button>
                    ) : <span />}
                    {user.id === currentUserId ? (
                      <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-600">You</span>
                    ) : (
                      <button onClick={() => toggle({ id: user.id, active: !user.is_active })}
                        className={`h-8 rounded-lg border px-3 text-[12px] font-semibold transition-all ${
                          user.is_active ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}>
                        {user.is_active ? 'Suspend' : 'Restore'}
                      </button>
                    )}
                    {user.id !== currentUserId ? (
                      <button onClick={() => { setDeleteUser(user); setDeleteConfirm(''); setDeleteErr(''); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors">
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    ) : <span />}
                  </li>
                ))}
              </ul>
            </div>

            {meta && meta.total_pages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button disabled={!meta.has_prev} onClick={() => setPage(p => p - 1)}
                  className="h-9 rounded-xl border border-slate-200 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition-all">
                  Previous
                </button>
                <span className="px-3 text-[13px] text-slate-400">{meta.page} / {meta.total_pages}</span>
                <button disabled={!meta.has_next} onClick={() => setPage(p => p + 1)}
                  className="h-9 rounded-xl border border-slate-200 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition-all">
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGate>
  );
}