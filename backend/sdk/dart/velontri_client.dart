// Velontri Flutter/Dart SDK
// Single-file SDK for all Velontri microservices.
//
// Requires: http ^1.2.0, flutter_secure_storage ^9.0.0
//
// Usage:
//   final client = VelontriClient(baseUrl: 'https://api.velontri.com/api/v1');
//   final res = await client.auth.login(identifier: 'user@example.com', password: 'SecurePass1!');
//   client.setTokens(res.data['tokens']);

import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// ── Exceptions ─────────────────────────────────────────────────────────────────

class VelontriException implements Exception {
  final String message;
  final String code;
  final String? field;
  final int statusCode;
  final String? requestId;

  bool get isRetryable => const ['INTERNAL_ERROR', 'GATEWAY_TIMEOUT', 'EXTERNAL_SERVICE_ERROR'].contains(code);
  bool get isAuthError  => const ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'UNAUTHORIZED'].contains(code);
  bool get isTokenExpired => code == 'TOKEN_EXPIRED';

  const VelontriException({
    required this.message,
    required this.code,
    this.field,
    this.statusCode = 0,
    this.requestId,
  });

  @override
  String toString() => 'VelontriException($code): $message';
}

// ── Token storage ──────────────────────────────────────────────────────────────

class TokenStore {
  static const _storage = FlutterSecureStorage();
  static const _accessKey  = 'velontri_access_token';
  static const _refreshKey = 'velontri_refresh_token';

  String? _accessToken;
  String? _refreshToken;

  String? get accessToken  => _accessToken;
  String? get refreshToken => _refreshToken;

  Future<void> load() async {
    _accessToken  = await _storage.read(key: _accessKey);
    _refreshToken = await _storage.read(key: _refreshKey);
  }

  Future<void> setTokens({ required String accessToken, String? refreshToken }) async {
    _accessToken = accessToken;
    await _storage.write(key: _accessKey, value: accessToken);
    if (refreshToken != null) {
      _refreshToken = refreshToken;
      await _storage.write(key: _refreshKey, value: refreshToken);
    }
  }

  Future<void> clear() async {
    _accessToken  = null;
    _refreshToken = null;
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  bool isExpiringSoon() {
    if (_accessToken == null) return true;
    try {
      final parts = _accessToken!.split('.');
      if (parts.length != 3) return true;
      final payload = parts[1];
      final normalized = base64.normalize(payload);
      final decoded = utf8.decode(base64.decode(normalized));
      final Map<String, dynamic> claims = json.decode(decoded);
      final exp = claims['exp'] as int?;
      if (exp == null) return true;
      return DateTime.now().millisecondsSinceEpoch / 1000 > exp - 60;
    } catch (_) {
      return true;
    }
  }
}

// ── HTTP core ──────────────────────────────────────────────────────────────────

class _ApiResponse {
  final bool success;
  final String message;
  final dynamic data;
  final Map<String, dynamic>? meta;

  const _ApiResponse({ required this.success, required this.message, this.data, this.meta });
}

class _HttpClient {
  final String baseUrl;
  final TokenStore _tokens;
  final Future<bool> Function()? _onRefresh;
  final void Function()? _onAuthExpired;
  final bool _autoRefresh;

  Future<bool>? _refreshFuture; // deduplicate concurrent refreshes

  _HttpClient({
    required this.baseUrl,
    required TokenStore tokens,
    Future<bool> Function()? onRefresh,
    void Function()? onAuthExpired,
    bool autoRefresh = true,
  })  : _tokens = tokens,
        _onRefresh = onRefresh,
        _onAuthExpired = onAuthExpired,
        _autoRefresh = autoRefresh;

  Map<String, String> _buildHeaders({ bool skipAuth = false }) {
    final headers = <String, String>{
      HttpHeaders.contentTypeHeader: 'application/json',
      'Accept': 'application/json',
    };
    if (!skipAuth && _tokens.accessToken != null) {
      headers[HttpHeaders.authorizationHeader] = 'Bearer ${_tokens.accessToken}';
    }
    return headers;
  }

