'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModNotificationsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    message: '',
    audience: 'all' as 'all' | 'buyers' | 'sellers',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['mod-notifications'],
    queryFn: () =>
      apiClient.get<ApiResponse<ModNotification[]>>(`/mod/notifications`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const sendMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiClient.post('/mod/notifications', data),
    onSuccess: () => {
      setForm({ title: '', message: '', audience: 'all' });
      queryClient.invalidateQueries({ queryKey: ['mod-notifications'] });
    },
  });

  const notifications = data?.data || [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMutation.mutate(form);
  };

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Notifications</h1>
          <p className="text-gray-600 dark:text-gray-400">Send announcements to platform users</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Send New Notification</h3>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Notification title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Notification message"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Audience
                </label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Users</option>
                  <option value="buyers">Buyers Only</option>
                  <option value="sellers">Sellers Only</option>
                </select>
              </div>

              <Button type="submit" disabled={sendMutation.isPending}>
                {sendMutation.isPending ? 'Sending...' : 'Send Notification'}
              </Button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Notifications</h3>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                title="No notifications sent"
                description="Your notification history will appear here"
              />
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">{notification.title}</h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(notification.sent_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{notification.message}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Audience: {notification.audience}</span>
                      <span>•</span>
                      <span>Recipients: {notification.recipient_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    
  );
}

interface ModNotification {
  id: string;
  title: string;
  message: string;
  audience: string;
  recipient_count: number;
  sent_at: string;
}
