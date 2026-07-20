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
    onSuccess: (res) => {
      // After verification, tokens are returned
      if (res.data.tokens) {
        const tokens = res.data.tokens;
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
    mutationFn: (userId: string) =>
      authApi.verifyPhone(userId, '000000'), // Backend handles resend via special OTP
  });
}
