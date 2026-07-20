import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type { ListingSummary } from './listings';

export interface CreateListingRequest {
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  listing_type: 'physical' | 'digital' | 'service' | 'job' | 'property' | 'vehicle';
  city?: string;
  state?: string;
  country?: string;
  condition?: string;
  image_url?: string;
  whatsapp_number?: string;
  contact_phone?: string;
}

export interface SellerStats {
  total_listings: number;
  active_listings: number;
  total_views: number;
  total_sales: number;
  revenue: number;
  currency: string;
}

export const sellerApi = {
  getMyListings(params: { page?: number; page_size?: number; status?: string } = {}) {
    return apiClient
      .get<ApiResponse<ListingSummary[]>>('/listings/my', { params })
      .then((r) => r.data);
  },

  createListing(data: CreateListingRequest) {
    return apiClient
      .post<ApiResponse<ListingSummary>>('/listings', data)
      .then((r) => r.data);
  },

  updateListing(id: string, data: Partial<CreateListingRequest>) {
    return apiClient
      .patch<ApiResponse<ListingSummary>>(`/listings/${id}`, data)
      .then((r) => r.data);
  },

  deleteListing(id: string) {
    return apiClient
      .delete<ApiResponse<unknown>>(`/listings/${id}`)
      .then((r) => r.data);
  },

  publishListing(id: string) {
    return apiClient
      .post<ApiResponse<unknown>>(`/listings/${id}/publish`, {})
      .then((r) => r.data);
  },

  getStats() {
    return apiClient
      .get<ApiResponse<SellerStats>>('/analytics/seller/stats')
      .then((r) => r.data);
  },
};

export const sellerKeys = {
  all: ['seller'] as const,
  listings: (params?: object) => [...sellerKeys.all, 'listings', params] as const,
  stats: () => [...sellerKeys.all, 'stats'] as const,
};

/** Call this with session.userId to scope keys per user */
export function sellerUserKeys(userId: string) {
  return {
    all:      [userId, 'seller'] as const,
    listings: (params?: object) => [userId, 'seller', 'listings', params] as const,
    stats:    () => [userId, 'seller', 'stats'] as const,
  };
}
