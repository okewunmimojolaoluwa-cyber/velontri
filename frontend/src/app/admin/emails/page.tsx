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

export default function AdminEmailsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    template: 'welcome' as 'welcome' | 'order_confirmation' | 'password_reset' | 'marketing',
    content: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-emails'],
    queryFn: () =>
      apiClient.get<ApiResponse<EmailTemplate[]>>('/admin/emails').then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: typeof form & { id: string }) =>
      apiClient.put(`/admin/emails/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-emails'] });
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Templates</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage email templates and settings</p>
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
                  <option value="welcome">Welcome Email</option>
                  <option value="order_confirmation">Order Confirmation</option>
                  <option value="password_reset">Password Reset</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject
                </label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Email subject"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Email content (supports {{variable}} placeholders)"
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
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
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="No email templates"
            description="Create email templates for automated communications"
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

                <p className="text-gray-600 dark:text-gray-400 mb-2">{template.subject}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                  {template.content}
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm({
                      subject: template.subject,
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

interface EmailTemplate {
  id: string;
  template: string;
  subject: string;
  content: string;
  is_active: boolean;
  updated_at: string;
}
