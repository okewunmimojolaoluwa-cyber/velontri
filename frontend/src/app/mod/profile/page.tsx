'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModProfilePage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
  });
  const [message, setMessage] = useState('');

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['mod-profile'],
    queryFn: () =>
      apiClient.get<ApiResponse<ModProfile>>('/mod/profile').then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  useEffect(() => {
    const profile = profileData?.data;
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        email: profile.email || '',
      });
    }
  }, [profileData]);

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiClient.put('/mod/profile', data),
    onSuccess: () => {
      setMessage('Profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setMessage(''), 3000);
      queryClient.invalidateQueries({ queryKey: ['mod-profile'] });
    },
    onError: () => {
      setMessage('Failed to update profile');
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <Skeleton className="h-20 w-20 rounded-full mb-4" />
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      
    );
  }

  const profile = profileData?.data;

  return (
    
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Moderator Profile</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your moderator account</p>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          )}
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

        {isEditing ? (
          <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                disabled
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-6">
              <div className="h-32 w-32 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                <span className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                  {profile?.full_name?.charAt(0) || 'M'}
                </span>
              </div>

              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {profile?.full_name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{profile?.email}</p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Role</p>
                    <p className="font-medium text-gray-900 dark:text-white">Moderator</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Status</p>
                    <p className="font-medium text-green-600 dark:text-green-400">Active</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Actions Taken</p>
                    <p className="font-medium text-gray-900 dark:text-white">{profile?.actions_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Member Since</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    
  );
}

interface ModProfile {
  id: string;
  full_name: string;
  email: string;
  actions_count?: number;
  created_at?: string;
}
