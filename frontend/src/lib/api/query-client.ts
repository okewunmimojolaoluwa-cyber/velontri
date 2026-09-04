import { QueryClient } from '@tanstack/react-query';
import { VelontriApiError } from '@/types/api';

export function createQueryClient(): QueryClient {
 return new QueryClient({
 defaultOptions: {
 queries: {
 // AGGRESSIVE CACHING for fast perceived performance
 staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
 gcTime: 30 * 60 * 1000, // 30 minutes - keep in memory longer
 
 // Fast retry logic - fail fast for immediate user feedback
 retry: 1, // Only retry once
 retryDelay: 500, // 500ms between retries
 
 // Background refetching for seamless updates
 refetchOnWindowFocus: true,
 refetchOnReconnect: true,
 refetchOnMount: false, // Don't refetch if data is fresh
 
 // CRITICAL: Always use network for initial load, then cache
 networkMode: 'online', // Changed from offlineFirst to ensure fresh data loads
 },
 mutations: {
 retry: 0, // Never retry mutations
 networkMode: 'online', // Mutations require network
 },
 },
 });
}
