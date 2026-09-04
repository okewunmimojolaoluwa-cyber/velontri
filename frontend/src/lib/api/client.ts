import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { siteConfig } from '@/config/site';
import { getAccessToken } from '@/lib/auth/token-refresh';
import { setupResponseInterceptor } from '@/lib/api/interceptors';

export function createApiClient(): AxiosInstance {
 const client = axios.create({
 baseURL: siteConfig.apiUrl,
 timeout: 30_000, // Reduced from 60s to 30s for faster failures
 headers: { 
   'Content-Type': 'application/json',
   'Accept-Encoding': 'gzip, deflate, br', // Enable compression
 },
 withCredentials: false, // Changed to false - we use Bearer tokens, not cookies
 // Enable HTTP/2 and connection reuse
 maxRedirects: 3,
 validateStatus: (status) => status < 500, // Don't retry on 4xx errors
 });

 client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
 const token = getAccessToken();
 if (token) {
 config.headers.Authorization = `Bearer ${token}`;
 }
 config.headers['X-Request-ID'] = crypto.randomUUID();
 
 // Add cache-control hints for GET requests
 if (config.method === 'get') {
   config.headers['Cache-Control'] = 'public, max-age=60';
 }
 
 return config;
 });

 setupResponseInterceptor(client);

 return client;
}

export const apiClient = createApiClient();
