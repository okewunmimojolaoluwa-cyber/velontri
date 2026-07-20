import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { siteConfig } from '@/config/site';
import { getAccessToken } from '@/lib/auth/token-refresh';
import { setupResponseInterceptor } from '@/lib/api/interceptors';

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: siteConfig.apiUrl,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  });

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Request-ID'] = crypto.randomUUID();
    return config;
  });

  setupResponseInterceptor(client);

  return client;
}

export const apiClient = createApiClient();
