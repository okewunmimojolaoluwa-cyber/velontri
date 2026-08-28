/**
 * useNotifications — shared hook for unread count + notification list.
 *
 * Used by:
 * - Bell badge in user-shell (unread count)
 * - Notifications page (full list)
 * - Any component that needs live unread count
 *
 * Polls every 20s for live updates. No SSE needed — polling is reliable
 * and works perfectly on Render's free tier with no persistent connections.
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
 staleTime: 15_000,
 refetchInterval: 20_000,
 refetchOnWindowFocus: true,
 });

 const { mutate: markRead } = useMutation({
 mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read`, {}),
 onSuccess: () => qc.invalidateQueries({ queryKey: [uid, 'notifications'] }),
 });

 const { mutate: markAllRead } = useMutation({
 mutationFn: () => apiClient.post('/notifications/read-all', {}),
 onSuccess: () => qc.invalidateQueries({ queryKey: [uid, 'notifications'] }),
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

/** Lightweight hook — just the unread count badge. Used in shells/nav. */
export function useUnreadCount() {
 const { session } = useAuth();
 const uid = session.userId;

 const { data } = useQuery({
 queryKey: [uid, 'notifications', 'unread-count'],
 queryFn: () =>
 apiClient
 .get<ApiResponse<NotificationsPayload>>('/notifications', {
 params: { page: 1, page_size: 1 },
 })
 .then(r => {
 const d = r.data?.data as NotificationsPayload | undefined;
 return d?.unread_count ?? 0;
 }),
 enabled: session.isAuthenticated,
 staleTime: 20_000,
 refetchInterval: 20_000,
 refetchOnWindowFocus: true,
 });

 return data ?? 0;
}
