import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  AuthTokens,
} from '@/types/auth';

/**
 * Generate a stable 32-char device fingerprint stored in localStorage.
 * The backend LoginRequest requires device_fingerprint (min 16 chars).
 */
function getDeviceFingerprint(): string {
  const KEY = 'velontri_dfp';
  if (typeof window === 'undefined') return 'ssr-placeholder-device-fp-0000';
  let fp = localStorage.getItem(KEY);
  if (!fp || fp.length < 16) {
    const raw = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency ?? 0,
    ].join('|');
    // djb2 hash → padded hex string (32 chars)
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
      h = (((h << 5) + h) ^ raw.charCodeAt(i)) >>> 0;
    }
    fp = h.toString(16).padStart(8, '0').repeat(4);
    localStorage.setItem(KEY, fp);
  }
  return fp;
}

export const authApi = {
  register(data: RegisterRequest) {
    return apiClient
      .post<ApiResponse<RegisterResponse>>('/auth/register', data)
      .then((r) => r.data);
  },

  verifyPhone(userId: string, otp: string) {
    return apiClient
      .post<ApiResponse<unknown>>('/auth/verify-phone', { user_id: userId, otp })
      .then((r) => r.data);
  },

  login(data: LoginRequest) {
    return apiClient
      .post<ApiResponse<LoginResponse>>('/auth/login', {
        identifier: data.identifier,
        password: data.password,
        device_fingerprint: data.device_fingerprint ?? getDeviceFingerprint(),
        user_agent: data.user_agent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      })
      .then((r) => r.data);
  },

  /**
   * Google / Apple OAuth login.
   * Pass the raw id_token from Google Identity Services.
   */
  googleLogin(idToken: string) {
    return apiClient
      .post<ApiResponse<LoginResponse>>('/auth/login/oauth', {
        provider: 'google',
        id_token: idToken,
        device_fingerprint: getDeviceFingerprint(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      })
      .then((r) => r.data);
  },

  refresh(refreshToken: string) {
    return apiClient
      .post<ApiResponse<AuthTokens>>('/auth/token/refresh', {
        refresh_token: refreshToken,
      })
      .then((r) => r.data);
  },

  logout(refreshToken: string) {
    return apiClient
      .post<ApiResponse<unknown>>('/auth/logout', { refresh_token: refreshToken })
      .then((r) => r.data);
  },

  introspect() {
    return apiClient
      .get<ApiResponse<Record<string, unknown>>>('/auth/introspect')
      .then((r) => r.data);
  },
};
