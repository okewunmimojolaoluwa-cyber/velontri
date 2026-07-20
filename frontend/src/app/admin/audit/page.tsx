'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList, Search, User, Shield, Settings, Cpu,
  CheckCircle, XCircle, Calendar, ChevronLeft, ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

/* ── Types ───────────────────────────────────────────────── */
interface AuditEntry {
  id: string;
  timestamp: string;
  actor_id: string;
  user_name: string;
  user_email: string;
  category: 'user' | 'admin' | 'system';
  action: string;
  resource: string;
  resource_id: string;
  ip_address: string;
  status: 'success' | 'failed';
  detail: string;
}

/* ── Config ──────────────────────────────────────────────── */
type FilterType = 'all' | 'user' | 'admin' | 'system';

const FILTERS: { id: FilterType; label: string; icon: typeof User }[] = [
  { id: 'all',    label: 'All',    icon: ClipboardList },
  { id: 'user',   label: 'Users',  icon: User          },
  { id: 'admin',  label: 'Admin',  icon: Shield        },
  { id: 'system', label: 'System', icon: Cpu           },
];

const CATEGORY_COLOR: Record<string, string> = {
  user:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  admin:  'bg-violet-50 text-violet-700 border-violet-200',
  system: 'bg-slate-100 text-slate-600 border-slate-200',
};

const CATEGORY_ICON: Record<string, typeof User> = {
  user:   User,
  admin:  Shield,
  system: Settings,
};

const ACTION_COLOR: Record<string, string> = {
  'user.register':       'text-emerald-600',
  'user.login':          'text-blue-600',
  'listing.create':      'text-indigo-600',
  'listing.delete':      'text-red-500',
  'subscription.payment':'text-amber-600',
  'subscription.expire': 'text-orange-500',
  'maintenance.toggle':  'text-violet-600',
};

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
}

/* ── Audit entry card (mobile) ───────────────────────────── */
function AuditCard({ log }: { log: AuditEntry }) {
  const CatIcon = CATEGORY_ICON[log.category] ?? Settings;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border
          ${CATEGORY_COLOR[log.category] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
          <CatIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-bold truncate ${ACTION_COLOR[log.action] ?? 'text-slate-900'}`}>
            {log.action}
          </p>
          <p className="text-[11px] text-slate-400 truncate">{log.detail || log.resource}</p>
        </div>
        <span className={`flex-shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold
          ${log.status === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
          {log.status === 'success'
            ? <CheckCircle className="h-3 w-3" />
            : <XCircle className="h-3 w-3" />
          }
          {log.status}
        </span>
      </div>

      {/* Actor + time */}
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="truncate max-w-[55%]">{log.user_name} {log.user_email && `· ${log.user_email}`}</span>
        <span className="flex items-center gap-1 flex-shrink-0">
          <Calendar className="h-3 w-3" />
          {fmt(log.timestamp)}
        </span>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function AdminAuditPage() {
  const [filter, setFilter]   = useState<FilterType>('all');
  const [search, setSearch]   = useState('');
  const [committed, setCommitted] = useState('');
  const [page, setPage]       = useState(1);
  const PAGE_SIZE = 25;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'audit', filter, committed, page],
    queryFn: () =>
      apiClient.get<ApiResponse<AuditEntry[]>>('/admin/audit', {
        params: { type: filter, search: committed || undefined, page, page_size: PAGE_SIZE },
      }).then(r => r.data),
    staleTime: 15_000,
  });

  const logs: AuditEntry[] = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;
  const total = meta?.total ?? logs.length;
  const totalPages = meta?.total_pages ?? 1;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setCommitted(search);
    setPage(1);
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-indigo-600 flex-shrink-0" /> Audit Logs
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Track all system activities and changes</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 h-9 rounded-xl border border-slate-200 bg-white
            px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors
            disabled:opacity-50 self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setPage(1); }}
              className={`flex items-center gap-1.5 h-8 rounded-xl px-3 text-[12px] font-semibold
                border transition-all ${
                filter === f.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <f.icon className="h-3 w-3" />
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 sm:ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              placeholder="Search action, user, resource…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full sm:w-60 rounded-xl border border-slate-200 pl-9 pr-4
                text-[13px] text-slate-800 placeholder-slate-400 focus:border-indigo-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>
          <button type="submit"
            className="h-9 rounded-xl bg-indigo-600 px-4 text-[12px] font-bold text-white
              hover:bg-indigo-700 transition-colors flex-shrink-0">
            Search
          </button>
        </form>
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-[12px] text-slate-400">
          {total.toLocaleString()} log{total !== 1 ? 's' : ''}
          {committed && <> matching <span className="font-semibold text-slate-600">"{committed}"</span></>}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <>
          {/* Mobile skeletons */}
          <div className="space-y-3 lg:hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-3 w-1/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </>
      )}

      {/* Empty */}
      {!isLoading && logs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center
          rounded-2xl border-2 border-dashed border-slate-200 bg-white">
          <ClipboardList className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">No audit logs found</p>
          <p className="text-[13px] text-slate-400 max-w-xs">
            {committed
              ? `No results for "${committed}"`
              : 'Audit events will appear here as users interact with the platform.'}
          </p>
        </div>
      )}

      {/* ── Mobile cards ─────────────────────────────────────── */}
      {!isLoading && logs.length > 0 && (
        <div className="space-y-3 lg:hidden">
          {logs.map(log => <AuditCard key={log.id} log={log} />)}
        </div>
      )}

      {/* ── Desktop table ─────────────────────────────────────── */}
      {!isLoading && logs.length > 0 && (
        <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Time', 'Actor', 'Action', 'Resource', 'IP', 'Status'].map(h => (
                    <th key={h}
                      className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => {
                  const CatIcon = CATEGORY_ICON[log.category] ?? Settings;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                        {fmt(log.timestamp)}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-[12px] font-semibold text-slate-800 truncate max-w-[130px]">
                          {log.user_name || 'System'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{log.user_email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border
                            ${CATEGORY_COLOR[log.category] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            <CatIcon className="h-3 w-3" />
                          </span>
                          <div className="min-w-0">
                            <p className={`text-[12px] font-semibold ${ACTION_COLOR[log.action] ?? 'text-slate-700'}`}>
                              {log.action}
                            </p>
                            {log.detail && (
                              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{log.detail}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[12px] text-slate-500 truncate max-w-[100px]">
                        {log.resource || '—'}
                      </td>
                      <td className="px-5 py-3 text-[11px] font-mono text-slate-400">
                        {log.ip_address || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                          text-[10px] font-bold border ${
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                          {log.status === 'success'
                            ? <CheckCircle className="h-2.5 w-2.5" />
                            : <XCircle className="h-2.5 w-2.5" />
                          }
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-4
              text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40
              disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="text-[13px] text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-4
              text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40
              disabled:cursor-not-allowed transition-all"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
