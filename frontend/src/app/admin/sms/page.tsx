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

export default function AdminSmsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    template: 'otp' as 'otp' | 'welcome' | 'order_update' | 'marketing',
    content: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sms'],
    queryFn: () =>
      apiClient.get<ApiResponse<SmsTemplate[]>>('/admin/sms').then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: typeof form & { id: string }) =>
      apiClient.put(`/admin/sms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sms'] });
      setIsCreating(false);
    },
  });

  const templates = data?.data || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const template = templates.find(t => t.template === form.template);
    if (template) {
      updateMutation.mutate({ id: template.id, ...form });
    }
  };

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SMS Templates</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage SMS templates for automated messages</p>
        </div>

        {isCreating && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Edit Template</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Type
                </label>
                <select
                  value={form.template}
                  onChange={(e) => setForm({ ...form, template: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="otp">OTP Verification</option>
                  <option value="welcome">Welcome Message</option>
                  <option value="order_update">Order Update</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content (max 160 chars)
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="SMS content (supports {{code}}, {{name}} placeholders)"
                  rows={3}
                  maxLength={160}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {form.content.length}/160 characters
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="No SMS templates"
            description="Create SMS templates for automated communications"
          />
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                      {template.template.replace('_', ' ')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Last updated: {new Date(template.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    template.is_active
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-2 font-mono text-sm">
                  {template.content}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {template.content.length}/160 characters
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm({
                      template: template.template as any,
                      content: template.content,
                    });
                    setIsCreating(true);
                  }}
                >
                  Edit Template
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface SmsTemplate {
  id: string;
  template: string;
  content: string;
  is_active: boolean;
  updated_at: string;
}
