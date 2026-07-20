import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface Shipment {
  id: string;
  order_id: string;
  tracking_number: string;
  carrier: string;
  status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  origin_address: string;
  destination_address: string;
  estimated_delivery?: string;
  actual_delivery?: string;
  tracking_events: TrackingEvent[];
  created_at: string;
}

export interface TrackingEvent {
  timestamp: string;
  status: string;
  location?: string;
  description: string;
}

export interface CreateShipmentRequest {
  order_id: string;
  carrier: string;
  origin_address: string;
  destination_address: string;
}

export const logisticsApi = {
  getShipments(params: { page?: number; page_size?: number; order_id?: string } = {}) {
    return apiClient
      .get<ApiResponse<Shipment[]>>('/logistics/shipments', { params })
      .then((r) => r.data);
  },

  getShipment(id: string) {
    return apiClient
      .get<ApiResponse<Shipment>>(`/logistics/shipments/${id}`)
      .then((r) => r.data);
  },

  trackShipment(trackingNumber: string) {
    return apiClient
      .get<ApiResponse<Shipment>>('/logistics/track', { params: { tracking_number: trackingNumber } })
      .then((r) => r.data);
  },

  createShipment(data: CreateShipmentRequest) {
    return apiClient
      .post<ApiResponse<Shipment>>('/logistics/shipments', data)
      .then((r) => r.data);
  },

  getCarriers() {
    return apiClient
      .get<ApiResponse<{ id: string; name: string; service_level: string }[]>>('/logistics/carriers')
      .then((r) => r.data);
  },
};

export const logisticsKeys = {
  all: ['logistics'] as const,
  shipments: (params?: object) => [...logisticsKeys.all, 'shipments', params] as const,
  shipment: (id: string) => [...logisticsKeys.all, 'shipment', id] as const,
  tracking: (trackingNumber: string) => [...logisticsKeys.all, 'tracking', trackingNumber] as const,
};
