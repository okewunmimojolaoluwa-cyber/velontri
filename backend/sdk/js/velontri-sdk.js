/**
 * Velontri JavaScript/TypeScript SDK
 * Single-file SDK for all 14 Velontri microservices.
 *
 * @version 1.0.0
 * @author  Velontri Engineering
 *
 * Compatible with: Browser (ES2020+), Node.js 18+, React Native, bundlers.
 * TypeScript-ready: JSDoc types provide full IntelliSense.
 *
 * @example
 * // Quick start
 * const client = new VelontriClient({ baseUrl: 'https://api.velontri.com/api/v1' });
 * const { data } = await client.auth.login({ identifier: 'user@example.com', password: 'SecurePass1!' });
 * client.setTokens(data.tokens);
 */

// ── Types (JSDoc only — no runtime cost) ──────────────────────────────────────

/**
 * @typedef {Object} VelontriConfig
 * @property {string}  baseUrl       - API gateway base URL (e.g. https://api.velontri.com/api/v1)
 * @property {string}  [accessToken] - JWT access token (set after login)
 * @property {string}  [refreshToken] - JWT refresh token
 * @property {Function} [onTokenRefreshed] - Called after a successful token refresh
 * @property {Function} [onAuthExpired] - Called when refresh fails (redirect to login)
 * @property {boolean} [autoRefresh=true] - Automatically refresh expired tokens
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string}  message
 * @property {any}     data
 * @property {Object}  [meta]
 */

/**
 * @typedef {Object} ApiError
 * @property {boolean} success - Always false
 * @property {{ code: string, message: string, field: string|null }} error
 * @property {string}  request_id
 */

// ── VelontriError ─────────────────────────────────────────────────────────────

class VelontriError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {string|null} field
   * @param {number} status
   * @param {string} requestId
   */
  constructor(message, code, field = null, status = 0, requestId = '') {
    super(message);
    this.name = 'VelontriError';
    this.code = code;
    this.field = field;
    this.status = status;
    this.requestId = requestId;
    this.isRetryable = ['INTERNAL_ERROR', 'GATEWAY_TIMEOUT', 'EXTERNAL_SERVICE_ERROR'].includes(code);
    this.isAuthError = ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'UNAUTHORIZED'].includes(code);
  }
}

// ── Token store ───────────────────────────────────────────────────────────────

class TokenStore {
  constructor() {
    this._access = '';
    this._refresh = '';
  }

  get access() { return this._access; }
  get refresh() { return this._refresh; }

  set({ access_token, refresh_token }) {
    this._access  = access_token  || this._access;
    this._refresh = refresh_token || this._refresh;
  }

  clear() { this._access = ''; this._refresh = ''; }

  isExpiringSoon() {
    if (!this._access) return true;
    try {
      const [, payload] = this._access.split('.');
      const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return Date.now() / 1000 > exp - 60; // refresh if < 60s to expiry
    } catch {
      return true;
    }
  }
}

// ── HTTP core ─────────────────────────────────────────────────────────────────

class HttpClient {
  /**
   * @param {Object} opts
   * @param {TokenStore} opts.tokens
   * @param {Function} opts.onRefresh
   * @param {Function} opts.onAuthExpired
   * @param {boolean} opts.autoRefresh
   */
  constructor({ tokens, onRefresh, onAuthExpired, autoRefresh = true }) {
    this._tokens = tokens;
    this._onRefresh = onRefresh;
    this._onAuthExpired = onAuthExpired;
    this._autoRefresh = autoRefresh;
    this._refreshing = null; // deduplicate concurrent refresh calls
    this._interceptors = { request: [], response: [] };
  }

  /**
   * Add a request interceptor.
   * @param {Function} fn - Receives (url, options) and must return [url, options]
   */
  addRequestInterceptor(fn) { this._interceptors.request.push(fn); }

  /**
   * Add a response interceptor.
   * @param {Function} fn - Receives (response) and must return response
   */
  addResponseInterceptor(fn) { this._interceptors.response.push(fn); }

