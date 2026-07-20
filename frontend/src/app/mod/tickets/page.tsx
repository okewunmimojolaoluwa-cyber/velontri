'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function ModTicketsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'in_progress' | 'resolved' | 'all'>('open');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-tickets', filter],
    queryFn: () =>
      apiClient.get<ApiResponse<SupportTicket[]>>(`/mod/tickets?status=${filter}`).then((r) => r.data),
    enabled: session?.isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.put(`/mod/tickets/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-tickets'] });
    },
  });

  const tickets = data?.data || [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support Tickets</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage user support requests</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'open', 'in_progress', 'resolved'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              onClick={() => setFilter(status)}
              size="sm"
              className="capitalize"
            >
              {status.replace('_', ' ')}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tickets found"
            description="There are no support tickets matching your criteria"
          />
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {ticket.subject}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {ticket.user_name} • {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    ticket.status === 'resolved'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : ticket.status === 'in_progress'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Category</p>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">{ticket.category}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Priority</p>
                    <p className={`font-medium ${
                      ticket.priority === 'high'
                        ? 'text-red-600 dark:text-red-400'
                        : ticket.priority === 'medium'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {ticket.priority}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Last Updated</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(ticket.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {ticket.message}
                </p>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  {ticket.status === 'open' && (
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: ticket.id, status: 'in_progress' })}
                      disabled={updateMutation.isPending}
                    >
                      Start Working
                    </Button>
                  )}
                  {ticket.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: ticket.id, status: 'resolved' })}
                      disabled={updateMutation.isPending}
                    >
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  user_name: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
}
