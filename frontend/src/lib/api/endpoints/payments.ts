import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  provider: string;
  last4: string;
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  created_at: string;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
  payment_method_id?: string;
}

export const paymentsApi = {
  getPaymentMethods() {
    return apiClient
      .get<ApiResponse<PaymentMethod[]>>('/payments/methods')
      .then((r) => r.data);
  },

  addPaymentMethod(data: { payment_method_token: string }) {
    return apiClient
      .post<ApiResponse<PaymentMethod>>('/payments/methods', data)
      .then((r) => r.data);
  },

  deletePaymentMethod(id: string) {
    return apiClient
      .delete<ApiResponse<unknown>>(`/payments/methods/${id}`)
      .then((r) => r.data);
  },

  setDefaultPaymentMethod(id: string) {
    return apiClient
      .post<ApiResponse<PaymentMethod>>(`/payments/methods/${id}/default`, {})
      .then((r) => r.data);
  },

  createPaymentIntent(data: CreatePaymentIntentRequest) {
    return apiClient
      .post<ApiResponse<{ client_secret: string; payment_intent_id: string }>>(
        '/payments/intents',
        data,
      )
      .then((r) => r.data);
  },

  getTransactions(params: { page?: number; page_size?: number } = {}) {
    return apiClient
      .get<ApiResponse<Transaction[]>>('/payments/transactions', { params })
      .then((r) => r.data);
  },
};

export const paymentKeys = {
  all: ['payments'] as const,
  methods: () => [...paymentKeys.all, 'methods'] as const,
  transactions: (params?: object) => [...paymentKeys.all, 'transactions', params] as const,
};