  /**
   * @param {string} url
   * @param {RequestInit & { skipAuth?: boolean, skipRefresh?: boolean }} options
   * @returns {Promise<ApiResponse>}
   */
  async request(url, options = {}) {
    const { skipAuth = false, skipRefresh = false, ...fetchOptions } = options;

    // Auto-refresh before request if token is expiring
    if (!skipAuth && !skipRefresh && this._autoRefresh && this._tokens.isExpiringSoon()) {
      await this._doRefresh();
    }

    // Build headers
    const headers = { 'Content-Type': 'application/json', ...fetchOptions.headers };
    if (!skipAuth && this._tokens.access) {
      headers['Authorization'] = `Bearer ${this._tokens.access}`;
    }

    let reqUrl = url;
    let reqOptions = { ...fetchOptions, headers };

    // Run request interceptors
    for (const fn of this._interceptors.request) {
      [reqUrl, reqOptions] = await fn(reqUrl, reqOptions);
    }

    let res = await fetch(reqUrl, reqOptions);

    // Run response interceptors
    for (const fn of this._interceptors.response) {
      res = await fn(res) || res;
    }

    // Handle 401 — try refresh once
    if (res.status === 401 && !skipRefresh && !skipAuth && this._autoRefresh) {
      const cloned = res.clone();
      const body = await cloned.json().catch(() => ({}));
      if (body?.error?.code === 'TOKEN_EXPIRED') {
        const refreshed = await this._doRefresh();
        if (refreshed) {
          // Retry with new token
          reqOptions.headers['Authorization'] = `Bearer ${this._tokens.access}`;
          res = await fetch(reqUrl, reqOptions);
        }
      }
    }

    return this._parseResponse(res);
  }

  async _doRefresh() {
    if (this._refreshing) return this._refreshing;
    this._refreshing = this._onRefresh().catch(() => {
      this._tokens.clear();
      this._onAuthExpired?.();
      return false;
    }).finally(() => { this._refreshing = null; });
    return this._refreshing;
  }

  async _parseResponse(res) {
    let body;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      const text = await res.text();
      body = { success: res.ok, data: text };
    }

    if (!res.ok || body.success === false) {
      const err = body.error || {};
      throw new VelontriError(
        err.message || `HTTP ${res.status}`,
        err.code || 'INTERNAL_ERROR',
        err.field || null,
        res.status,
        body.request_id || '',
      );
    }
    return body;
  }

  get(url, options = {})         { return this.request(url, { method: 'GET', ...options }); }
  post(url, body, options = {})  { return this.request(url, { method: 'POST',   body: JSON.stringify(body), ...options }); }
  patch(url, body, options = {}) { return this.request(url, { method: 'PATCH',  body: JSON.stringify(body), ...options }); }
  put(url, body, options = {})   { return this.request(url, { method: 'PUT',    body: JSON.stringify(body), ...options }); }
  delete(url, options = {})      { return this.request(url, { method: 'DELETE', ...options }); }

  /** @param {string} url @param {FormData} formData */
  upload(url, formData, options = {}) {
    const { headers = {}, ...rest } = options;
    // Do NOT set Content-Type — browser sets it with boundary
    const h = { ...headers };
    if (this._tokens.access) h['Authorization'] = `Bearer ${this._tokens.access}`;
    return this.request(url, { method: 'POST', body: formData, headers: h, ...rest });
  }
}

// ── Service classes ───────────────────────────────────────────────────────────

class AuthService {
  constructor(http, base) { this._http = http; this._base = base; }

  /** @param {{ email: string, phone: string, password: string, full_name: string, country_code: string }} body */
  register(body) { return this._http.post(`${this._base}/auth/register`, body, { skipAuth: true }); }

  /** @param {{ user_id: string, otp: string }} body */
  verifyPhone(body) { return this._http.post(`${this._base}/auth/verify-phone`, body, { skipAuth: true }); }

  /** @param {{ identifier: string, password: string, device_fingerprint: string, user_agent?: string }} body */
  login(body) { return this._http.post(`${this._base}/auth/login`, body, { skipAuth: true }); }

  /** @param {{ provider: 'google'|'apple', id_token: string, device_fingerprint: string }} body */
  oauthLogin(body) { return this._http.post(`${this._base}/auth/login/oauth`, body, { skipAuth: true }); }

  /** @param {{ refresh_token: string }} body */
  refreshToken(body) { return this._http.post(`${this._base}/auth/token/refresh`, body, { skipAuth: true, skipRefresh: true }); }

