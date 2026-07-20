'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModKycPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-kyc', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<KycRequest[]>>(`/mod/kyc?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/kyc/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-kyc'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/kyc/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-kyc'] });
    },
  });

  const kycRequests = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">KYC Verification</h1>
          <p className="text-gray-600 dark:text-gray-400">Review user identity verification requests</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
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
        ) : kycRequests.length === 0 ? (
          <EmptyState
            title="No KYC requests found"
            description="There are no pending KYC verifications"
          />
        ) : (
          <div className="space-y-4">
            {kycRequests.map((kyc) => (
              <div
                key={kyc.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {kyc.user_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {kyc.email} • Submitted {new Date(kyc.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    kyc.status === 'approved'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : kyc.status === 'pending'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {kyc.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Document Type</p>
                    <p className="font-medium text-gray-900 dark:text-white">{kyc.document_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Document Number</p>
                    <p className="font-medium text-gray-900 dark:text-white">{kyc.document_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Country</p>
                    <p className="font-medium text-gray-900 dark:text-white">{kyc.country}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Selfie</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {kyc.selfie_verified ? 'Verified' : 'Pending'}
                    </p>
                  </div>
                </div>

                {kyc.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(kyc.id)}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rejectMutation.mutate(kyc.id)}
                      disabled={rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                    <Button variant="outline" size="sm">
                      View Documents
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

interface KycRequest {
  id: string;
  user_name: string;
  email: string;
  document_type: string;
  document_number: string;
  country: string;
  selfie_verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
}
