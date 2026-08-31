import { apiClient } from '@/lib/api/client';
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

 uploadAvatar(file: File): Promise<ApiResponse<{ avatar_url: string }>> {
 const fd = new FormData();
 fd.append('file', file);
 return apiClient
 .post<ApiResponse<{ avatar_url: string }>>('/users/me/avatar', fd, {
 headers: { 'Content-Type': undefined }, // let axios set multipart/form-data with boundary
 })
 .then((r) => r.data);
 },
};

export const userKeys = {
 all: ['users'] as const,
 profile: () => [...userKeys.all, 'profile'] as const,
};
