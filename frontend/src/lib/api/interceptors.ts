import type { AxiosInstance, AxiosError } from 'axios';
import { VelontriApiError, type ApiErrorResponse } from '@/types/api';
import { clearTokens, refreshTokenSingleFlight, setTokens } from '@/lib/auth/token-refresh';
import { siteConfig } from '@/config/site';

export function setupResponseInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorResponse>) => {
      const status = error.response?.status ?? 0;
      const body   = error.response?.data;
      const code   = body?.error?.code ?? 'INTERNAL_ERROR';
      const msg    = body?.error?.message ?? error.message ?? 'Request failed';
      const field  = body?.error?.field ?? null;
      const reqId  = body?.request_id;

      // Attempt transparent token refresh on TOKEN_EXPIRED or UNAUTHORIZED
      if ((code === 'TOKEN_EXPIRED' || (status === 401 && code !== 'TOKEN_INVALID')) && !(error.config as any)._retry) {
        (error.config as any)._retry = true;
        const newToken = await refreshTokenSingleFlight(siteConfig.apiUrl);
        if (newToken && error.config) {
          error.config.headers = {
            ...(error.config.headers as Record<string, string>),
            Authorization: `Bearer ${newToken}`,
          };
          return client.request(error.config);
        }
        // Refresh failed — redirect to login
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
      }

      if (code === 'TOKEN_INVALID') {
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      throw new VelontriApiError(code, msg, status, field, reqId);
    },
  );
}
