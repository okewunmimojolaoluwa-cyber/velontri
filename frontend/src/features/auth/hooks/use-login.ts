import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/endpoints';
import { setTokens, clearTokens } from '@/lib/auth/token-refresh';
import { useAuth } from '../auth-provider';
import { ROUTES } from '@/config/routes';
import type { LoginRequest } from '@/types/auth';

export function useLogin() {
  const { setSessionFromToken, clearSession } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (res) => {
      const tokens = res.data.tokens;
      setTokens(tokens.access_token, tokens.refresh_token);
      setSessionFromToken(tokens.access_token);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: () => {
      clearTokens();
      clearSession();
    },
  });
}
