'use client';

import { useState } from 'react';
import { FileText, MagnifyingGlass } from '@phosphor-icons/react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface ModLog {
  id: string;
  timestamp: string;
  moderator_name: string;
  action: string;
  target_type: 'listing' | 'user' | 'store' | 'kyc';
  target_id: string;
  details: string;
  ip_address: string;
}

export default function ModLogsPage() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<'all' | 'listings' | 'users' | 'stores' | 'kyc'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mod-logs', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<ModLog[]>>(`/mod/logs?type=${filter}`)
        .then((r) => r.data),
    enabled: session.isAuthenticated,
    retry: false,
  });

  const logs: ModLog[] = Array.isArray(data?.data) ? data.data as ModLog[] : [];

  const filtered = logs.filter(
    (log) =>
      !search ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.moderator_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-500" /> Moderation Logs
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Track all moderation activities</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs…"
            className="h-9 w-52 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-amber-400 transition-all"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'listings', 'users', 'stores', 'kyc'] as const).map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
                filter === t ? 'bg-amber-500 text-white' : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-[14px] font-semibold text-amber-700 mb-1">Feature under development</p>
          <p className="text-[13px] text-amber-600">Moderation audit logs will be available in a future update.</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 && !isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <FileText className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">No logs found</p>
          <p className="text-[12px] text-slate-400">
            {search ? 'Try a different search term.' : 'Moderation actions will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden lg:grid grid-cols-[140px_1fr_1fr_1fr_120px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            {['Timestamp', 'Moderator', 'Action', 'Target', 'IP Address'].map((h) => (
              <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
            ))}
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map((log) => (
              <div key={log.id} className="grid grid-cols-1 lg:grid-cols-[140px_1fr_1fr_1fr_120px] gap-2 lg:gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <p className="text-[12px] text-slate-400 tabular-nums">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
                <p className="text-[13px] font-semibold text-slate-900">{log.moderator_name}</p>
                <p className="text-[13px] text-slate-700">{log.action}</p>
                <p className="text-[12px] text-slate-500">
                  <span className="capitalize">{log.target_type}</span>: {log.target_id.slice(0, 8)}…
                </p>
                <p className="text-[12px] text-slate-400 font-mono">{log.ip_address}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}