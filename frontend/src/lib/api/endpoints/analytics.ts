import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface AnalyticsMetric {
  name: string;
  value: number;
  change_percent?: number;
  period: string;
}

export interface SalesData {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  id: string;
  title: string;
  sales: number;
  revenue: number;
}

export const analyticsApi = {
  getDashboardMetrics(period: '7d' | '30d' | '90d' = '30d') {
    return apiClient
      .get<ApiResponse<AnalyticsMetric[]>>('/analytics/dashboard', { params: { period } })
      .then((r) => r.data);
  },

  getSalesChart(period: '7d' | '30d' | '90d' = '30d') {
    return apiClient
      .get<ApiResponse<SalesData[]>>('/analytics/sales', { params: { period } })
      .then((r) => r.data);
  },

  getTopProducts(limit: number = 10) {
    return apiClient
      .get<ApiResponse<TopProduct[]>>('/analytics/top-products', { params: { limit } })
      .then((r) => r.data);
  },

  getCustomerMetrics() {
    return apiClient
      .get<ApiResponse<{ total_customers: number; new_customers: number; returning_customers: number }>>(
        '/analytics/customers',
      )
      .then((r) => r.data);
  },

  exportReport(type: 'sales' | 'inventory' | 'customers', format: 'csv' | 'pdf' = 'csv') {
    return apiClient
      .get<Blob>(`/analytics/export/${type}`, { 
        params: { format },
        responseType: 'blob',
      })
      .then((r) => r.data);
  },
};

export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: (period: string) => [...analyticsKeys.all, 'dashboard', period] as const,
  sales: (period: string) => [...analyticsKeys.all, 'sales', period] as const,
  topProducts: (limit: number) => [...analyticsKeys.all, 'top-products', limit] as const,
  customers: () => [...analyticsKeys.all, 'customers'] as const,
};