  introspect() { return this._http.get(`${this._base}/auth/introspect`); }

  /** @param {{ refresh_token: string }} body */
  logout(body) { return this._http.post(`${this._base}/auth/logout`, body); }

  /** @param {{ method: 'totp'|'sms' }} body */
  enable2FA(body) { return this._http.post(`${this._base}/auth/2fa/enable`, body); }

  /** @param {{ two_fa_session_id: string, otp: string }} body */
  verify2FA(body) { return this._http.post(`${this._base}/auth/2fa/verify`, body, { skipAuth: true }); }

  /** @param {{ email: string }} body */
  requestPasswordReset(body) { return this._http.post(`${this._base}/auth/password/reset-request`, body, { skipAuth: true }); }

  /** @param {{ token: string, new_password: string }} body */
  resetPassword(body) { return this._http.post(`${this._base}/auth/password/reset`, body, { skipAuth: true }); }

  listDevices() { return this._http.get(`${this._base}/auth/devices`); }
  revokeDevice(deviceId) { return this._http.delete(`${this._base}/auth/devices/${deviceId}`); }
}

class UserService {
  constructor(http, base) { this._http = http; this._base = base; }

  getProfile(userId) { return this._http.get(`${this._base}/users/${userId}/profile`); }
  updateProfile(body) { return this._http.patch(`${this._base}/users/me/profile`, body); }
  uploadGovernmentId(formData) { return this._http.upload(`${this._base}/users/me/kyc/government-id`, formData); }
  uploadBusinessReg(formData) { return this._http.upload(`${this._base}/users/me/kyc/business-reg`, formData); }
  createBusiness(body) { return this._http.post(`${this._base}/businesses`, body); }
  listBusinesses() { return this._http.get(`${this._base}/businesses`); }
  createBranch(businessId, body) { return this._http.post(`${this._base}/businesses/${businessId}/branches`, body); }
  listBranches(businessId) { return this._http.get(`${this._base}/businesses/${businessId}/branches`); }
  updateRoles(userId, body) { return this._http.patch(`${this._base}/users/${userId}/roles`, body); }
}

class MarketplaceService {
  constructor(http, base) { this._http = http; this._base = base; }

  createListing(body) { return this._http.post(`${this._base}/listings`, body); }

  /**
   * @param {{ page?: number, page_size?: number, category?: string, listing_type?: string, seller_id?: string }} params
   */
  browseListings(params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
    return this._http.get(`${this._base}/listings?${qs}`);
  }

  getListing(listingId) { return this._http.get(`${this._base}/listings/${listingId}`); }
  updateListing(listingId, body) { return this._http.patch(`${this._base}/listings/${listingId}`, body); }
  deleteListing(listingId) { return this._http.delete(`${this._base}/listings/${listingId}`); }
  uploadImage(listingId, formData) { return this._http.upload(`${this._base}/listings/${listingId}/images`, formData); }
  uploadVideo(listingId, formData) { return this._http.upload(`${this._base}/listings/${listingId}/videos`, formData); }
  publishListing(listingId) { return this._http.post(`${this._base}/listings/${listingId}/publish`, {}); }
  addPropertyDetails(listingId, body) { return this._http.post(`${this._base}/listings/${listingId}/property`, body); }
  addVehicleDetails(listingId, body) { return this._http.post(`${this._base}/listings/${listingId}/vehicle`, body); }
  addJobDetails(listingId, body) { return this._http.post(`${this._base}/listings/${listingId}/job`, body); }
  applyForJob(listingId, formData) { return this._http.upload(`${this._base}/listings/${listingId}/applications`, formData); }
  getMortgageCalc(listingId, params) {
    const qs = new URLSearchParams(params);
    return this._http.get(`${this._base}/listings/${listingId}/mortgage-calculator?${qs}`);
  }
  submitReview(listingId, body) { return this._http.post(`${this._base}/listings/${listingId}/reviews`, body); }
  listReviews(listingId, page = 1) { return this._http.get(`${this._base}/listings/${listingId}/reviews?page=${page}`); }
  respondToReview(reviewId, body) { return this._http.post(`${this._base}/reviews/${reviewId}/response`, body); }
  upsertStore(body) { return this._http.post(`${this._base}/stores`, body); }
  createBooking(body) { return this._http.post(`${this._base}/bookings`, body); }
  updateBooking(bookingId, body) { return this._http.patch(`${this._base}/bookings/${bookingId}/status`, body); }
}

