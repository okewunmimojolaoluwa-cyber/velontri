import { apiClient } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/token-refresh';
import { siteConfig } from '@/config/site';
import type { ApiResponse } from '@/types/api';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country_code: string;
  avatar_url?: string;
  bio?: string;
  is_verified: boolean;
  trust_badge?: string;
  created_at: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  bio?: string;
  avatar_url?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export const usersApi = {
  getProfile() {
    return apiClient
      .get<ApiResponse<UserProfile>>('/users/me')
      .then((r) => r.data);
  },

  updateProfile(data: UpdateProfileRequest) {
    return apiClient
      .patch<ApiResponse<UserProfile>>('/users/me', data)
      .then((r) => r.data);
  },

  changePassword(data: ChangePasswordRequest) {
    return apiClient
      .post<ApiResponse<unknown>>('/users/me/change-password', data)
      .then((r) => r.data);
  },

  deleteAccount() {
    return apiClient
      .delete<ApiResponse<unknown>>('/users/me')
      .then((r) => r.data);
  },

  /**
   * Upload avatar using native fetch so the browser correctly sets
   * multipart/form-data with the right boundary.
   * Axios has a bug where a pre-set Content-Type header on the instance
   * overrides FormData's boundary, causing a 422.
   */
  async uploadAvatar(file: File): Promise<ApiResponse<{ avatar_url: string }>> {
    const fd = new FormData();
    fd.append('file', file);

    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Do NOT set Content-Type — browser sets it automatically with boundary

    const res = await fetch(`${siteConfig.apiUrl}/users/me/avatar`, {
      method: 'POST',
      body: fd,
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data?.error?.message ?? `Upload failed (${res.status})`
      );
    }
    return data as ApiResponse<{ avatar_url: string }>;
  },
};

export const userKeys = {
  all: ['users'] as const,
  profile: () => [...userKeys.all, 'profile'] as const,
};
