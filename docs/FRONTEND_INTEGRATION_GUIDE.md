# Velontri — Frontend Integration Guide

**Backend version:** 1.0.0  
**Last updated:** 2026-06-17  
**Supported frontends:** React, Next.js, Vue, Nuxt, Angular, Svelte, Flutter, React Native, Android, iOS

---

## 1. How to Start the Backend

Open a terminal in the project root and run:

```bash
npm run dev
```

This starts **all 14 microservices on a single port (8000)** — no Docker required.
On first run it generates JWT keys automatically. Ready in ~15 seconds.

**Check everything is up:**
```bash
npm run health
```

For the full Docker stack (Postgres, Redis, RabbitMQ, etc.):
```bash
npm run dev:docker
```

---

## 2. Service URLs (Development)

**Use one base URL for everything:**

```
http://localhost:8000/api/v1
```

| Resource | Endpoint |
|---|---|
| Auth | `POST /api/v1/auth/register`, `POST /api/v1/auth/login` |
| Listings | `GET /api/v1/listings` |
| Search | `GET /api/v1/search?q=...` |
| Wallet | `GET /api/v1/wallet/balance` |
| Payments | `POST /api/v1/payments/initiate` |
| Chat (WebSocket) | `ws://localhost:8000/api/v1/ws/chat?token=<jwt>` |
| Subscriptions | `GET /api/v1/subscriptions/tiers` |

**Swagger UI:** http://localhost:8000/docs

Set in your frontend `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Per-service ports (debug only — `npm run dev:docker`)

| Service | Base URL |
|---|---|
| Auth | `http://localhost:8001/api/v1` |
| User / Profiles | `http://localhost:8002/api/v1` |
| Marketplace / Listings | `http://localhost:8003/api/v1` |
| Search | `http://localhost:8004/api/v1` |
| AI Assistant | `http://localhost:8005/api/v1` |
| Chat (WebSocket) | `http://localhost:8006/api/v1` |
| Payment / Escrow | `http://localhost:8007/api/v1` |
| Wallet | `http://localhost:8008/api/v1` |
| Inventory | `http://localhost:8009/api/v1` |
| Logistics | `http://localhost:8010/api/v1` |
| Analytics | `http://localhost:8011/api/v1` |
| Notifications | `http://localhost:8012/api/v1` |
| CRM | `http://localhost:8013/api/v1` |
| Subscriptions | `http://localhost:8014/api/v1` |

**Swagger UI** for any service: append `/docs`  
Example: `http://localhost:8001/docs`

---

## 3. Response Format — Always the Same

**Success:**
```json
{
  "success": true,
  "message": "Human-readable status",
  "data": { },
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email/phone or password.",
    "field": null
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

`meta` is `null` on non-paginated responses.  
`error.field` is set on validation errors — use it to highlight the specific input.


---

## 4. Authentication Flow

### Step 1 — Register
```http
POST http://localhost:8001/api/v1/auth/register
Content-Type: application/json

{
  "email": "ada@example.com",
  "phone": "+2348012345678",
  "password": "SecurePass1!",
  "full_name": "Ada Okafor",
  "country_code": "NG"
}
```
Response `data.user_id` — save this.

### Step 2 — Verify Phone OTP
```http
POST http://localhost:8001/api/v1/auth/verify-phone
Content-Type: application/json

{
  "user_id": "<user_id from step 1>",
  "otp": "123456"
}
```
In native dev mode the OTP is logged to the terminal — look for `[auth-service] otp=123456`.

### Step 3 — Login
```http
POST http://localhost:8001/api/v1/auth/login
Content-Type: application/json

{
  "identifier": "ada@example.com",
  "password": "SecurePass1!",
  "device_fingerprint": "web-browser-abc123",
  "user_agent": "Mozilla/5.0"
}
```
Response:
```json
{
  "success": true,
  "data": {
    "tokens": {
      "access_token": "eyJhbGciOiJSUzI1NiJ9...",
      "refresh_token": "v2.local.AbCd...",
      "expires_in": 900
    }
  }
}
```
Save both tokens. The **access token** lasts 15 minutes. The **refresh token** lasts 7 days.

### Using the Token
Add to every protected request:
```
Authorization: Bearer <access_token>
```

### Refresh Before Expiry
```http
POST http://localhost:8001/api/v1/auth/token/refresh
Content-Type: application/json