class SearchService {
  constructor(http, base) { this._http = http; this._base = base; }

  /**
   * @param {Object} params - q, page, page_size, price_min, price_max, category, city, lat, lon, radius_km, condition...
   */
  search(params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
    return this._http.get(`${this._base}/search?${qs}`, { skipAuth: true });
  }

  autocomplete(q) { return this._http.get(`${this._base}/search/autocomplete?q=${encodeURIComponent(q)}`, { skipAuth: true }); }

  voiceSearch(formData) { return this._http.upload(`${this._base}/search/voice`, formData); }

  /** @param {{ query: string, page?: number, page_size?: number }} body */
  aiSearch(body) { return this._http.post(`${this._base}/search/ai`, body); }
}

class WalletService {
  constructor(http, base) { this._http = http; this._base = base; }

  getBalance() { return this._http.get(`${this._base}/wallet/balance`); }

  /** @param {{ amount: number, currency?: string, payment_reference: string }} body */
  topUp(body) { return this._http.post(`${this._base}/wallet/topup`, body); }

  /** @param {{ amount: number, bank_code: string, bank_account_number: string, description?: string }} body */
  withdraw(body) { return this._http.post(`${this._base}/wallet/withdraw`, body); }

  /** @param {{ recipient_user_id: string, amount: number, description?: string }} body */
  transfer(body) { return this._http.post(`${this._base}/wallet/transfer`, body); }

  listTransactions(page = 1, pageSize = 20) {
    return this._http.get(`${this._base}/wallet/transactions?page=${page}&page_size=${pageSize}`);
  }

  getRewards() { return this._http.get(`${this._base}/wallet/rewards`); }

  /** @param {{ points: number }} body */
  redeemRewards(body) { return this._http.post(`${this._base}/wallet/rewards/redeem`, body); }
}

class PaymentService {
  constructor(http, base) { this._http = http; this._base = base; }

  /** @param {{ order_id: string, buyer_id: string, seller_id: string, amount: number, currency: string, gateway?: string, seller_tier?: string, buyer_email: string }} body */
  initiatePayment(body) { return this._http.post(`${this._base}/payments/initiate`, body); }

  confirmDelivery(paymentId) { return this._http.post(`${this._base}/payments/${paymentId}/confirm-delivery`, {}); }

  /** @param {{ reason: string }} body */
  raiseDispute(paymentId, body) { return this._http.post(`${this._base}/payments/${paymentId}/dispute`, body); }

  getPayment(paymentId) { return this._http.get(`${this._base}/payments/${paymentId}`); }
}

class ChatService {
  constructor(http, base) { this._http = http; this._base = base; }

  listThreads(token) { return this._http.get(`${this._base}/chat/threads?token=${token}`, { skipAuth: true }); }

  getMessages(threadId, token) {
    return this._http.get(`${this._base}/chat/threads/${threadId}/messages?token=${token}`, { skipAuth: true });
  }

  uploadMedia(threadId, token, formData) {
    return this._http.upload(`${this._base}/chat/threads/${threadId}/media?token=${token}`, formData);
  }
}

class SubscriptionService {
  constructor(http, base) { this._http = http; this._base = base; }

  getTiers() { return this._http.get(`${this._base}/subscriptions/tiers`, { skipAuth: true }); }
  getMySubscription() { return this._http.get(`${this._base}/subscriptions/me`); }
  upgrade(body) { return this._http.post(`${this._base}/subscriptions/upgrade`, body); }
  downgrade(body) { return this._http.post(`${this._base}/subscriptions/downgrade`, body); }
  listInvoices() { return this._http.get(`${this._base}/subscriptions/invoices`); }
}

class AnalyticsService {
  constructor(http, base) { this._http = http; this._base = base; }

  getSellerSummary(sellerId) { return this._http.get(`${this._base}/analytics/seller/${sellerId}/summary`); }
  getBranchSummary(branchId) { return this._http.get(`${this._base}/analytics/branch/${branchId}/summary`); }
  getTopListings(sellerId) { return this._http.get(`${this._base}/analytics/seller/${sellerId}/top-listings`); }
}

