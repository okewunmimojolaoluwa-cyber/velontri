import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/endpoints';
import { setTokens, clearTokens } from '@/lib/auth/token-refresh';
import { useAuth } from '../auth-provider';

export function useVerifyPhone() {
  const { setSessionFromToken, clearSession } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, otp }: { userId: string; otp: string }) =>
      authApi.verifyPhone(userId, otp),
    onSuccess: (res: any) => {
      // Backend now returns tokens after successful email verification for auto-login
      const tokens = res?.data?.tokens;
      if (tokens?.access_token && tokens?.refresh_token) {
        setTokens(tokens.access_token, tokens.refresh_token);
        setSessionFromToken(tokens.access_token);
      }
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: () => {
      clearTokens();
      clearSession();
    },
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (userId: string) => authApi.resendOtp(userId),
  });
}