{ "refresh_token": "<your refresh token>" }
```

### Logout
```http
POST http://localhost:8001/api/v1/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{ "refresh_token": "<your refresh token>" }
```
After this, delete both tokens from storage and redirect to login.

---

## 5. Error Codes — What to Do

| Code | HTTP | Action |
|---|---|---|
| `TOKEN_EXPIRED` | 401 | Call `/auth/token/refresh`, retry the request |
| `TOKEN_INVALID` | 401 | Delete tokens, redirect to login |
| `INVALID_CREDENTIALS` | 401 | Show "Wrong email or password" |
| `ACCOUNT_LOCKED` | 403 | Show "Account locked. Try again in 15 minutes." |
| `ACCOUNT_INACTIVE` | 403 | Redirect to phone verification |
| `VALIDATION_ERROR` | 422 | Show `error.field` on the failing form input |
| `INSUFFICIENT_FUNDS` | 422 | Show wallet balance + "Top up" button |
| `QUOTA_EXCEEDED` | 429 | Show "Upgrade your plan" |
| `NOT_FOUND` | 404 | Show 404 component |
| `FORBIDDEN` | 403 | Show "You don't have permission" |
| `INTERNAL_ERROR` | 500 | Show "Something went wrong. Try again." + `request_id` |

**Auto-retry pattern:**
```javascript
async function apiCall(url, options) {
  let res = await fetch(url, options);
  if (res.status === 401) {
    const body = await res.clone().json();
    if (body.error?.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        options.headers['Authorization'] = `Bearer ${refreshed}`;
        res = await fetch(url, options); // retry once
      } else {
        redirectToLogin();
      }
    }
  }
  return res;
}
```


---

## 6. Key Endpoints by Feature

### Browse & Search Listings (public — no token needed)
```
GET  /api/v1/listings
GET  /api/v1/listings?page=1&page_size=20&category=Electronics
GET  /api/v1/listings/{listing_id}
GET  /api/v1/search?q=Samsung+Galaxy&price_max=2000000&city=Lagos
GET  /api/v1/search/autocomplete?q=Toyo
```

### Create a Listing (seller)
```
POST /api/v1/listings
Authorization: Bearer <token>

{
  "listing_type": "physical",
  "title": "Samsung Galaxy S25 Ultra",
  "description": "Brand new, sealed.",
  "price": 1250000,
  "currency": "NGN",
  "country": "NG",
  "state": "Lagos",
  "city": "Ikeja",
  "category": "Electronics",
  "condition": "new",
  "brand": "Samsung"
}
```

### Upload Image to Listing
```
POST /api/v1/listings/{listing_id}/images
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<image file>
```
Max size: 20 MB. Formats: JPEG, PNG, WebP, AVIF.

### Wallet Balance
```
GET /api/v1/wallet/balance
Authorization: Bearer <token>
```

### Initiate Payment
```
POST /api/v1/payments/initiate
Authorization: Bearer <token>

{
  "order_id": "uuid",
  "buyer_id": "uuid",
  "seller_id": "uuid",
  "amount": "1250000.00",
  "currency": "NGN",
  "seller_tier": "growth",
  "buyer_email": "buyer@example.com"
}
```

### Confirm Delivery (releases escrow)
```
POST /api/v1/payments/{payment_id}/confirm-delivery
Authorization: Bearer <token>
```

### Subscription Tiers (public)
```
GET /api/v1/subscriptions/tiers
```

---

## 7. React / Next.js Integration

### Install the SDK
Copy `sdk/js/velontri-sdk.js` into your project, then:

```javascript
// lib/velontri.js
import VelontriClient from './velontri-sdk.js';

const client = new VelontriClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1',
  accessToken: localStorage.getItem('velontri_access') || '',
  refreshToken: localStorage.getItem('velontri_refresh') || '',
  autoRefresh: true,
  onTokenRefreshed: (tokens) => {
    localStorage.setItem('velontri_access', tokens.access_token);
    if (tokens.refresh_token)
      localStorage.setItem('velontri_refresh', tokens.refresh_token);
  },
  onAuthExpired: () => {
    localStorage.removeItem('velontri_access');
    localStorage.removeItem('velontri_refresh');
    window.location.href = '/login';
  },
});

