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
      .post<ApiResponse<ListingSummary>>('/listings', data, {
        timeout: 60_000, // listing creation can be slow on cold DB connections
      })
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
      .post<ApiResponse<unknown>>(`/listings/${id}/publish`, {}, {
        timeout: 60_000,
      })
      .then((r) => r.data);
  },

  /** Upload a listing image as multipart (avoids sending huge base64 in JSON). */
  uploadImage(listingId: string, dataUrl: string): Promise<ApiResponse<{ s3_key: string }>> {
    // Convert data URL → Blob → File
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const bstr = atob(arr[1]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    const blob = new Blob([u8], { type: mime });
    const ext = mime.split('/')[1] ?? 'jpg';
    const file = new File([blob], `listing_image.${ext}`, { type: mime });

    const fd = new FormData();
    fd.append('file', file);

    return apiClient
      .post<ApiResponse<{ s3_key: string }>>(`/listings/${listingId}/images`, fd, {
        timeout: 60_000, // images can take longer
      })
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
