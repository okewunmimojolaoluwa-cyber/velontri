'use client';

import { useState } from 'react';
import { MagnifyingGlass, Users, ShieldSlash, ShieldCheck, ChatCircle, CheckCircle, WarningCircle, X, CalendarBlank, Phone, EnvelopeSimple, Globe } from '@phosphor-icons/react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface AdminUser {
  id: string; email: string; phone: string; full_name: string;
  roles: string[]; is_active: boolean; is_phone_verified: boolean;
  country_code: string; created_at: string;
}

const ROLE_CHIP: Record<string, string> = {
  moderator:        'bg-amber-50 text-amber-700 border-amber-100',
  enterprise_admin: 'bg-violet-50 text-violet-700 border-violet-100',
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-[13px] font-bold text-amber-700">
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
            <button onClick={onClose} className="mt-1 h-10 rounded-xl bg-amber-500 px-6 text-[13px] font-bold text-white hover:bg-amber-600 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={content}
              onChange={e => { setContent(e.target.value); setErr(''); }}
              placeholder="Write your message to this user…"
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] text-slate-800
                placeholder-slate-400 focus:border-amber-400 focus:outline-none
                focus:ring-2 focus:ring-amber-500/10 resize-none transition-all"
            />
            {err && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <WarningCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-[12px] font-medium text-red-600">{err}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => content.trim() && send()} disabled={isPending || !content.trim()}
                className="flex-1 h-10 rounded-xl bg-amber-500 text-[13px] font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-50">
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

export default function ModUsersPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');
  const [msgUser, setMsgUser] = useState<AdminUser | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mod', 'users', { search: committed }],
    queryFn: () =>
      apiClient.get<ApiResponse<AdminUser[]>>('/users/admin/list', {
        params: { search: committed || undefined, page_size: 50 },
      }).then(r => r.data),
    enabled: session.isAuthenticated,
  });

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/users/admin/${id}`, { is_active: active }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['mod', 'users'] }); refetch(); },
  });

  const allUsers: AdminUser[] = Array.isArray(data?.data) ? data.data : [];
  // Never show enterprise_admin or super_admin to moderators — backend filters
  // these too, but this is a client-side safety net
  const visibleUsers = allUsers.filter(u =>
    !u.roles.includes('enterprise_admin') && !u.roles.includes('super_admin')
  );
  const users = visibleUsers.filter(u => {
    if (filter === 'active') return u.is_active;
    if (filter === 'suspended') return !u.is_active;
    return true;
  });

  function canActOn(user: AdminUser): boolean {
    if (user.id === session.userId) return false;
    if (user.roles.includes('moderator')) return false;
    if (user.roles.includes('enterprise_admin')) return false;
    return true;
  }

  const counts = {
    all: visibleUsers.length,
    active: visibleUsers.filter(u => u.is_active).length,
    suspended: visibleUsers.filter(u => !u.is_active).length,
  };

  return (
    <div className="space-y-5">
      {msgUser && <MessageModal user={msgUser} onClose={() => setMsgUser(null)} />}

      {/* Header */}
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-amber-500" /> User Management
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {visibleUsers.length} registered user{visibleUsers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Funnel pills */}
        <div className="flex gap-1.5">
          {(['all', 'active', 'suspended'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
                filter === s
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                  : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
              }`}>
              {s}
              {s !== 'all' && counts[s] > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === s ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{counts[s]}</span>
              )}
            </button>
          ))}
        </div>
        {/* MagnifyingGlass */}
        <form onSubmit={e => { e.preventDefault(); setCommitted(search); }} className="flex gap-2 sm:ml-auto">
          <div className="relative flex-1 sm:flex-none">
            <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="MagnifyingGlass name, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full sm:w-52 rounded-xl border border-slate-200 bg-white pl-10 pr-4
                text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-amber-400 transition-all"
            />
          </div>
          <button type="submit"
            className="h-9 rounded-xl bg-amber-500 px-4 text-[12px] font-bold text-white hover:bg-amber-600 transition-colors">
            MagnifyingGlass
          </button>
        </form>
      </div>

      {/* Error */}
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
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-slate-100" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
              <div className="h-7 w-20 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Users className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">
            {committed ? `No results for "${committed}"` : `No ${filter !== 'all' ? filter : ''} users`}
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile: card list ── */}
          <div className="space-y-3 lg:hidden">
            {users.map(user => (
              <div key={user.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-start gap-3 p-4 pb-3">
                  <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                    user.roles.includes('enterprise_admin') ? 'bg-violet-100 text-violet-700'
                    : user.roles.includes('moderator') ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
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
                      {user.id === session.userId && (
                        <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">You</span>
                      )}
                    </div>
                    {/* Roles */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(user.roles.length ? user.roles : ['user']).map(r => (
                        <span key={r} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          ROLE_CHIP[r] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {r.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div className="px-4 pb-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <EnvelopeSimple className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span>{user.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <Globe className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span>{user.country_code}</span>
                    <span className="text-slate-300">·</span>
                    <CalendarBlank className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span>{new Date(user.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                  {user.id !== session.userId && !user.roles.includes('enterprise_admin') ? (
                    <button
                      onClick={() => setMsgUser(user)}
                      className="flex flex-1 items-center justify-center gap-1.5 h-9 rounded-xl border border-amber-200 bg-amber-50
                        text-[12px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <ChatCircle className="h-3.5 w-3.5" /> Message
                    </button>
                  ) : <div className="flex-1" />}
                  <button
                    disabled={!canActOn(user)}
                    onClick={() => canActOn(user) && toggle({ id: user.id, active: !user.is_active })}
                    className={`flex flex-1 items-center justify-center gap-1.5 h-9 rounded-xl border text-[12px] font-semibold transition-all ${
                      !canActOn(user) ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : user.is_active
                        ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {user.id === session.userId ? 'You'
                      : user.roles.includes('moderator') ? 'Mod'
                      : user.is_active
                      ? <><ShieldSlash className="h-3.5 w-3.5" /> Suspend</>
                      : <><ShieldCheck className="h-3.5 w-3.5" /> Restore</>}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop: table ── */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
              {['User', 'Contact', 'Roles', 'Status', 'Message', 'Action'].map(h => (
                <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
              ))}
            </div>
            <ul className="divide-y divide-slate-100">
              {users.map(user => (
                <li key={user.id}
                  className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                      user.roles.includes('enterprise_admin') ? 'bg-violet-100 text-violet-700'
                      : user.roles.includes('moderator') ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>
                      {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-slate-900 truncate">{user.full_name}</p>
                      <p className="text-[11px] text-slate-400">{user.country_code} · {new Date(user.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] text-slate-700 truncate">{user.email}</p>
                    <p className="text-[11px] text-slate-400">{user.phone}</p>
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
                  {user.id !== session.userId && !user.roles.includes('enterprise_admin') ? (
                    <button onClick={() => setMsgUser(user)}
                      className="flex items-center gap-1.5 h-8 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                      <ChatCircle className="h-3.5 w-3.5" /> Message
                    </button>
                  ) : <span />}
                  <button
                    disabled={!canActOn(user)}
                    onClick={() => canActOn(user) && toggle({ id: user.id, active: !user.is_active })}
                    className={`flex items-center gap-1 h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-all ${
                      !canActOn(user) ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : user.is_active ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}>
                    {user.id === session.userId ? 'You'
                      : user.roles.includes('moderator') ? 'Mod'
                      : user.is_active ? <><ShieldSlash className="h-3 w-3" /> Suspend</>
                      : <><ShieldCheck className="h-3 w-3" /> Restore</>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}