  Future<_ApiResponse> _send(
    http.BaseRequest request, {
    bool skipAuth = false,
    bool skipRefresh = false,
  }) async {
    if (!skipAuth && !skipRefresh && _autoRefresh && _tokens.isExpiringSoon()) {
      await _doRefresh();
    }

    if (!skipAuth && _tokens.accessToken != null) {
      request.headers[HttpHeaders.authorizationHeader] = 'Bearer ${_tokens.accessToken}';
    }

    final streamed = await http.Client().send(request);
    final response = await http.Response.fromStream(streamed);

    // Handle 401 → refresh once
    if (response.statusCode == 401 && !skipRefresh && !skipAuth && _autoRefresh) {
      final body = json.decode(response.body) as Map<String, dynamic>? ?? {};
      final code = (body['error'] as Map?)?.cast<String, dynamic>()?['code'];
      if (code == 'TOKEN_EXPIRED') {
        final refreshed = await _doRefresh();
        if (refreshed) {
          // Rebuild and retry
          final retried = _cloneRequest(request);
          if (_tokens.accessToken != null) {
            retried.headers[HttpHeaders.authorizationHeader] = 'Bearer ${_tokens.accessToken}';
          }
          final retryStreamed = await http.Client().send(retried);
          final retryResponse = await http.Response.fromStream(retryStreamed);
          return _parseResponse(retryResponse);
        }
      }
    }

    return _parseResponse(response);
  }

  http.BaseRequest _cloneRequest(http.BaseRequest original) {
    final cloned = http.Request(original.method, original.url)
      ..headers.addAll(original.headers);
    if (original is http.Request) {
      cloned.body = original.body;
    }
    return cloned;
  }

  Future<bool> _doRefresh() async {
    _refreshFuture ??= _onRefresh?.call().catchError((_) {
      _tokens.clear();
      _onAuthExpired?.call();
      return false;
    }).whenComplete(() => _refreshFuture = null);
    return _refreshFuture ?? Future.value(false);
  }

  _ApiResponse _parseResponse(http.Response response) {
    Map<String, dynamic> body;
    try {
      body = json.decode(response.body) as Map<String, dynamic>;
    } catch (_) {
      body = { 'success': response.statusCode < 400, 'data': response.body };
    }

    if (response.statusCode >= 400 || body['success'] == false) {
      final err = (body['error'] as Map?)?.cast<String, dynamic>() ?? {};
      throw VelontriException(
        message: err['message']?.toString() ?? 'HTTP ${response.statusCode}',
        code: err['code']?.toString() ?? 'INTERNAL_ERROR',
        field: err['field']?.toString(),
        statusCode: response.statusCode,
        requestId: body['request_id']?.toString(),
      );
    }

    return _ApiResponse(
      success: true,
      message: body['message']?.toString() ?? '',
      data: body['data'],
      meta: (body['meta'] as Map?)?.cast<String, dynamic>(),
    );
  }

  Future<_ApiResponse> get(String path, { bool skipAuth = false }) async {
    final req = http.Request('GET', Uri.parse('$baseUrl$path'))
      ..headers.addAll(_buildHeaders(skipAuth: skipAuth));
    return _send(req, skipAuth: skipAuth);
  }

  Future<_ApiResponse> post(String path, Map<String, dynamic> body, {
    bool skipAuth = false,
    bool skipRefresh = false,
  }) async {
    final req = http.Request('POST', Uri.parse('$baseUrl$path'))
      ..headers.addAll(_buildHeaders(skipAuth: skipAuth))
      ..body = json.encode(body);
    return _send(req, skipAuth: skipAuth, skipRefresh: skipRefresh);
  }

  Future<_ApiResponse> patch(String path, Map<String, dynamic> body, { bool skipAuth = false }) async {
    final req = http.Request('PATCH', Uri.parse('$baseUrl$path'))
      ..headers.addAll(_buildHeaders(skipAuth: skipAuth))
      ..body = json.encode(body);
    return _send(req, skipAuth: skipAuth);
  }

  Future<_ApiResponse> delete(String path) async {
    final req = http.Request('DELETE', Uri.parse('$baseUrl$path'))
      ..headers.addAll(_buildHeaders());
    return _send(req);
  }

