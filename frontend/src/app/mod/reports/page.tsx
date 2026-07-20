'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModReportsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'resolved' | 'dismissed' | 'all'>('open');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-reports', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<Report[]>>(`/mod/reports?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reports/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-reports'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/reports/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-reports'] });
    },
  });

  const reports = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">Review user reports and violations</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'open', 'resolved', 'dismissed'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              onClick={() => setFilter(status)}
              size="sm"
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            title="No reports found"
            description="There are no reports matching your criteria"
          />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {report.type}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Reported by {report.reporter_name} • {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    report.status === 'resolved'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : report.status === 'open'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {report.status}
                  </span>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {report.description}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Target</p>
                    <p className="font-medium text-gray-900 dark:text-white">{report.target_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Target ID</p>
                    <p className="font-medium text-gray-900 dark:text-white">{report.target_id}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Priority</p>
                    <p className={`font-medium ${
                      report.priority === 'high'
                        ? 'text-red-600 dark:text-red-400'
                        : report.priority === 'medium'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {report.priority}
                    </p>
                  </div>
                </div>

                {report.status === 'open' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => resolveMutation.mutate(report.id)}
                      disabled={resolveMutation.isPending}
                    >
                      Resolve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => dismissMutation.mutate(report.id)}
                      disabled={dismissMutation.isPending}
                    >
                      Dismiss
                    </Button>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface Report {
  id: string;
  type: string;
  description: string;
  reporter_name: string;
  target_type: 'listing' | 'user' | 'store' | 'message';
  target_id: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
}
