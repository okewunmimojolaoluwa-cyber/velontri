import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  total_orders: number;
  total_spent: number;
  currency: string;
  last_order_date?: string;
  status: 'active' | 'inactive' | 'blocked';
  tags: string[];
  created_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface CreateCustomerRequest {
  name: string;
  email: string;
  phone: string;
  tags?: string[];
}

export const crmApi = {
  getCustomers(params: { 
    page?: number; 
    page_size?: number; 
    search?: string; 
    status?: string; 
    tag?: string 
  } = {}) {
    return apiClient
      .get<ApiResponse<Customer[]>>('/crm/customers', { params })
      .then((r) => r.data);
  },

  getCustomer(id: string) {
    return apiClient
      .get<ApiResponse<Customer>>(`/crm/customers/${id}`)
      .then((r) => r.data);
  },

  createCustomer(data: CreateCustomerRequest) {
    return apiClient
      .post<ApiResponse<Customer>>('/crm/customers', data)
      .then((r) => r.data);
  },

  updateCustomer(id: string, data: Partial<CreateCustomerRequest>) {
    return apiClient
      .patch<ApiResponse<Customer>>(`/crm/customers/${id}`, data)
      .then((r) => r.data);
  },

  getNotes(customerId: string) {
    return apiClient
      .get<ApiResponse<CustomerNote[]>>(`/crm/customers/${customerId}/notes`)
      .then((r) => r.data);
  },

  addNote(customerId: string, data: { content: string }) {
    return apiClient
      .post<ApiResponse<CustomerNote>>(`/crm/customers/${customerId}/notes`, data)
      .then((r) => r.data);
  },

  getTags() {
    return apiClient
      .get<ApiResponse<string[]>>('/crm/tags')
      .then((r) => r.data);
  },
};

export const crmKeys = {
  all: ['crm'] as const,
  customers: (params?: object) => [...crmKeys.all, 'customers', params] as const,
  customer: (id: string) => [...crmKeys.all, 'customer', id] as const,
  notes: (customerId: string) => [...crmKeys.all, 'notes', customerId] as const,
  tags: () => [...crmKeys.all, 'tags'] as const,
};
