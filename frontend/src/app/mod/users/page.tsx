'use client';

import { useState } from 'react';
import { Search, Users, ShieldOff, ShieldCheck, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface AdminUser {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
  is_phone_verified: boolean;
  country_code: string;
  created_at: string;
}

const ROLE_CHIP: Record<string, string> = {
  moderator:       'bg-amber-50 text-amber-700 border-amber-100',
  enterprise_admin:'bg-violet-50 text-violet-700 border-violet-100',
};

export default function ModUsersPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');

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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['mod', 'users'] });
      refetch();
    },
  });

  const allUsers: AdminUser[] = Array.isArray(data?.data) ? data.data : [];

  // Apply status filter client-side
  const users = allUsers.filter(u => {
    if (filter === 'active') return u.is_active;
    if (filter === 'suspended') return !u.is_active;
    return true;
  });

  // Helper: can the logged-in moderator act on this user?
  // Moderators cannot suspend themselves or other moderators
  function canActOn(user: AdminUser): boolean {
    if (user.id === session.userId) return false; // can't suspend self
    if (user.roles.includes('moderator')) return false; // can't suspend other mods
    if (user.roles.includes('enterprise_admin')) return false; // can't touch admin
    return true;
  }

  const counts = {
    all: allUsers.length,
    active: allUsers.filter(u => u.is_active).length,
    suspended: allUsers.filter(u => !u.is_active).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">User Management</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">View and manage platform users</p>
      </div>

      {/* Filter + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(['all', 'active', 'suspended'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
                filter === s
                  ? 'bg-amber-500 text-white'
                  : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
              }`}>
              {s}
              {s !== 'all' && counts[s] > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === s ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); setCommitted(search); }}
          className="flex gap-2 ml-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="Search name, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-52 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px]
                text-slate-800 placeholder-slate-400 outline-none focus:border-amber-400 transition-all"
            />
          </div>
          <button type="submit"
            className="h-9 rounded-xl bg-amber-500 px-4 text-[12px] font-bold text-white hover:bg-amber-600 transition-colors">
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load users</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-slate-100" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Users className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">
            {committed ? `No results for "${committed}"` : `No ${filter !== 'all' ? filter : ''} users`}
          </p>
          <p className="text-[12px] text-slate-400">
            {filter !== 'all' ? 'Try a different filter.' : 'Users will appear here once they register.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden lg:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            {['User', 'Contact', 'Roles', 'Status', 'Action'].map(h => (
              <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
            ))}
          </div>
          <ul className="divide-y divide-slate-100">
            {users.map(user => (
              <li key={user.id}
                className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto_auto] gap-3 lg:gap-4
                  px-5 py-4 items-center hover:bg-slate-50 transition-colors">
                {/* User */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full
                    bg-amber-100 text-[12px] font-bold text-amber-700">
                    {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">{user.full_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {user.country_code} · {new Date(user.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {/* Contact */}
                <div>
                  <p className="text-[13px] text-slate-700 truncate">{user.email}</p>
                  <p className="text-[11px] text-slate-400">{user.phone}</p>
                </div>
                {/* Roles */}
                <div className="flex flex-wrap gap-1">
                  {(user.roles.length ? user.roles : ['user']).map(r => (
                    <span key={r} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                      ROLE_CHIP[r] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {r.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                {/* Status */}
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  user.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-red-50 text-red-700 border-red-100'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {user.is_active ? 'Active' : 'Suspended'}
                </span>
                {/* Action */}
                <button
                  disabled={!canActOn(user)}
                  onClick={() => canActOn(user) && toggle({ id: user.id, active: !user.is_active })}
                  title={!canActOn(user) ? 'Cannot suspend moderators or yourself' : undefined}
                  className={`flex items-center gap-1 h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-all ${
                    !canActOn(user)
                      ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                      : user.is_active
                      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}>
                  {user.id === session.userId
                    ? 'You'
                    : user.roles.includes('moderator')
                    ? 'Mod'
                    : user.is_active
                    ? <><ShieldOff className="h-3 w-3" /> Suspend</>
                    : <><ShieldCheck className="h-3 w-3" /> Restore</>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
