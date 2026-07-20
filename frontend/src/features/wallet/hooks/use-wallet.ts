import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi, walletKeys } from '@/lib/api/endpoints';

export function useWalletBalance() {
  return useQuery({
    queryKey: walletKeys.balance(),
    queryFn: () => walletApi.getBalance(),
  });
}

export function useWalletTransactions(params: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: walletKeys.transactions(params),
    queryFn: () => walletApi.getTransactions(params),
  });
}

export function useFundWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { amount: number; currency: string; payment_method: 'card' | 'bank_transfer' | 'ussd' }) =>
      walletApi.fund(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      queryClient.invalidateQueries({ queryKey: walletKeys.transactions() });
    },
  });
}

export function useTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { recipient_id: string; amount: number; currency: string; note?: string }) =>
      walletApi.transfer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      queryClient.invalidateQueries({ queryKey: walletKeys.transactions() });
    },
  });
}

export function useWithdraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { amount: number; currency: string; bank_account_id: string }) =>
      walletApi.withdraw(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      queryClient.invalidateQueries({ queryKey: walletKeys.transactions() });
    },
  });
}
