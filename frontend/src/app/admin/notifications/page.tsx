'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Trash2, Plus, CheckCircle, AlertCircle, X, Users } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface PlatformNotification {
  id: string;
  title: string;
  content: string;
  target_audience: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'All Users',
  buyers: 'Buyers Only',
  sellers: 'Sellers Only',
};

export default function AdminNotificationsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', target_audience: 'all' });
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () =>
      apiClient.get<ApiResponse<PlatformNotification[]>>('/admin/notifications').then(r => r.data),
    staleTime: 30_000,
  });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/notifications', {
        title: form.title.trim(),
        content: form.content.trim(),
        target_audience: form.target_audience,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      setForm({ title: '', content: '', target_audience: 'all' });
      setShowForm(false);
      setFormOk(true);
      setTimeout(() => setFormOk(false), 3000);
    },
    onError: (e: any) => {
      setFormErr(e?.response?.data?.error?.message || e?.message || 'Failed to send announcement.');
    },
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  });

  const notifications: PlatformNotification[] = Array.isArray(data?.data) ? data.data : [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr('');
    if (!form.title.trim()) { setFormErr('Title is required.'); return; }
    if (!form.content.trim()) { setFormErr('Content is required.'); return; }
    create();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-indigo-600" /> Announcements
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Send platform-wide announcements to users</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormErr(''); }}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Announcement
        </button>
      </div>

      {/* Success banner */}
      {formOk && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-emerald-700">Announcement sent successfully.</p>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50/50 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-900">New Announcement</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setFormErr(''); }}
                placeholder="e.g. Scheduled maintenance tonight"
                required
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={e => { setForm(f => ({ ...f, content: e.target.value })); setFormErr(''); }}
                placeholder="Write the announcement message…"
                rows={4}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Target Audience</label>
              <select
                value={form.target_audience}
                onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] text-slate-700 outline-none focus:border-indigo-400 transition-all"
              >
                <option value="all">All Users</option>
                <option value="buyers">Buyers Only</option>
                <option value="sellers">Sellers Only</option>
              </select>
            </div>
            {formErr && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-[12px] font-medium text-red-600">{formErr}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="h-10 rounded-xl bg-indigo-600 px-5 text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Sending…' : 'Send Announcement'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormErr(''); }}
                className="h-10 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load announcements</p>
          <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Bell className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">No announcements yet</p>
          <p className="text-[13px] text-slate-400">Send your first announcement to keep users informed.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {notifications.map(n => (
            <div key={n.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                <Bell className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-bold text-slate-900">{n.title}</p>
                  <span className="flex-shrink-0 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 capitalize">
                    <Users className="h-3 w-3 inline mr-1" />
                    {AUDIENCE_LABELS[n.target_audience] ?? n.target_audience}
                  </span>
                </div>
                <p className="text-[13px] text-slate-600 mt-0.5 line-clamp-2">{n.content}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {new Date(n.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => remove(n.id)}
                className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all"
                title="Delete announcement"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
