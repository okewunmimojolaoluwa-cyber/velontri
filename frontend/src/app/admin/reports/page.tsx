'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdminReportsPage() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<'all' | 'financial' | 'user' | 'system'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<AdminReport[]>>(`/admin/reports?type=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const reports = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">Generate and view platform reports</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'financial', 'user', 'system'] as const).map((type) => (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              onClick={() => setFilter(type)}
              size="sm"
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            title="No reports available"
            description="Generate reports to analyze platform data"
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
                    <h3 className="font-semibold text-gray-900 dark:text-white">{report.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {report.type} • Generated {new Date(report.generated_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    report.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {report.status}
                  </span>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-4">{report.description}</p>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    View Report
                  </Button>
                  <Button variant="outline" size="sm">
                    Download CSV
                  </Button>
                  <Button variant="outline" size="sm">
                    Download PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface AdminReport {
  id: string;
  name: string;
  type: 'financial' | 'user' | 'system';
  description: string;
  status: 'completed' | 'generating';
  generated_at: string;
}