class CRMService {
  constructor(http, base) { this._http = http; this._base = base; }

  listCustomers() { return this._http.get(`${this._base}/crm/customers`); }
  getCustomer(customerId) { return this._http.get(`${this._base}/crm/customers/${customerId}`); }
  addNote(customerId, body) { return this._http.post(`${this._base}/crm/customers/${customerId}/notes`, body); }
}

class InventoryService {
  constructor(http, base) { this._http = http; this._base = base; }

  getStock(branchId) { return this._http.get(`${this._base}/inventory/${branchId}/stock`); }
  getSkuAtBranch(branchId, sku) { return this._http.get(`${this._base}/inventory/${branchId}/sku/${sku}`); }
  createSku(body) { return this._http.post(`${this._base}/inventory/sku`, body); }
  createTransfer(body) { return this._http.post(`${this._base}/inventory/transfers`, body); }
  confirmTransfer(transferId) { return this._http.patch(`${this._base}/inventory/transfers/${transferId}/confirm`, {}); }
  reportDamage(body) { return this._http.post(`${this._base}/inventory/damage`, body); }
  getSkuHistory(sku) { return this._http.get(`${this._base}/inventory/sku/${sku}/history`); }
}

// ── VelontriClient ─────────────────────────────────────────────────────────────

class VelontriClient {
  /**
   * @param {VelontriConfig} config
   */
  constructor(config = {}) {
    const base = config.baseUrl || 'http://localhost:8000/api/v1';
    this._base = base;
    this._tokens = new TokenStore();

    if (config.accessToken || config.refreshToken) {
      this._tokens.set({
        access_token: config.accessToken || '',
        refresh_token: config.refreshToken || '',
      });
    }

    this._http = new HttpClient({
      tokens: this._tokens,
      autoRefresh: config.autoRefresh !== false,
      onRefresh: () => this._refreshTokens(),
      onAuthExpired: config.onAuthExpired || (() => {}),
    });

    this._onTokenRefreshed = config.onTokenRefreshed || null;

    // Service instances
    this.auth         = new AuthService(this._http, base);
    this.users        = new UserService(this._http, base);
    this.marketplace  = new MarketplaceService(this._http, base);
    this.search       = new SearchService(this._http, base);
    this.wallet       = new WalletService(this._http, base);
    this.payments     = new PaymentService(this._http, base);
    this.chat         = new ChatService(this._http, base);
    this.subscriptions = new SubscriptionService(this._http, base);
    this.analytics    = new AnalyticsService(this._http, base);
    this.crm          = new CRMService(this._http, base);
    this.inventory    = new InventoryService(this._http, base);
  }

  /**
   * Set access and/or refresh tokens after login.
   * @param {{ access_token: string, refresh_token?: string }} tokens
   */
  setTokens(tokens) {
    this._tokens.set(tokens);
  }

  /** Clear all tokens (logout). */
  clearTokens() {
    this._tokens.clear();
  }

  /** Get the current access token. */
  get accessToken() { return this._tokens.access; }

  /** Get the current refresh token. */
  get refreshToken() { return this._tokens.refresh; }

  async _refreshTokens() {
    if (!this._tokens.refresh) return false;
    const res = await this.auth.refreshToken({ refresh_token: this._tokens.refresh });
    if (res?.data?.access_token) {
      this._tokens.set(res.data);
      this._onTokenRefreshed?.(res.data);
      return true;
    }
    return false;
  }

  /**
   * Open a WebSocket connection to the chat service.
   * @returns {WebSocket}
   */
  openChatSocket() {
    const wsBase = this._base.replace(/^http/, 'ws').replace(/\/api\/v1$/, '');
    return new WebSocket(`${wsBase}/api/v1/ws/chat?token=${this._tokens.access}`);
  }

  /**
   * Add a global request interceptor.
   * @param {Function} fn
   */
  addRequestInterceptor(fn) { this._http.addRequestInterceptor(fn); }

  /**
   * Add a global response interceptor.
   * @param {Function} fn
   */
  addResponseInterceptor(fn) { this._http.addResponseInterceptor(fn); }
}

// ── Exports ───────────────────────────────────────────────────────────────────

// CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VelontriClient, VelontriError };
}

// ES module (when bundled)
export { VelontriClient, VelontriError };
export default VelontriClient;
