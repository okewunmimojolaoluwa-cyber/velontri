import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canCreateListing,
  hasTierFeature,
} from '@/lib/rbac/permissions';

describe('RBAC permissions', () => {
  it('buyer can initiate payments', () => {
    expect(hasPermission(['buyer'], 'payments:initiate')).toBe(true);
  });

  it('guest cannot create listings', () => {
    expect(canCreateListing(['guest'])).toBe(false);
  });

  it('seller can create listings', () => {
    expect(canCreateListing(['seller'])).toBe(true);
  });

  it('professional tier has ai_search', () => {
    expect(hasTierFeature('professional', 'ai_search')).toBe(true);
  });

  it('starter tier lacks ai_bi', () => {
    expect(hasTierFeature('starter', 'ai_bi')).toBe(false);
  });
});
