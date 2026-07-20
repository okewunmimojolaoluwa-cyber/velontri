import { describe, it, expect } from 'vitest';
import { parseJwtPayload, isTokenExpired } from '@/lib/auth/jwt';

const SAMPLE_PAYLOAD = {
  sub: 'user-123',
  roles: ['buyer', 'seller'],
  subscription_tier: 'professional',
  branch_ids: [],
  country_code: 'NG',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};

function encodePayload(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${body}.signature`;
}

describe('parseJwtPayload', () => {
  it('parses valid JWT payload', () => {
    const token = encodePayload(SAMPLE_PAYLOAD);
    const result = parseJwtPayload(token);
    expect(result?.sub).toBe('user-123');
    expect(result?.roles).toContain('buyer');
  });

  it('returns null for invalid token', () => {
    expect(parseJwtPayload('invalid')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('returns false for valid token', () => {
    const token = encodePayload(SAMPLE_PAYLOAD);
    const payload = parseJwtPayload(token)!;
    expect(isTokenExpired(payload)).toBe(false);
  });

  it('returns true for expired token', () => {
    const expired = { ...SAMPLE_PAYLOAD, exp: Math.floor(Date.now() / 1000) - 10 };
    const payload = parseJwtPayload(encodePayload(expired))!;
    expect(isTokenExpired(payload)).toBe(true);
  });
});
