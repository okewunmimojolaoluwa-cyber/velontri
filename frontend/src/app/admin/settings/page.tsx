'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminSettingsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'integrations' | 'maintenance'>('general');
  const [form, setForm] = useState({
    site_name: '',
    site_url: '',
    support_email: '',
    support_phone: '',
    maintenance_mode: false,
  });
  const [message, setMessage] = useState('');

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      apiClient.get<ApiResponse<AdminSettings>>('/admin/settings').then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  useEffect(() => {
    const settings = settingsData?.data;
    if (settings) {
      setForm({
        site_name: settings.site_name || '',
        site_url: settings.site_url || '',
        support_email: settings.support_email || '',
        support_phone: settings.support_phone || '',
        maintenance_mode: settings.maintenance_mode || false,
      });
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AdminSettings>) =>
      apiClient.put('/admin/settings', data),
    onSuccess: () => {
      setMessage('Settings updated successfully');
      setTimeout(() => setMessage(''), 3000);
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  if (isLoading) {
    return (
      
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      
    );
  }

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Configure platform-wide settings</p>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-md ${
            message.includes('success')
              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}>
            {message}
          </div>
        )}

        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            {(['general', 'security', 'integrations', 'maintenance'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'general' && (
          <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Site Name
              </label>
              <Input
                value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                placeholder="Velontri"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Site URL
              </label>
              <Input
                type="url"
                value={form.site_url}
                onChange={(e) => setForm({ ...form, site_url: e.target.value })}
                placeholder="https://velontri.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Support Email
              </label>
              <Input
                type="email"
                value={form.support_email}
                onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                placeholder="support@velontri.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Support Phone
              </label>
              <Input
                type="tel"
                value={form.support_phone}
                onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
                placeholder="+234 XXX XXX XXXX"
              />
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        )}

        {activeTab === 'security' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">Security Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Require 2FA for admin accounts</p>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors">
                  <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Session Timeout</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Auto-logout after inactivity</p>
                </div>
                <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>1 hour</option>
                  <option>Never</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">IP Whitelist</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Restrict admin access to specific IPs</p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">Third-Party Integrations</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Payment Gateway</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Flutterwave / Paystack</p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">SMS Provider</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Twilio / Africa's Talking</p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Email Service</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">SendGrid / AWS SES</p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Analytics</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Google Analytics</p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">Maintenance Mode</h3>
            
            <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Enable Maintenance Mode</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Temporarily disable the platform for maintenance
                </p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-600 transition-colors">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maintenance Message
              </label>
              <textarea
                placeholder="We're currently performing scheduled maintenance. Please check back soon."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <Button variant="destructive">
              Enable Maintenance Mode
            </Button>
          </div>
        )}
      </div>
    
  );
}

interface AdminSettings {
  site_name?: string;
  site_url?: string;
  support_email?: string;
  support_phone?: string;
  maintenance_mode?: boolean;
}
