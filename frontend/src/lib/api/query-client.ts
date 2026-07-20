import { QueryClient } from '@tanstack/react-query';
import { VelontriApiError } from '@/types/api';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,         // 1 min
        gcTime:    300_000,        // 5 min
        retry: (count, error) => {
          if (error instanceof VelontriApiError) {
            return count < 2 && error.isRetryable;
          }
          return count < 2;
        },
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
