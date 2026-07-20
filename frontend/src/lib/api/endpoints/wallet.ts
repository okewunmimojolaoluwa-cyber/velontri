import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface WalletBalance {
  wallet_id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  ledger_balance: number;
  escrow_balance: number;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created_at: string;
}

export interface FundWalletRequest {
  amount: number;
  currency: string;
  payment_method: 'card' | 'bank_transfer' | 'ussd';
}

export interface TransferRequest {
  recipient_id: string;
  amount: number;
  currency: string;
  note?: string;
}

export const walletApi = {
  getBalance() {
    return apiClient
      .get<ApiResponse<WalletBalance>>('/wallet/balance')
      .then((r) => r.data);
  },

  getTransactions(params: { page?: number; page_size?: number } = {}) {
    return apiClient
      .get<ApiResponse<WalletTransaction[]>>('/wallet/transactions', { params })
      .then((r) => r.data);
  },

  fund(data: FundWalletRequest) {
    return apiClient
      .post<ApiResponse<{ payment_url: string; reference: string }>>('/wallet/fund', data)
      .then((r) => r.data);
  },

  transfer(data: TransferRequest) {
    return apiClient
      .post<ApiResponse<{ transaction_id: string }>>('/wallet/transfer', data)
      .then((r) => r.data);
  },

  withdraw(data: { amount: number; currency: string; bank_account_id: string }) {
    return apiClient
      .post<ApiResponse<{ transaction_id: string }>>('/wallet/withdraw', data)
      .then((r) => r.data);
  },
};

export const walletKeys = {
  all: ['wallet'] as const,
  balance: () => [...walletKeys.all, 'balance'] as const,
  transactions: (params?: object) => [...walletKeys.all, 'transactions', params] as const,
};

/** Call this with session.userId to scope keys per user */
export function walletUserKeys(userId: string) {
  return {
    all:          [userId, 'wallet'] as const,
    balance:      () => [userId, 'wallet', 'balance'] as const,
    transactions: (params?: object) => [userId, 'wallet', 'transactions', params] as const,
  };
}
