import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/endpoints';
import { clearTokens } from '@/lib/auth/token-refresh';
import { useAuth } from '../auth-provider';

export function useLogout() {
  const { clearSession } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return;
      await authApi.logout(refreshToken);
    },
    onSuccess: () => {
      clearTokens();
      clearSession();
      queryClient.clear();
      window.location.href = '/';
    },
  });
}
