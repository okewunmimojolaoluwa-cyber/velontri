'use client';

import { useState } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: 'all' | 'buyers' | 'sellers';
  is_active: boolean;
  created_by: string;
  created_at: string;
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all';

export default function ModAnnouncementsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    target_audience: 'all' as 'all' | 'buyers' | 'sellers',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['mod-announcements'],
    queryFn: () =>
      apiClient.get<ApiResponse<Announcement[]>>('/analytics/admin/notifications').then(r => r.data),
    enabled: session.isAuthenticated,
  });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => apiClient.post('/analytics/admin/notifications', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mod-announcements'] });
      setShowCreate(false);
      setForm({ title: '', content: '', target_audience: 'all' });
    },
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/analytics/admin/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-announcements'] }),
  });

  const announcements: Announcement[] = Array.isArray(data?.data) ? data.data as Announcement[] : [];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Announcements</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Manage platform announcements</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5
            text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" /> Create Announcement
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-indigo-50/50 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-900">New Announcement</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Content</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Announcement content" rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px]
                  text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none
                  focus:ring-2 focus:ring-indigo-500/10 resize-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Target Audience</label>
              <select value={form.target_audience}
                onChange={e => setForm(f => ({ ...f, target_audience: e.target.value as any }))}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px]
                  text-slate-700 focus:border-indigo-400 focus:outline-none transition-all">
                <option value="all">All Users</option>
                <option value="buyers">Buyers Only</option>
                <option value="sellers">Sellers Only</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => form.title.trim() && form.content.trim() && create()}
                disabled={creating || !form.title.trim() || !form.content.trim()}
                className="h-10 rounded-xl bg-indigo-600 px-5 text-[13px] font-bold text-white
                  hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="h-10 rounded-xl border border-slate-200 px-5 text-[13px] font-semibold
                  text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Megaphone className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-900 mb-1">No announcements yet</p>
          <p className="text-[12px] text-slate-400">Create announcements to communicate with users.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-slate-900">{a.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(a.created_at).toLocaleDateString()} · {a.target_audience}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                    a.is_active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => remove(a.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200
                      text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed">{a.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
