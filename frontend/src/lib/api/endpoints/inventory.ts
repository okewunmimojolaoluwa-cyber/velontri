import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  unit_price: number;
  currency: string;
  location?: string;
  branch_id?: string;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface StockTransfer {
  id: string;
  from_branch_id: string;
  to_branch_id: string;
  item_id: string;
  quantity: number;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  created_at: string;
}

export interface CreateItemRequest {
  sku: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  unit_price: number;
  currency: string;
  location?: string;
  branch_id?: string;
  low_stock_threshold?: number;
}

export const inventoryApi = {
  getItems(params: { page?: number; page_size?: number; branch_id?: string; category?: string } = {}) {
    return apiClient
      .get<ApiResponse<InventoryItem[]>>('/inventory/items', { params })
      .then((r) => r.data);
  },

  getItem(id: string) {
    return apiClient
      .get<ApiResponse<InventoryItem>>(`/inventory/items/${id}`)
      .then((r) => r.data);
  },

  createItem(data: CreateItemRequest) {
    return apiClient
      .post<ApiResponse<InventoryItem>>('/inventory/items', data)
      .then((r) => r.data);
  },

  updateItem(id: string, data: Partial<CreateItemRequest>) {
    return apiClient
      .patch<ApiResponse<InventoryItem>>(`/inventory/items/${id}`, data)
      .then((r) => r.data);
  },

  deleteItem(id: string) {
    return apiClient
      .delete<ApiResponse<unknown>>(`/inventory/items/${id}`)
      .then((r) => r.data);
  },

  adjustStock(id: string, data: { quantity: number; reason: string }) {
    return apiClient
      .post<ApiResponse<InventoryItem>>(`/inventory/items/${id}/adjust`, data)
      .then((r) => r.data);
  },

  getTransfers(params: { page?: number; page_size?: number } = {}) {
    return apiClient
      .get<ApiResponse<StockTransfer[]>>('/inventory/transfers', { params })
      .then((r) => r.data);
  },

  createTransfer(data: { from_branch_id: string; to_branch_id: string; item_id: string; quantity: number }) {
    return apiClient
      .post<ApiResponse<StockTransfer>>('/inventory/transfers', data)
      .then((r) => r.data);
  },
};

export const inventoryKeys = {
  all: ['inventory'] as const,
  items: (params?: object) => [...inventoryKeys.all, 'items', params] as const,
  item: (id: string) => [...inventoryKeys.all, 'item', id] as const,
  transfers: (params?: object) => [...inventoryKeys.all, 'transfers', params] as const,
};
