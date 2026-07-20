'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Users, BadgeCheck, ShieldOff, UserX } from 'lucide-react';
import { RoleGate } from '@/components/rbac/role-gate';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface AdminUser {
  id: string; email: string; phone: string; full_name: string;
  roles: string[]; is_active: boolean; is_phone_verified: boolean;
  country_code: string; created_at: string;
}

const ROLE_CHIP: Record<string, string> = {
  buyer:           'bg-blue-50 text-blue-700 border-blue-100',
  seller:          'bg-emerald-50 text-emerald-700 border-emerald-100',
  enterprise_admin:'bg-violet-50 text-violet-700 border-violet-100',
  moderator:       'bg-amber-50 text-amber-700 border-amber-100',
  ops:             'bg-slate-100 text-slate-600 border-slate-200',
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');
  const [page, setPage] = useState(1);
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

  const users = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;

  return (
    <RoleGate roles={['enterprise_admin', 'moderator', 'ops', 'super_admin']}      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
          <div className="text-center space-y-2">
            <ShieldOff className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-[15px] font-semibold text-slate-900">Access Denied</p>
            <p className="text-[13px] text-slate-400">You don&apos;t have permission to view this page.</p>
          </div>
        </div>
      }>
      
        <div className="space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Users</h1>
              <p className="text-[13px] text-slate-400 mt-0.5">
                {meta?.total != null ? `${meta.total.toLocaleString()} registered users` : 'Manage platform users'}
              </p>
            </div>

            {/* Search */}
            <form onSubmit={e => { e.preventDefault(); setCommitted(search); setPage(1); }}
              className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  placeholder="Search name, email, phone…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-10 w-64 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px]
                    text-slate-800 placeholder-slate-400 outline-none
                    focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <button type="submit"
                className="h-10 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white
                  hover:bg-indigo-700 transition-colors">
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
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-5 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-1/3 rounded-lg bg-slate-100 animate-pulse" />
                      <div className="h-3 w-1/2 rounded-lg bg-slate-100 animate-pulse" />
                    </div>
                    <div className="h-6 w-16 rounded-full bg-slate-100 animate-pulse" />
                  </div>
                ))}
              </div>
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
              {/* Column headers */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="hidden lg:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                  {['User', 'Contact', 'Roles', 'Status', 'Action'].map(h => (
                    <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
                  ))}
                </div>

                <ul className="divide-y divide-slate-100">
                  {users.map(user => (
                    <li key={user.id} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto_auto] gap-3 lg:gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors">
                      {/* User */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-slate-900">{user.full_name}</p>
                          <p className="text-[11px] text-slate-400">{user.country_code} · {new Date(user.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Contact */}
                      <div>
                        <p className="text-[13px] text-slate-700">{user.email}</p>
                        <p className="text-[11px] text-slate-400">{user.phone}</p>
                      </div>

                      {/* Roles */}
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map(r => (
                          <span key={r} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${ROLE_CHIP[r] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {r.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>

                      {/* Status */}
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${user.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {user.is_active ? 'Active' : 'Suspended'}
                      </span>

                      {/* Action */}
                      <button
                        onClick={() => toggle({ id: user.id, active: !user.is_active })}
                        className={`h-8 rounded-lg border px-3 text-[12px] font-semibold transition-all ${
                          user.is_active
                            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {user.is_active ? 'Suspend' : 'Restore'}
                      </button>
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
