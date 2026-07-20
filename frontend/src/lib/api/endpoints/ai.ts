import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIResponse {
  answer: string;
  sources?: string[];
  confidence?: number;
}

export interface ListingSuggestion {
  title: string;
  description: string;
  suggested_price?: number;
  category?: string;
}

export const aiApi = {
  chat(messages: AIChatMessage[]) {
    return apiClient
      .post<ApiResponse<AIResponse>>('/ai/chat', { messages })
      .then((r) => r.data);
  },

  generateListingDescription(data: { title: string; category: string; features: string[] }) {
    return apiClient
      .post<ApiResponse<{ description: string }>>('/ai/listing/description', data)
      .then((r) => r.data);
  },

  suggestListingPrice(data: { title: string; category: string; condition?: string }) {
    return apiClient
      .post<ApiResponse<{ suggested_price: number; currency: string; range: { min: number; max: number } }>>(
        '/ai/listing/price',
        data,
      )
      .then((r) => r.data);
  },

  optimizeListing(listingId: string) {
    return apiClient
      .post<ApiResponse<ListingSuggestion>>(`/ai/listing/${listingId}/optimize`, {})
      .then((r) => r.data);
  },

  getInsights(params: { period: '7d' | '30d' | '90d' } = { period: '30d' }) {
    return apiClient
      .get<ApiResponse<{ 
        trending_categories: string[];
        price_recommendations: Record<string, number>;
        demand_forecast: Record<string, number>;
      }>>('/ai/insights', { params })
      .then((r) => r.data);
  },
};

export const aiKeys = {
  all: ['ai'] as const,
  insights: (period: string) => [...aiKeys.all, 'insights', period] as const,
};
