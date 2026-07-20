'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Search, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface VerifiedUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country_code: string;
  created_at: string;
}

/* ── Avatar initials ─────────────────────────────────────── */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full
      bg-indigo-100 text-[12px] font-bold text-indigo-700 ring-2 ring-white">
      {initials}
    </div>
  );
}

/* ── Mobile card ─────────────────────────────────────────── */
function UserCard({ u }: { u: VerifiedUser }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      {/* Top row: avatar + name + badge */}
      <div className="flex items-center gap-3">
        <Avatar name={u.full_name} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-900 truncate">{u.full_name || '—'}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border
            border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            <BadgeCheck className="h-3 w-3" /> Verified
          </span>
        </div>
      </div>

      {/* Detail rows */}
      <div className="space-y-1.5 text-[12px] text-slate-600">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{u.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span>{u.phone || '—'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {u.country_code || '—'}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {new Date(u.created_at).toLocaleDateString('en-NG', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function VerifiedUsersPage() {
  const [search, setSearch]       = useState('');
  const [committed, setCommitted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'verified-users', committed],
    queryFn: () =>
      apiClient
        .get<ApiResponse<VerifiedUser[]>>('/users/admin/list', {
          params: { search: committed || undefined, kyc_verified: true, page_size: 50 },
        })
        .then(r => r.data),
  });

  const users: VerifiedUser[] = data?.data ?? [];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-emerald-600 flex-shrink-0" />
            Verified Users
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">KYC-verified accounts on the platform</p>
        </div>

        {/* Search */}
        <form
          onSubmit={e => { e.preventDefault(); setCommitted(search); }}
          className="flex gap-2 w-full sm:w-auto"
        >
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 w-full sm:w-56 rounded-xl border border-slate-200 pl-9 pr-4
                text-[13px] text-slate-800 placeholder-slate-400 focus:border-indigo-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold
              text-white hover:bg-indigo-700 transition-colors flex-shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* Count */}
      {!isLoading && users.length > 0 && (
        <p className="text-[12px] text-slate-400">
          {users.length} verified user{users.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <>
          {/* Mobile skeleton */}
          <div className="space-y-3 lg:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </>
      )}

      {/* Empty */}
      {!isLoading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center
          rounded-2xl border-2 border-dashed border-slate-200 bg-white">
          <BadgeCheck className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">No verified users found</p>
          <p className="text-[12px] text-slate-400">
            {committed ? `No results for "${committed}"` : 'Verified users will appear here'}
          </p>
        </div>
      )}

      {/* ── Mobile: card list (< lg) ──────────────────────── */}
      {!isLoading && users.length > 0 && (
        <div className="space-y-3 lg:hidden">
          {users.map(u => <UserCard key={u.id} u={u} />)}
        </div>
      )}

      {/* ── Desktop: table (≥ lg) ─────────────────────────── */}
      {!isLoading && users.length > 0 && (
        <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['User', 'Email', 'Phone', 'Country', 'KYC Level', 'Joined'].map(h => (
                  <th key={h}
                    className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} />
                      <span className="text-[13px] font-semibold text-slate-900 truncate max-w-[140px]">
                        {u.full_name || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-slate-600 max-w-[180px] truncate">
                    {u.email}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-slate-600">{u.phone || '—'}</td>
                  <td className="px-5 py-3.5 text-[13px] text-slate-600">{u.country_code || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50
                      border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[12px] text-slate-500">
                    {new Date(u.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