export default client;
```

### Login example
```javascript
const res = await client.auth.login({
  identifier: 'ada@example.com',
  password: 'SecurePass1!',
  device_fingerprint: 'web',
});
client.setTokens(res.data.tokens);
localStorage.setItem('velontri_access', res.data.tokens.access_token);
localStorage.setItem('velontri_refresh', res.data.tokens.refresh_token);
```

### Browse listings
```javascript
const res = await client.marketplace.browseListings({
  page: 1,
  page_size: 20,
  category: 'Electronics',
});
// res.data = array of listings
// res.meta = { total, total_pages, has_next, ... }
```

### React context — copy from templates
```
templates/react/VelontriProvider.tsx  — wrap your app
templates/react/useAuth.ts            — login/logout/register hook
templates/react/useListings.ts        — listings with pagination
frontend/middleware.ts                — auth protection middleware (already in repo)
```

---

## 8. Vue / Nuxt Integration

```javascript
// plugins/velontri.js (Nuxt 3)
import VelontriClient from '~/lib/velontri-sdk.js';

export default defineNuxtPlugin(() => {
  const client = new VelontriClient({
    baseUrl: useRuntimeConfig().public.apiUrl,
    autoRefresh: true,
    onAuthExpired: () => navigateTo('/login'),
  });

  // Restore session
  const access  = useCookie('velontri_access').value;
  const refresh = useCookie('velontri_refresh').value;
  if (access)  client.setTokens({ access_token: access, refresh_token: refresh || '' });

  return { provide: { velontri: client } };
});

// In a component
const { $velontri } = useNuxtApp();
const { data } = await $velontri.marketplace.browseListings({ page: 1 });
```


---

## 9. Flutter / Dart Integration

Copy `sdk/dart/velontri_client.dart` into your Flutter project.

**pubspec.yaml dependencies:**
```yaml
dependencies:
  http: ^1.2.0
  flutter_secure_storage: ^9.0.0
```

```dart
// main.dart
import 'velontri_client.dart';

final velontri = VelontriClient(
  baseUrl: 'http://localhost:8001/api/v1',
  onAuthExpired: () {
    // Navigate to login screen
    Get.offAllNamed('/login');
  },
);

// Restore saved session on app start
await velontri.initialize();

// Login
final res = await velontri.auth.login(
  identifier: 'ada@example.com',
  password: 'SecurePass1!',
);
await velontri.setTokens(
  accessToken: res.data['tokens']['access_token'],
  refreshToken: res.data['tokens']['refresh_token'],
);

// Browse listings
final listings = await velontri.marketplace.browseListings(page: 1);
print(listings.data); // List of listing maps

// Wallet balance
final balance = await velontri.wallet.getBalance();
print(balance.data['balance']); // "450000.00"
```

**File upload (image):**
```dart
import 'dart:io';
final imageFile = File('/path/to/photo.jpg');
await velontri.marketplace.uploadImage(listingId, imageFile);
```

**WebSocket chat:**
```dart
import 'package:web_socket_channel/web_socket_channel.dart';

final wsUrl = velontri.chatWebSocketUrl;
final channel = WebSocketChannel.connect(Uri.parse(wsUrl));

channel.stream.listen((message) {
  final event = jsonDecode(message);
  if (event['event'] == 'message') {
    print('New message: ${event['content']}');
  }
});

// Send message
channel.sink.add(jsonEncode({
  'type': 'text',
  'thread_id': threadId,
  'content': 'Is this still available?',
}));
```

---

## 10. React Native Integration

```javascript
// services/velontri.js
import VelontriClient from './velontri-sdk.js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const client = new VelontriClient({
  baseUrl: 'http://10.0.2.2:8001/api/v1', // Android emulator → localhost
  // For iOS simulator use: http://localhost:8001/api/v1
  // For real device use your machine's LAN IP: http://192.168.x.x:8001/api/v1
  autoRefresh: true,
  onTokenRefreshed: async (tokens) => {
    await AsyncStorage.setItem('velontri_access', tokens.access_token);
    if (tokens.refresh_token)
      await AsyncStorage.setItem('velontri_refresh', tokens.refresh_token);
  },
  onAuthExpired: () => {
    // Navigate to Login screen
  },
});

