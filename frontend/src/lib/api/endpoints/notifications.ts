import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface Notification {
  id: string;
  type: 'order' | 'message' | 'payment' | 'listing' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  email_orders: boolean;
  email_messages: boolean;
  email_payments: boolean;
  email_marketing: boolean;
  push_orders: boolean;
  push_messages: boolean;
  push_payments: boolean;
}

export const notificationsApi = {
  getNotifications(params: { page?: number; page_size?: number; unread_only?: boolean } = {}) {
    return apiClient
      .get<ApiResponse<Notification[]>>('/notifications', { params })
      .then((r) => r.data);
  },

  markAsRead(notificationId: string) {
    return apiClient
      .post<ApiResponse<unknown>>(`/notifications/${notificationId}/read`, {})
      .then((r) => r.data);
  },

  markAllAsRead() {
    return apiClient
      .post<ApiResponse<unknown>>('/notifications/read-all', {})
      .then((r) => r.data);
  },

  deleteNotification(notificationId: string) {
    return apiClient
      .delete<ApiResponse<unknown>>(`/notifications/${notificationId}`)
      .then((r) => r.data);
  },

  getPreferences() {
    return apiClient
      .get<ApiResponse<NotificationPreferences>>('/notifications/preferences')
      .then((r) => r.data);
  },

  updatePreferences(data: Partial<NotificationPreferences>) {
    return apiClient
      .patch<ApiResponse<NotificationPreferences>>('/notifications/preferences', data)
      .then((r) => r.data);
  },
};

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: object) => [...notificationKeys.all, 'list', params] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

export function notificationUserKeys(userId: string) {
  return {
    all:         [userId, 'notifications'] as const,
    list:        (params?: object) => [userId, 'notifications', 'list', params] as const,
    preferences: () => [userId, 'notifications', 'preferences'] as const,
  };
}
