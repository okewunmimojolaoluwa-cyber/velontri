# Velontri Error Catalog

All API errors follow a consistent envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "field": "field_name_or_null"
  },
  "request_id": "uuid-for-support"
}
```

Include `X-Request-ID` in requests to correlate errors with backend logs.

---

## Error Code Reference

### Authentication Errors

| Code | HTTP | Description | Frontend Action | Retry? |
|---|---|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email/phone or password | Show "Invalid credentials" | No |
| `TOKEN_EXPIRED` | 401 | Access token has expired (>15 min) | Call `POST /api/v1/auth/token/refresh`, then retry | Yes, once |
| `TOKEN_INVALID` | 401 | Malformed, tampered, or wrong algorithm JWT | Clear tokens, redirect to login | No |
| `ACCOUNT_LOCKED` | 403 | Too many failed login attempts (>5 in 15 min) | Show "Account locked. Try again in 15 minutes." | After delay |
| `ACCOUNT_INACTIVE` | 403 | Account disabled by admin | Show "Account suspended. Contact support." | No |
| `PHONE_NOT_VERIFIED` | 403 | Phone not verified after registration | Redirect to phone verification screen | No |
| `OTP_EXPIRED` | 400 | OTP code is older than 10 minutes | Prompt to resend OTP | No |
| `OTP_INVALID` | 400 | Incorrect OTP entered | Show field error, allow retry | Up to 5x |
| `DEVICE_NOT_FOUND` | 404 | Device ID not found for revocation | Refresh device list | No |
| `UNAUTHORIZED` | 401 | Request requires authentication | Redirect to login | No |

**Token refresh flow:**
```javascript
async function apiCall(url, options) {
  let res = await fetch(url, withAuth(options));
  if (res.status === 401) {
    const body = await res.json();
    if (body.error?.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return fetch(url, withAuth(options)); // retry once
      }
    }
    redirectToLogin();
  }
  return res;
}
```

---

### Resource Errors

| Code | HTTP | Description | Frontend Action | Retry? |
|---|---|---|---|---|
| `NOT_FOUND` | 404 | Requested resource does not exist | Show 404 component or "Not found" message | No |
| `ALREADY_EXISTS` | 409 | Duplicate (e.g. email already registered) | Show field error: "Already in use" | No |
| `CONFLICT` | 409 | State conflict (e.g. booking already cancelled) | Refresh state and show updated status | No |

---

### Permission Errors

| Code | HTTP | Description | Frontend Action | Retry? |
|---|---|---|---|---|
| `FORBIDDEN` | 403 | Authenticated but lacks required role/ownership | Show "You don't have permission" | No |
| `INSUFFICIENT_SCOPE` | 403 | Token scope does not include required permission | Show permission error, offer upgrade | No |
| `FEATURE_NOT_AVAILABLE` | 403 | Feature not available on user's subscription tier | Show upgrade prompt | No |

---

### Validation Errors

| Code | HTTP | Description | Frontend Action | Retry? |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 422 | Pydantic schema validation failed | Show `error.field` on the failing input | After fix |
| `INVALID_INPUT` | 400 | Business logic validation failed | Show `error.message` inline | After fix |

**Validation error handling:**
```javascript
if (error.code === 'VALIDATION_ERROR' && error.field) {
  setFieldError(error.field, error.message);
} else if (error.code === 'INVALID_INPUT') {
  setFormError(error.message);
}
```

**Common validation fields:**
- `email` — Invalid format or already registered
- `phone` — Must be E.164 format (+2348012345678)
- `password` — Min 8 chars, uppercase, lowercase, digit, special char
- `country_code` — Must be 2-letter ISO 3166-1 alpha-2
- `amount` — Must be positive, max 2 decimal places
- `identifier` — Login field (email or phone)

---

### Payment & Wallet Errors

| Code | HTTP | Description | Frontend Action | Retry? |
|---|---|---|---|---|
| `INSUFFICIENT_FUNDS` | 422 | Wallet balance too low | Show balance and "Top up wallet" CTA | After top-up |
| `PAYMENT_FAILED` | 422 | Gateway payment processing failed | Show gateway error message, offer retry | Yes |
| `ESCROW_ALREADY_RELEASED` | 409 | Escrow already confirmed/released | Refresh payment status | No |
| `DISPUTE_WINDOW_CLOSED` | 409 | Past the 48-hour dispute window | Show "Dispute window closed" | No |

---

### Subscription / Quota Errors

| Code | HTTP | Description | Frontend Action | Retry? |
|---|---|---|---|---|
| `QUOTA_EXCEEDED` | 429 | Rate limit hit (API) OR subscription listing quota | Check `Retry-After` header; show upgrade prompt | After delay |
| `FEATURE_NOT_AVAILABLE` | 403 | Feature locked to higher tier | Show tier comparison and upgrade CTA | No |

**Distinguishing rate limit vs quota:**
```javascript
if (error.code === 'QUOTA_EXCEEDED') {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    showRetryTimer(retryAfter);  // API rate limit
  } else {
    showUpgradePrompt();          // Subscription quota
  }
}
```

---

### External Service Errors

| Code | HTTP | Description | Frontend Action | Retry? |
|---|---|---|---|---|
| `EXTERNAL_SERVICE_ERROR` | 502 | Third-party API (payment gateway, SMS) failed | Show "Service temporarily unavailable. Try again." | After 10s |
| `GATEWAY_TIMEOUT` | 504 | Upstream service timed out | Show timeout error, offer retry | Yes, 1x |

---

### Server Errors

| Code | HTTP | Description | Frontend Action | Retry? |
|---|---|---|---|---|
| `INTERNAL_ERROR` | 500 | Unexpected server exception | Show generic error, include `request_id` for support | Yes, 1x |
| `SERVICE_UNAVAILABLE` | 503 | Service is starting up or in maintenance | Show maintenance page or retry with exponential backoff | Exponential |

---

## Retry Strategy

| Error Type | Strategy |
|---|---|
| `TOKEN_EXPIRED` | Refresh token immediately, retry once |
| `PAYMENT_FAILED` | Wait 3s, retry once. Second failure → show error |
| `EXTERNAL_SERVICE_ERROR` | Wait 10s, retry once |
| `GATEWAY_TIMEOUT` | Wait 5s, retry once |
| `INTERNAL_ERROR` | Wait 2s, retry once |
| `SERVICE_UNAVAILABLE` | Exponential backoff: 1s, 2s, 4s, 8s (max 4 attempts) |
| `QUOTA_EXCEEDED` (rate limit) | Wait for `Retry-After` header value |
| All auth errors | No retry (user action required) |
| All validation errors | No retry (user input required) |

**Generic retry utility:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options = { maxAttempts: 2, delayMs: 2000 }
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const retryable = ['INTERNAL_ERROR', 'GATEWAY_TIMEOUT', 'EXTERNAL_SERVICE_ERROR'];
      if (attempt === options.maxAttempts || !retryable.includes(err.code)) throw err;
      await new Promise(r => setTimeout(r, options.delayMs * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## HTTP Status Code Summary

| HTTP Status | Codes Used |
|---|---|
| 400 Bad Request | `INVALID_INPUT`, `OTP_EXPIRED`, `OTP_INVALID` |
| 401 Unauthorized | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_INVALID` |
| 403 Forbidden | `FORBIDDEN`, `ACCOUNT_LOCKED`, `ACCOUNT_INACTIVE`, `PHONE_NOT_VERIFIED`, `FEATURE_NOT_AVAILABLE`, `INSUFFICIENT_SCOPE` |
| 404 Not Found | `NOT_FOUND`, `DEVICE_NOT_FOUND` |
| 409 Conflict | `ALREADY_EXISTS`, `CONFLICT`, `ESCROW_ALREADY_RELEASED`, `DISPUTE_WINDOW_CLOSED` |
| 422 Unprocessable | `VALIDATION_ERROR`, `INSUFFICIENT_FUNDS`, `PAYMENT_FAILED` |
| 429 Too Many Requests | `QUOTA_EXCEEDED` |
| 500 Internal Server Error | `INTERNAL_ERROR` |
| 502 Bad Gateway | `EXTERNAL_SERVICE_ERROR` |
| 503 Service Unavailable | `SERVICE_UNAVAILABLE` |
| 504 Gateway Timeout | `GATEWAY_TIMEOUT` |