// Restore session on app launch
export async function initVelontri() {
  const access  = await AsyncStorage.getItem('velontri_access');
  const refresh = await AsyncStorage.getItem('velontri_refresh');
  if (access) client.setTokens({ access_token: access, refresh_token: refresh || '' });
  return client;
}

export default client;
```

**Image upload (React Native):**
```javascript
import { launchImageLibrary } from 'react-native-image-picker';

const result = await launchImageLibrary({ mediaType: 'photo' });
const asset = result.assets[0];

const form = new FormData();
form.append('file', {
  uri: asset.uri,
  name: asset.fileName,
  type: asset.type,
});

const res = await fetch(
  `http://10.0.2.2:8003/api/v1/listings/${listingId}/images`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${client.accessToken}` },
    body: form,
  }
);
```

---

## 11. Android (Kotlin) Integration

```kotlin
// VelontriApi.kt — Retrofit setup
interface VelontriAuth {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<ApiResponse<LoginData>>

    @POST("auth/token/refresh")
    suspend fun refreshToken(@Body body: RefreshRequest): Response<ApiResponse<TokenData>>
}

// Authenticator for auto-refresh
class VelontriAuthenticator(
    private val tokenStore: TokenStore
) : Authenticator {
    override fun authenticate(route: Route?, response: okhttp3.Response): Request? {
        if (response.code != 401) return null
        val newToken = runBlocking { tokenStore.refresh() } ?: return null
        return response.request.newBuilder()
            .header("Authorization", "Bearer $newToken")
            .build()
    }
}

// Usage
val retrofit = Retrofit.Builder()
    .baseUrl("http://10.0.2.2:8001/api/v1/")
    .addConverterFactory(GsonConverterFactory.create())
    .client(OkHttpClient.Builder()
        .authenticator(VelontriAuthenticator(tokenStore))
        .addInterceptor { chain ->
            val req = chain.request().newBuilder()
                .addHeader("Authorization", "Bearer ${tokenStore.accessToken}")
                .build()
            chain.proceed(req)
        }.build()
    ).build()
```

---

## 12. iOS (Swift) Integration

```swift
// VelontriClient.swift
class VelontriClient {
    static let shared = VelontriClient()
    private let base = "http://localhost:8001/api/v1"
    
    func login(identifier: String, password: String) async throws -> LoginResponse {
        var req = URLRequest(url: URL(string: "\(base)/auth/login")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode([
            "identifier": identifier,
            "password": password,
            "device_fingerprint": UIDevice.current.identifierForVendor?.uuidString ?? "ios"
        ])
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(LoginResponse.self, from: data)
    }
    
    func request<T: Decodable>(path: String, method: String = "GET", body: Encodable? = nil) async throws -> T {
        var req = URLRequest(url: URL(string: "\(base)\(path)")!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = KeychainHelper.load("access_token") {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let b = body { req.httpBody = try JSONEncoder().encode(b) }
        let (data, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, http.statusCode == 401 {
            try await refreshToken()
            return try await request(path: path, method: method, body: body)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
```


---

## 13. WebSocket Chat

Connect after login — pass the access token as a query parameter:

```
ws://localhost:8006/api/v1/ws/chat?token=<access_token>
```

**JavaScript:**
```javascript
const ws = new WebSocket(
  `ws://localhost:8006/api/v1/ws/chat?token=${accessToken}`
);

ws.onopen = () => console.log('Chat connected');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.event) {
    case 'message':
      addMessageToUI(msg);
      break;
    case 'typing':
      showTypingIndicator(msg.sender_id);
      break;
    case 'read_receipt':
      markAsRead(msg.message_id);
      break;
  }
};

// Send a text message
ws.send(JSON.stringify({
  type: 'text',
  thread_id: 'thread-uuid',
  content: 'Is this item still available?',
}));

// Send typing indicator
ws.send(JSON.stringify({ type: 'typing', thread_id: 'thread-uuid' }));