  Future<_ApiResponse> upload(String path, File file, {
    String fieldName = 'file',
    Map<String, String> fields = const {},
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final multipart = http.MultipartRequest('POST', uri);
    if (_tokens.accessToken != null) {
      multipart.headers[HttpHeaders.authorizationHeader] = 'Bearer ${_tokens.accessToken}';
    }
    multipart.files.add(await http.MultipartFile.fromPath(fieldName, file.path));
    multipart.fields.addAll(fields);
    return _send(multipart);
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────────

class VelontriAuthService {
  final _HttpClient _http;
  VelontriAuthService(this._http);

  Future<_ApiResponse> register({
    required String email,
    required String phone,
    required String password,
    required String fullName,
    required String countryCode,
  }) => _http.post('/auth/register', {
    'email': email, 'phone': phone, 'password': password,
    'full_name': fullName, 'country_code': countryCode,
  }, skipAuth: true);

  Future<_ApiResponse> verifyPhone({ required String userId, required String otp }) =>
    _http.post('/auth/verify-phone', { 'user_id': userId, 'otp': otp }, skipAuth: true);

  Future<_ApiResponse> login({
    required String identifier,
    required String password,
    String deviceFingerprint = 'flutter-app',
    String? userAgent,
  }) => _http.post('/auth/login', {
    'identifier': identifier,
    'password': password,
    'device_fingerprint': deviceFingerprint,
    if (userAgent != null) 'user_agent': userAgent,
  }, skipAuth: true);

  Future<_ApiResponse> oauthLogin({
    required String provider,
    required String idToken,
    String deviceFingerprint = 'flutter-app',
  }) => _http.post('/auth/login/oauth', {
    'provider': provider, 'id_token': idToken, 'device_fingerprint': deviceFingerprint,
  }, skipAuth: true);

  Future<_ApiResponse> refreshToken(String token) =>
    _http.post('/auth/token/refresh', { 'refresh_token': token },
      skipAuth: true, skipRefresh: true);

  Future<_ApiResponse> logout(String refreshToken) =>
    _http.post('/auth/logout', { 'refresh_token': refreshToken });

  Future<_ApiResponse> introspect() => _http.get('/auth/introspect');

  Future<_ApiResponse> enable2FA(String method) =>
    _http.post('/auth/2fa/enable', { 'method': method });

  Future<_ApiResponse> verify2FA({ required String sessionId, required String otp }) =>
    _http.post('/auth/2fa/verify', { 'two_fa_session_id': sessionId, 'otp': otp }, skipAuth: true);

  Future<_ApiResponse> requestPasswordReset(String email) =>
    _http.post('/auth/password/reset-request', { 'email': email }, skipAuth: true);

  Future<_ApiResponse> resetPassword({ required String token, required String newPassword }) =>
    _http.post('/auth/password/reset', { 'token': token, 'new_password': newPassword }, skipAuth: true);

  Future<_ApiResponse> listDevices() => _http.get('/auth/devices');
  Future<_ApiResponse> revokeDevice(String deviceId) => _http.delete('/auth/devices/$deviceId');
}

// ── Marketplace ────────────────────────────────────────────────────────────────

class VelontriMarketplaceService {
  final _HttpClient _http;
  VelontriMarketplaceService(this._http);

  Future<_ApiResponse> browseListings({
    int page = 1, int pageSize = 20,
    String? category, String? listingType, String? sellerId,
  }) {
    final params = <String, String>{
      'page': '$page', 'page_size': '$pageSize',
      if (category != null) 'category': category,
      if (listingType != null) 'listing_type': listingType,
      if (sellerId != null) 'seller_id': sellerId,
    };
    final qs = Uri(queryParameters: params).query;
    return _http.get('/listings?$qs', skipAuth: true);
  }

  Future<_ApiResponse> getListing(String listingId) =>
    _http.get('/listings/$listingId', skipAuth: true);

  Future<_ApiResponse> createListing(Map<String, dynamic> body) =>
    _http.post('/listings', body);

  Future<_ApiResponse> updateListing(String listingId, Map<String, dynamic> body) =>
    _http.patch('/listings/$listingId', body);

  Future<_ApiResponse> publishListing(String listingId) =>
    _http.post('/listings/$listingId/publish', {});

  Future<_ApiResponse> uploadImage(String listingId, File image) =>
    _http.upload('/listings/$listingId/images', image);

  Future<_ApiResponse> submitReview(String listingId, Map<String, dynamic> body) =>
    _http.post('/listings/$listingId/reviews', body);

  Future<_ApiResponse> listReviews(String listingId, { int page = 1 }) =>
    _http.get('/listings/$listingId/reviews?page=$page', skipAuth: true);

  Future<_ApiResponse> createBooking(Map<String, dynamic> body) =>
    _http.post('/bookings', body);
}

// ── Search ─────────────────────────────────────────────────────────────────────

class VelontriSearchService {
  final _HttpClient _http;
  VelontriSearchService(this._http);

  Future<_ApiResponse> search({
    required String query,
    int page = 1, int pageSize = 20,
    String? category, String? city, String? country,
    double? priceMin, double? priceMax,
    double? lat, double? lon, double? radiusKm,
    String? condition,
  }) {
    final params = <String, String>{
      'q': query, 'page': '$page', 'page_size': '$pageSize',
      if (category != null) 'category': category,
      if (city != null) 'city': city,
      if (country != null) 'country': country,
      if (priceMin != null) 'price_min': '$priceMin',
      if (priceMax != null) 'price_max': '$priceMax',
      if (lat != null) 'lat': '$lat',
      if (lon != null) 'lon': '$lon',
      if (radiusKm != null) 'radius_km': '$radiusKm',
      if (condition != null) 'condition': condition,
    };
    final qs = Uri(queryParameters: params).query;
    return _http.get('/search?$qs', skipAuth: true);
  }

  Future<_ApiResponse> autocomplete(String q) =>
    _http.get('/search/autocomplete?q=${Uri.encodeComponent(q)}', skipAuth: true);

  Future<_ApiResponse> aiSearch(String query, { int page = 1 }) =>
    _http.post('/search/ai', { 'query': query, 'page': page });
}

// ── Wallet ─────────────────────────────────────────────────────────────────────

class VelontriWalletService {
  final _HttpClient _http;
  VelontriWalletService(this._http);

  Future<_ApiResponse> getBalance() => _http.get('/wallet/balance');

  Future<_ApiResponse> topUp({ required double amount, required String paymentReference, String currency = 'NGN' }) =>
    _http.post('/wallet/topup', { 'amount': amount, 'currency': currency, 'payment_reference': paymentReference });

  Future<_ApiResponse> withdraw({ required double amount, required String bankCode, required String bankAccountNumber, String? description }) =>
    _http.post('/wallet/withdraw', {
      'amount': amount, 'bank_code': bankCode,
      'bank_account_number': bankAccountNumber,
      if (description != null) 'description': description,
    });

  Future<_ApiResponse> transfer({ required String recipientUserId, required double amount, String? description }) =>
    _http.post('/wallet/transfer', {
      'recipient_user_id': recipientUserId, 'amount': amount,
      if (description != null) 'description': description,
    });

  Future<_ApiResponse> listTransactions({ int page = 1, int pageSize = 20 }) =>
    _http.get('/wallet/transactions?page=$page&page_size=$pageSize');

  Future<_ApiResponse> getRewards() => _http.get('/wallet/rewards');

  Future<_ApiResponse> redeemRewards(int points) =>
    _http.post('/wallet/rewards/redeem', { 'points': points });
}

// ── VelontriClient ─────────────────────────────────────────────────────────────

class VelontriClient {
  final String baseUrl;
  final TokenStore _tokenStore;
  final _HttpClient _http;
  final void Function()? onAuthExpired;
  final void Function(Map<String, dynamic>)? onTokenRefreshed;

  late final VelontriAuthService auth;
  late final VelontriMarketplaceService marketplace;
  late final VelontriSearchService search;
  late final VelontriWalletService wallet;

  VelontriClient({
    this.baseUrl = 'https://api.velontri.com/api/v1',
    this.onAuthExpired,
    this.onTokenRefreshed,
    TokenStore? tokenStore,
  }) : _tokenStore = tokenStore ?? TokenStore(),
       _http = _HttpClient(
         baseUrl: baseUrl,
         tokens: tokenStore ?? TokenStore(),
         autoRefresh: true,
       ) {
    auth = VelontriAuthService(_http);
    marketplace = VelontriMarketplaceService(_http);
    search = VelontriSearchService(_http);
    wallet = VelontriWalletService(_http);

    // Wire up refresh callback after creation
    // The HttpClient captures the _onRefresh closure
  }

  /// Load persisted tokens from secure storage.
  Future<void> initialize() => _tokenStore.load();

  /// Set tokens after login.
  Future<void> setTokens({ required String accessToken, String? refreshToken }) =>
    _tokenStore.setTokens(accessToken: accessToken, refreshToken: refreshToken);

  /// Clear tokens (logout).
  Future<void> clearTokens() => _tokenStore.clear();

  String? get accessToken  => _tokenStore.accessToken;
  String? get refreshToken => _tokenStore.refreshToken;
  bool    get isLoggedIn   => _tokenStore.accessToken != null;

  /// Build a WebSocket URL for the chat service.
  String get chatWebSocketUrl {
    final wsBase = baseUrl.replaceAll('https://', 'wss://').replaceAll('http://', 'ws://');
    return '${wsBase.replaceAll('/api/v1', '')}/api/v1/ws/chat?token=${_tokenStore.accessToken}';
  }

  Future<bool> refreshTokens() async {
    final rt = _tokenStore.refreshToken;
    if (rt == null) return false;
    try {
      final res = await auth.refreshToken(rt);
      final tokens = res.data as Map<String, dynamic>?;
      if (tokens?['access_token'] != null) {
        await setTokens(
          accessToken: tokens!['access_token'],
          refreshToken: tokens['refresh_token'],
        );
        onTokenRefreshed?.call(tokens);
        return true;
      }
      return false;
    } catch (_) {
      await clearTokens();
      onAuthExpired?.call();
      return false;
    }
  }
}
