'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function PushNotificationsPage() {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  const [sent, setSent] = useState(false);

  const { mutate: send, isPending } = useMutation({
    mutationFn: (d: typeof form) => apiClient.post('/notification/admin/push', d),
    onSuccess: () => { setSent(true); setForm({ title: '', body: '', audience: 'all' }); setTimeout(() => setSent(false), 4000); },
  });

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-indigo-600" /> Push Notifications
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Send in-app push notifications to users</p>
        </div>

        {sent && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-700">Notification sent successfully</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-lg">
          <form onSubmit={e => { e.preventDefault(); send(form); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Title</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification title" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Message</label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Notification body"
                rows={4} required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Audience</label>
              <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none">
                <option value="all">All Users</option>
                <option value="users">Regular Users</option>
                <option value="moderators">Moderators</option>
              </select>
            </div>
            <Button type="submit" disabled={isPending}>{isPending ? 'Sending…' : 'Send Notification'}</Button>
          </form>
        </div>
      </div>
    
  );
}
