'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, MagnifyingGlass, CheckCircle, XCircle, User, CaretLeft, CaretRight, Funnel } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface ModerationEntry {
  id: string;
  moderator_id: string;
  moderator_name: string;
  moderator_role: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_title: string;
  previous_state: string;
  new_state: string;
  reason: string;
  detail: string;
  created_at: string;
}

interface Moderator {
  moderator_id: string;
  moderator_name: string;
  action_count: number;
}

const ACTION_CLS: Record<string, string> = {
  LISTING_APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  LISTING_REJECTED: 'bg-red-50 text-red-700 border-red-100',
  LISTING_SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-100',
  USER_SUSPENDED: 'bg-red-50 text-red-700 border-red-100',
  USER_RESTORED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  KYC_APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  KYC_REJECTED: 'bg-red-50 text-red-700 border-red-100',
};

const ACTION_ICON: Record<string, typeof CheckCircle> = {
  LISTING_APPROVED: CheckCircle,
  LISTING_REJECTED: XCircle,
  USER_SUSPENDED: XCircle,
  USER_RESTORED: CheckCircle,
};

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
}

export default function AdminModerationPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');
  const [modFilter, setModFilter] = useState('');
  const PAGE_SIZE = 50;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'moderation-log', page, committed, modFilter],
    queryFn: () =>
      apiClient.get<ApiResponse<ModerationEntry[]>>('/admin/moderation-log', {
        params: {
          page,
          page_size: PAGE_SIZE,
          moderator_id: modFilter || undefined,
          action: committed || undefined,
        },
      }).then(r => r.data),
    staleTime: 15_000,
  });

  const { data: modsData } = useQuery({
    queryKey: ['admin', 'moderation-moderators'],
    queryFn: () =>
      apiClient.get<ApiResponse<Moderator[]>>('/admin/moderation-log/moderators').then(r => r.data),
    staleTime: 60_000,
  });

  const logs: ModerationEntry[] = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;
  const mods: Moderator[] = Array.isArray(modsData?.data) ? modsData.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-600" /> Moderation Pulse
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {meta?.total != null ? `${meta.total.toLocaleString()} actions recorded` : 'Every moderator action, permanently logged'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Moderator filter */}
        {mods.length > 0 && (
          <select
            value={modFilter}
            onChange={e => { setModFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-400 transition-all"
          >
            <option value="">All moderators</option>
            {mods.map(m => (
              <option key={m.moderator_id} value={m.moderator_id}>
                {m.moderator_name} ({m.action_count})
              </option>
            ))}
          </select>
        )}

        {/* Action search */}
        <form
          onSubmit={e => { e.preventDefault(); setCommitted(search); setPage(1); }}
          className="flex gap-2"
        >
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search action or listing…"
              className="h-9 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-[13px]
                text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 transition-all"
            />
          </div>
          <button type="submit"
            className="h-9 rounded-xl bg-indigo-600 px-4 text-[12px] font-bold text-white hover:bg-indigo-700 transition-colors">
            MagnifyingGlass
          </button>
          {(committed || modFilter) && (
            <button type="button"
              onClick={() => { setSearch(''); setCommitted(''); setModFilter(''); setPage(1); }}
              className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
              Clear
            </button>
          )}
        </form>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load moderation log</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Shield className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">No moderation actions yet</p>
          <p className="text-[13px] text-slate-400">
            Every listing approval, rejection, and user action will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
              {['Moderator', 'Action', 'Resource', 'Reason', 'Date'].map(h => (
                <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
              ))}
            </div>
            <ul className="divide-y divide-slate-100">
              {logs.map(log => {
                const ActionIcon = ACTION_ICON[log.action] ?? Shield;
                return (
                  <li key={log.id} className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-4 px-5 py-3.5 items-start hover:bg-slate-50 transition-colors">
                    {/* Moderator */}
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 uppercase">
                        {log.moderator_name?.charAt(0) ?? 'M'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{log.moderator_name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{log.moderator_role?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>

                    {/* Action */}
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${ACTION_CLS[log.action] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      <ActionIcon className="h-3 w-3" />
                      {log.action.replace(/_/g, ' ')}
                    </span>

                    {/* Resource */}
                    <div className="min-w-0 max-w-[180px]">
                      <p className="text-[12px] font-semibold text-slate-900 truncate">
                        {log.resource_title || log.resource_id.slice(0, 8) + '…'}
                      </p>
                      <p className="text-[10px] text-slate-400 capitalize">{log.resource_type}</p>
                    </div>

                    {/* Reason */}
                    <p className="text-[12px] text-slate-600 line-clamp-2">{log.reason || '—'}</p>

                    {/* Date */}
                    <p className="text-[11px] text-slate-400 whitespace-nowrap">{fmt(log.created_at)}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {logs.map(log => {
              const ActionIcon = ACTION_ICON[log.action] ?? Shield;
              return (
                <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                        {log.moderator_name?.charAt(0) ?? 'M'}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-slate-900">{log.moderator_name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{log.moderator_role?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${ACTION_CLS[log.action] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      <ActionIcon className="h-2.5 w-2.5" />
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {log.resource_title && (
                    <p className="text-[12px] font-semibold text-slate-700 truncate">{log.resource_title}</p>
                  )}
                  {log.reason && (
                    <p className="text-[12px] text-slate-500">{log.reason}</p>
                  )}
                  <p className="text-[11px] text-slate-400">{fmt(log.created_at)}</p>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <CaretLeft className="h-4 w-4" /> Prev
              </button>
              <span className="text-[13px] text-slate-500">{page} / {meta.total_pages}</span>
              <button disabled={page >= meta.total_pages} onClick={() => setPage(p => p + 1)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Next <CaretRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}