import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface SubscriptionTier {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: Record<string, string | number | boolean>;
  listing_limit: number;
  ai_credits: number;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export const subscriptionsApi = {
  getTiers() {
    return apiClient
      .get<ApiResponse<SubscriptionTier[]>>('/subscriptions/tiers')
      .then((r) => r.data);
  },

  getMySubscription() {
    return apiClient
      .get<ApiResponse<Subscription>>('/subscriptions/my')
      .then((r) => r.data);
  },

  subscribe(tierId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') {
    return apiClient
      .post<ApiResponse<{ payment_url: string; subscription_id: string }>>(
        '/subscriptions/subscribe',
        { tier_id: tierId, billing_cycle: billingCycle },
      )
      .then((r) => r.data);
  },

  cancel() {
    return apiClient
      .post<ApiResponse<unknown>>('/subscriptions/cancel', {})
      .then((r) => r.data);
  },
};

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  tiers: () => [...subscriptionKeys.all, 'tiers'] as const,
  my: () => [...subscriptionKeys.all, 'my'] as const,
};
