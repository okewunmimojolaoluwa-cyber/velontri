/**
 * useNotifications — shared hook for unread count + notification list.
 *
 * Both hooks share the same base query key so React Query deduplicates
 * the polling requests automatically.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/features/auth/auth-provider';
import type { ApiResponse } from '@/types/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_user_id?: string | null;
  sender_role?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  related_resource_type?: string | null;
  related_resource_id?: string | null;
  action_url?: string | null;
}

export interface NotificationsPayload {
  notifications: Notification[];
  unread_count: number;
}

/** Full hook — list + unread count. Used on notifications page. */
export function useNotifications(params: { page?: number; page_size?: number; unread_only?: boolean } = {}) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session.userId;

  const query = useQuery({
    queryKey: [uid, 'notifications', 'list', params],
    queryFn: () =>
      apiClient
        .get<ApiResponse<NotificationsPayload>>('/notifications', { params })
        .then(r => {
          const d = r.data?.data as NotificationsPayload | undefined;
          return {
            notifications: Array.isArray(d?.notifications) ? d.notifications : [],
            unread_count: d?.unread_count ?? 0,
          };
        }),
    enabled: session.isAuthenticated,
    staleTime: 10_000, // Reduce stale time for quicker updates
    refetchInterval: 15_000, // Refetch more frequently
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Always refetch on mount
  });

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read`, {}),
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await qc.cancelQueries({ queryKey: [uid, 'notifications'] });
      
      // Optimistically update the count
      qc.setQueryData([uid, 'notifications', 'unread-count'], (old: number = 0) => Math.max(0, old - 1));
      
      // Optimistically update the notification list
      qc.setQueryData([uid, 'notifications', 'list', params], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: Notification) => 
            n.id === id ? { ...n, is_read: true } : n
          ),
          unread_count: Math.max(0, old.unread_count - 1),
        };
      });
    },
    onSuccess: () => {
      // Refetch to sync with server
      qc.invalidateQueries({ queryKey: [uid, 'notifications'] });
      qc.invalidateQueries({ queryKey: [uid, 'notifications', 'unread-count'] });
    },
    onError: () => {
      // On error, refetch to revert optimistic update
      qc.invalidateQueries({ queryKey: [uid, 'notifications'] });
      qc.invalidateQueries({ queryKey: [uid, 'notifications', 'unread-count'] });
    },
  });

  const { mutate: markAllRead } = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all', {}),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await qc.cancelQueries({ queryKey: [uid, 'notifications'] });
      
      // Optimistically set count to 0
      qc.setQueryData([uid, 'notifications', 'unread-count'], 0);
      
      // Optimistically mark all notifications as read
      qc.setQueryData([uid, 'notifications', 'list', params], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: Notification) => ({ ...n, is_read: true })),
          unread_count: 0,
        };
      });
    },
    onSuccess: () => {
      // Refetch to sync with server
      qc.invalidateQueries({ queryKey: [uid, 'notifications'] });
      qc.invalidateQueries({ queryKey: [uid, 'notifications', 'unread-count'] });
    },
    onError: () => {
      // On error, refetch to revert optimistic update
      qc.invalidateQueries({ queryKey: [uid, 'notifications'] });
      qc.invalidateQueries({ queryKey: [uid, 'notifications', 'unread-count'] });
    },
  });

  return {
    notifications: query.data?.notifications ?? [],
    unread_count: query.data?.unread_count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    markRead,
    markAllRead,
  };
}

/**
 * Lightweight hook — just the unread count badge.
 * Uses a dedicated /notifications/unread-count endpoint so it doesn't
 * fetch the full list. Shares the same query key namespace so mutations
 * from useNotifications will invalidate this too.
 */
export function useUnreadCount() {
  const { session } = useAuth();
  const uid = session.userId;

  const { data } = useQuery({
    // Use same namespace so markAllRead invalidation also resets this
    queryKey: [uid, 'notifications', 'unread-count'],
    queryFn: () =>
      apiClient
        .get<ApiResponse<{ unread_count: number }>>('/notifications/unread-count')
        .then(r => (r.data?.data as any)?.unread_count ?? 0)
        .catch(() => 0), // never fail the UI on a count error
    enabled: session.isAuthenticated,
    staleTime: 15_000, // Reduce staleTime so it refetches sooner
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Always refetch on mount to get latest count
  });

  return (data as number) ?? 0;
}
