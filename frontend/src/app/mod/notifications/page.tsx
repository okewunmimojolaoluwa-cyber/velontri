'use client';

import { useState } from 'react';
import { Bell, PaperPlaneRight, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface ModNotification {
 id: string;
 title: string;
 message: string;
 audience: string;
 recipient_count: number;
 sent_at: string;
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-500/10 transition-all';

export default function ModNotificationsPage() {
 const { session } = useAuth();
 const qc = useQueryClient();
 const [form, setForm] = useState({ title: '', message: '', audience: 'all' as 'all' | 'buyers' | 'sellers' });
 const [success, setSuccess] = useState('');
 const [error, setError] = useState('');

 const { data, isLoading } = useQuery({
 queryKey: ['mod-notifications'],
 queryFn: () =>
 apiClient.get<ApiResponse<ModNotification[]>>('/mod/notifications').then((r) => r.data),
 enabled: session.isAuthenticated,
 retry: false,
 });

 const sendMutation = useMutation({
 mutationFn: () => apiClient.post('/mod/notifications', form),
 onSuccess: () => {
 setSuccess('Notification sent successfully.');
 setError('');
 setForm({ title: '', message: '', audience: 'all' });
 qc.invalidateQueries({ queryKey: ['mod-notifications'] });
 setTimeout(() => setSuccess(''), 4000);
 },
 onError: (err: any) => {
 setError(err?.message || 'Failed to send notification.');
 setSuccess('');
 },
 });

 const notifications: ModNotification[] = Array.isArray(data?.data) ? data.data as ModNotification[] : [];

 function handleSend(e: React.FormEvent) {
 e.preventDefault();
 if (!form.title.trim() || !form.message.trim()) return;
 setError('');
 sendMutation.mutate();
 }

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
 <Bell className="h-5 w-5 text-amber-500" /> Platform Notifications
 </h1>
 <p className="text-[13px] text-slate-400 mt-0.5">PaperPlaneRight announcements to platform users</p>
 </div>

 <div className="grid gap-6 lg:grid-cols-2">
        {/* PaperPlaneRight form */}
 <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
 <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
 <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">PaperPlaneRight New Notification</h2>
 </div>
 <form onSubmit={handleSend} className="p-5 space-y-4">
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-700">Title</label>
 <input
 value={form.title}
 onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
 placeholder="Notification title"
 className={inputCls}
 required
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-700">Message</label>
 <textarea
 value={form.message}
 onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
 placeholder="Notification message"
 rows={4}
 className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/10 resize-none transition-all"
 required
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-700">Audience</label>
 <select
 value={form.audience}
 onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as any }))}
 className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-700 focus:border-amber-400 focus:outline-none transition-all"
 >
 <option value="all">All Users</option>
 <option value="buyers">Buyers Only</option>
 <option value="sellers">Sellers Only</option>
 </select>
 </div>

 {error && (
 <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
 <WarningCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
 <p className="text-[12px] font-medium text-red-600">{error}</p>
 </div>
 )}
 {success && (
 <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
 <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
 <p className="text-[12px] font-semibold text-emerald-700">{success}</p>
 </div>
 )}

 <button
 type="submit"
 disabled={sendMutation.isPending || !form.title.trim() || !form.message.trim()}
 className="flex items-center gap-2 h-10 rounded-xl bg-amber-500 px-5 text-[13px] font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
 >
 <PaperPlaneRight className="h-4 w-4" />
 {sendMutation.isPending ? 'Sending…' : 'PaperPlaneRight Notification'}
 </button>
 </form>
 </div>

        {/* History */}
 <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
 <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
 <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Recent Notifications</h2>
 </div>
 <div className="p-5">
 {isLoading ? (
 <div className="space-y-3">
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
 ))}
 </div>
 ) : notifications.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-10 text-center">
 <Bell className="h-8 w-8 text-slate-200 mb-2" />
 <p className="text-[13px] font-semibold text-slate-500">No notifications sent yet</p>
 <p className="text-[11px] text-slate-400 mt-0.5">Sent notifications will appear here</p>
 </div>
 ) : (
 <div className="space-y-3">
 {notifications.map((n) => (
 <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
 <div className="flex items-start justify-between mb-1.5 gap-2">
 <p className="text-[13px] font-bold text-slate-900">{n.title}</p>
 <p className="text-[11px] text-slate-400 shrink-0">
 {n.sent_at ? new Date(n.sent_at).toLocaleDateString() : ''}
 </p>
 </div>
 <p className="text-[12px] text-slate-600 mb-2">{n.message}</p>
 <div className="flex items-center gap-3 text-[11px] text-slate-400">
 <span>Audience: <strong className="text-slate-600 capitalize">{n.audience}</strong></span>
 {n.recipient_count > 0 && (
 <span>Recipients: <strong className="text-slate-600">{n.recipient_count}</strong></span>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}