import { QueryClient } from '@tanstack/react-query';
import { VelontriApiError } from '@/types/api';

export function createQueryClient(): QueryClient {
 return new QueryClient({
 defaultOptions: {
 queries: {
 // AGGRESSIVE CACHING for fast perceived performance
 staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
 gcTime: 30 * 60 * 1000, // 30 minutes - keep in memory longer
 
 // Smart retry logic
 retry: (count, error) => {
 if (error instanceof VelontriApiError) {
   return count < 1 && error.isRetryable; // Only retry once
 }
 return count < 1; // Fail fast on network errors
 },
 
 // Background refetching for seamless updates
 refetchOnWindowFocus: true,
 refetchOnReconnect: true,
 refetchOnMount: false, // Don't refetch if data is fresh
 
 // Network waterfall optimization
 networkMode: 'offlineFirst', // Use cache-first strategy
 },
 mutations: {
 retry: 0, // Never retry mutations
 networkMode: 'online', // Mutations require network
 },
 },
 });
}