---

## Global Error Handler (TypeScript)

```typescript
interface VelontriError {
  code: string;
  message: string;
  field: string | null;
}

interface ErrorResponse {
  success: false;
  error: VelontriError;
  request_id: string;
}

async function handleApiError(response: Response): Promise<never> {
  const body: ErrorResponse = await response.json();
  const { code, message, field } = body.error;

  switch (code) {
    case 'TOKEN_EXPIRED':
      throw Object.assign(new Error(message), { code, retriable: true });
    case 'UNAUTHORIZED':
    case 'TOKEN_INVALID':
      clearAuthTokens();
      window.location.href = '/login';
      throw new Error('Redirecting to login');
    case 'FORBIDDEN':
    case 'ACCOUNT_LOCKED':
    case 'ACCOUNT_INACTIVE':
      throw Object.assign(new Error(message), { code, retriable: false });
    case 'VALIDATION_ERROR':
      throw Object.assign(new Error(message), { code, field, retriable: false });
    case 'INSUFFICIENT_FUNDS':
      throw Object.assign(new Error(message), { code, showTopUp: true });
    default:
      throw Object.assign(new Error(message), {
        code,
        requestId: body.request_id,
        retriable: ['INTERNAL_ERROR', 'GATEWAY_TIMEOUT', 'EXTERNAL_SERVICE_ERROR'].includes(code),
      });
  }
}
```
