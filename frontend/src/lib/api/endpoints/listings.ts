import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface ListingSummary {
  id: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  listing_type: string;
  city?: string;
  state?: string;
  country?: string;
  image_url?: string;
  description?: string;
  condition?: string;
  status?: string;
  avg_rating?: number;
  review_count?: number;
  seller_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListingFilters {
  page?: number;
  page_size?: number;
  category?: string;
  listing_type?: string;
  city?: string;
  country?: string;
  min_price?: number;
  max_price?: number;
  condition?: string;
  q?: string;
  seller_id?: string;
}

export const listingsApi = {
  browse(filters: ListingFilters = {}) {
    return apiClient
      .get<ApiResponse<ListingSummary[]>>('/listings', { params: filters })
      .then((r) => r.data);
  },

  getById(id: string) {
    return apiClient
      .get<ApiResponse<ListingSummary>>(`/listings/${id}`)
      .then((r) => r.data);
  },
};

export const listingKeys = {
  all: ['listings'] as const,
  lists: () => [...listingKeys.all, 'list'] as const,
  list: (filters: ListingFilters) => [...listingKeys.lists(), filters] as const,
  detail: (id: string) => [...listingKeys.all, 'detail', id] as const,
};