// Reconnect on disconnect
ws.onclose = () => setTimeout(() => connectWebSocket(), 3000);
```

**Event types you receive:**

| Event | When |
|---|---|
| `message` | New message from the other participant |
| `typing` | Other user is typing |
| `read_receipt` | Your message was read |
| `thread_created` | New conversation started |

---

## 14. Pagination

All list endpoints accept `?page=1&page_size=20`.  
Max page_size is 100.

```javascript
// React infinite scroll example
const [listings, setListings] = useState([]);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

async function loadMore() {
  const res = await client.marketplace.browseListings({ page, page_size: 20 });
  setListings(prev => [...prev, ...res.data]);
  setHasMore(res.meta.has_next);
  setPage(p => p + 1);
}
```

---

## 15. File Uploads — Size Limits

| Type | Field | Max Size | Formats |
|---|---|---|---|
| Listing image | `file` | 20 MB | JPEG, PNG, WebP, AVIF |
| Listing video | `file` | 500 MB | MP4, MOV |
| Chat image | `file` | 10 MB | JPEG, PNG, WebP |
| Chat voice note | `file` | 5 MB | MP3, WAV, OGG |
| Chat file | `file` | 25 MB | Any |
| CV (job apply) | `file` | 10 MB | PDF, DOCX |
| KYC document | `file` | 25 MB | PDF, JPEG, PNG |

All uploads use `multipart/form-data` with field name `file`.

---

## 16. Supported Currencies

`NGN` · `GHS` · `KES` · `ZAR` · `XOF`

Always send amounts as strings with 2 decimal places: `"1250000.00"`

---

## 17. CORS in Development

All `localhost` origins are pre-configured — no setup needed for:
- `localhost:3000` (React/Next.js CRA / Vite)
- `localhost:5173` (Vite)
- `localhost:4200` (Angular)
- `localhost:8080` (Vue)
- `localhost:8100` (Ionic)

For production set the `ALLOWED_ORIGINS` environment variable.

---

## 18. Postman Quick Start

### Option A — Import the curated collection (recommended)

1. Start the API: `npm run dev`
2. Open Postman → **Import** → **File**
3. Select **`docs/postman_collection.json`**
4. All requests use **`http://localhost:8000/api/v1`** (single gateway URL)
5. Run **Gateway → Health Check** to confirm the API is up
6. Run **Authentication → Register** → set collection variable `user_id` from the response
7. Run **Authentication → Login** → `access_token` and `refresh_token` are auto-saved
8. All protected requests use `{{access_token}}` automatically

**Collection variables (edit in Postman if needed):**

| Variable | Default |
|---|---|
| `base_url` | `http://localhost:8000/api/v1` |
| `gateway_url` | `http://localhost:8000` |
| `access_token` | (set by Login request) |
| `refresh_token` | (set by Login request) |
| `user_id` | (set manually after Register) |
| `listing_id` | (set after creating a listing) |
| `payment_id` | (set after initiating payment) |

### Option B — Import live OpenAPI from the gateway

1. Start the API: `npm run dev`
2. Postman → **Import** → **Link**
3. Enter: `http://localhost:8000/openapi.json`
4. Postman generates requests for all **91** gateway endpoints automatically

Use Option A for hand-crafted examples and test scripts. Use Option B for full API coverage.

### Docker mode (debug only)

If running `npm run dev:docker`, per-service ports 8001–8014 remain available. Update collection variables to individual service URLs only when debugging a single microservice in isolation.

---

## 19. Common Issues

| Problem | Solution |
|---|---|
| `TOKEN_EXPIRED` error | Call `POST /auth/token/refresh`, retry |
| Services not starting | Run `npm run health`, check which ones are down |
| Port in use | Kill the process: `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /F` |
| OTP not received | In dev mode, check the terminal — OTP is printed there |
| Image upload fails | Check file is under 20 MB and format is JPEG/PNG/WebP/AVIF |
| WebSocket disconnects | Reconnect with fresh token — access token may have expired |

---

## 20. Full Endpoint Reference

See `docs/BACKEND_AUDIT_REPORT.md` for the complete endpoint table with HTTP methods and auth requirements.

See `docs/ROLE_PERMISSION_MATRIX.md` for which roles can access which endpoints.

See `docs/ERROR_CATALOG.md` for every error code with handling instructions.
