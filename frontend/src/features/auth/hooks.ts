import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/endpoints/auth';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export function useVerifyPhone() {
  return useMutation({
    mutationFn: ({ userId, otp }: { userId: string; otp: string }) =>
      authApi.verifyPhone(userId, otp),
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient
        .post<ApiResponse<unknown>>('/auth/resend-otp', { user_id: userId })
        .then((r) => r.data),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: authApi.login.bind(authApi),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: authApi.register.bind(authApi),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: (refreshToken: string) => authApi.logout(refreshToken),
  });
}

// ── 2FA hooks ─────────────────────────────────────────────────────────────────

export function useEnable2fa() {
  return useMutation({
    mutationFn: () =>
      apiClient
        .post<ApiResponse<{ qr_code: string; secret: string }>>('/auth/2fa/enable', {})
        .then((r) => r.data),
  });
}

export function useVerify2fa() {
  return useMutation({
    mutationFn: (code: string) =>
      apiClient
        .post<ApiResponse<{ backup_codes: string[] }>>('/auth/2fa/verify', { code })
        .then((r) => r.data),
  });
}

export function useDisable2fa() {
  return useMutation({
    mutationFn: (code: string) =>
      apiClient
        .post<ApiResponse<unknown>>('/auth/2fa/disable', { code })
        .then((r) => r.data),
  });
}

// ── Device / session hooks ────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';

export function useDevices() {
  return useQuery({
    queryKey: ['auth', 'devices'],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Device[]>>('/auth/devices')
        .then((r) => r.data),
  });
}

export function useRevokeDevice() {
  return useMutation({
    mutationFn: (deviceId: string) =>
      apiClient
        .delete<ApiResponse<unknown>>(`/auth/devices/${deviceId}`)
        .then((r) => r.data),
  });
}

export function useRevokeAllDevices() {
  return useMutation({
    mutationFn: () =>
      apiClient
        .delete<ApiResponse<unknown>>('/auth/devices')
        .then((r) => r.data),
  });
}

interface Device {
  id: string;
  device_name: string;
  browser: string;
  os: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
}
