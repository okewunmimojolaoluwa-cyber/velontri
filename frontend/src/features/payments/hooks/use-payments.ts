import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, paymentKeys } from '@/lib/api/endpoints';

export function usePaymentMethods() {
  return useQuery({
    queryKey: paymentKeys.methods(),
    queryFn: () => paymentsApi.getPaymentMethods(),
  });
}

export function useAddPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { payment_method_token: string }) => paymentsApi.addPaymentMethod(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentsApi.deletePaymentMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentsApi.setDefaultPaymentMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: (data: { amount: number; currency: string; payment_method_id?: string }) =>
      paymentsApi.createPaymentIntent(data),
  });
}

export function useTransactions(params: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: paymentKeys.transactions(params),
    queryFn: () => paymentsApi.getTransactions(params),
  });
}
