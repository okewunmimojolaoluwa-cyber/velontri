'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { RoleGate } from '@/components/rbac/role-gate';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Dispute {
  id: string;
  order_id: string;
  buyer_id: string;
  buyer_name: string;
  seller_id: string;
  seller_name: string;
  amount: number;
  currency: string;
  reason: string;
  status: 'open' | 'under_review' | 'resolved_buyer' | 'resolved_seller' | 'closed';
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  under_review: 'bg-amber-100 text-amber-700',
  resolved_buyer: 'bg-blue-100 text-blue-700',
  resolved_seller: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default function DisputesPage() {
  const qc = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'disputes'],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Dispute[]>>('/payments/disputes', { params: { status: 'open,under_review', page_size: 50 } })
        .then((r) => r.data),
  });

  const { mutate: resolveDispute, isPending: resolving } = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: 'buyer' | 'seller' }) =>
      apiClient.post(`/payments/disputes/${id}/resolve`, { resolution, note: resolutionNote }),
    onMutate: ({ id }) => setResolvingId(id),
    onSettled: () => {
      setResolvingId(null);
      setResolutionNote('');
      setExpandedId(null);
      qc.invalidateQueries({ queryKey: ['admin', 'disputes'] });
    },
  });

  const disputes = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;
  const openCount = disputes.filter((d) => d.status === 'open').length;

  return (
    <RoleGate
      roles={['enterprise_admin', 'ops']}
      fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Access denied.</p></div>}
    >
      
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Disputes</h1>
              <p className="text-sm text-muted-foreground">
                {openCount > 0 ? (
                  <span className="text-red-600 font-medium">{openCount} open dispute{openCount !== 1 ? 's' : ''} need attention</span>
                ) : (
                  'Manage buyer-seller disputes'
                )}
              </p>
            </div>
          </div>

          {isError ? (
            <ErrorState title="Failed to load disputes" description="Please try again." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
          ) : disputes.length === 0 ? (
            <EmptyState title="No open disputes" description="All disputes have been resolved." />
          ) : (
            <div className="space-y-3">
              {disputes.map((dispute) => (
                <div key={dispute.id} className="rounded-lg border bg-card overflow-hidden">
                  {/* Summary row */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(expandedId === dispute.id ? null : dispute.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium capitalize ${STATUS_COLORS[dispute.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {dispute.status.replace(/_/g, ' ')}
                        </span>
                        <p className="text-sm font-medium truncate">Order #{dispute.order_id.slice(0, 8)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dispute.buyer_name} vs {dispute.seller_name} ·{' '}
                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: dispute.currency, maximumFractionDigits: 0 }).format(dispute.amount)} ·{' '}
                        {new Date(dispute.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-muted-foreground ml-4">{expandedId === dispute.id ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded panel */}
                  {expandedId === dispute.id && (
                    <div className="border-t px-5 py-4 bg-muted/20 space-y-4">
                      <p className="text-sm"><span className="font-medium">Reason:</span> {dispute.reason}</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="rounded-md bg-blue-50 p-3">
                          <p className="font-medium text-blue-700">Buyer</p>
                          <p>{dispute.buyer_name}</p>
                        </div>
                        <div className="rounded-md bg-green-50 p-3">
                          <p className="font-medium text-green-700">Seller</p>
                          <p>{dispute.seller_name}</p>
                        </div>
                      </div>

                      {(dispute.status === 'open' || dispute.status === 'under_review') && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Resolution note (optional)</label>
                            <Input
                              placeholder="Add a note about this resolution…"
                              value={resolutionNote}
                              onChange={(e) => setResolutionNote(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-3">
                            <Button
                              size="sm"
                              disabled={resolving && resolvingId === dispute.id}
                              onClick={() => resolveDispute({ id: dispute.id, resolution: 'buyer' })}
                            >
                              Favour Buyer
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={resolving && resolvingId === dispute.id}
                              onClick={() => resolveDispute({ id: dispute.id, resolution: 'seller' })}
                            >
                              Favour Seller
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      
    </RoleGate>
  );
}
