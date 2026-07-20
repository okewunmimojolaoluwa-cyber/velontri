# Velontri Mobile Offline Architecture

## Strategy

Velontri mobile apps use an **offline-first** approach: the UI always reads from a local cache first, then syncs with the API in the background. Users can browse listings, read messages, and view their wallet balance even without a network connection.

---

## What to Cache

### Always Cache (persistent, survives app restart)

| Data | Storage | TTL | Update trigger |
|---|---|---|---|
| Access token | `flutter_secure_storage` / `AsyncStorage` (encrypted) | Until expiry | Login / refresh |
| Refresh token | `flutter_secure_storage` / `AsyncStorage` (encrypted) | 7 days | Login |
| User profile | SQLite / MMKV | 24h | Profile update |
| Subscription tier | SQLite / MMKV | 1h | Active at startup |
| Browse listings (last 3 pages) | SQLite | 5 min | Pull-to-refresh |
| Listing detail (viewed) | SQLite | 30 min | Viewed |
| Wallet balance | MMKV | 5 min | After any wallet op |
| Chat thread list | SQLite | Until WS event | WS `message` event |
| Chat messages (last 200 per thread) | SQLite | Persistent | WS `message` event |
| Search autocomplete history | MMKV | 30 days | Each search |

### Session Cache (in-memory, lost on app close)

| Data | Notes |
|---|---|
| Current search results | Paginated, reset on filter change |
| Online status of contacts | Redis-backed, too volatile to persist |
| Typing indicators | Never persist |

---

## Sync Strategy on Reconnect

When network connectivity is restored:

```
1. Refresh access token (if < 5 min to expiry)
2. Reconnect WebSocket
3. Sync queued outbox (unsent messages, pending actions)
4. Invalidate stale cache entries (listings > 5 min, balance > 5 min)
5. Fetch fresh data for the currently visible screen
6. Deliver queued offline notifications
```

### Flutter Connectivity Listener

```dart
import 'package:connectivity_plus/connectivity_plus.dart';

class SyncManager {
  final VelontriService _service;
  bool _wasOffline = false;

  SyncManager(this._service) {
    Connectivity().onConnectivityChanged.listen(_onConnectivityChange);
  }

  Future<void> _onConnectivityChange(ConnectivityResult result) async {
    final isOffline = result == ConnectivityResult.none;
    if (_wasOffline && !isOffline) {
      await _runSync();
    }
    _wasOffline = isOffline;
  }

  Future<void> _runSync() async {
    await _service.refreshTokenIfNeeded();
    await _service.reconnectWebSocket();
    await _flushOutbox();
    await _service.invalidateStaleCache();
  }

  Future<void> _flushOutbox() async {
    final outbox = await OutboxStore.getPending();
    for (final item in outbox) {
      try {
        await _service.executeOutboxItem(item);
        await OutboxStore.markSent(item.id);
      } catch (e) {
        if (e is VelontriError && !e.isRetryable) {
          await OutboxStore.markFailed(item.id, e.message);
        }
      }
    }
  }
}
```

---

## Optimistic UI Patterns

### Optimistic Message Send

Send the message to the UI immediately, mark it as `sending`, then confirm when the WebSocket or REST response arrives.

```dart
// Flutter example
Future<void> sendMessage(String content, String threadId) async {
  final tempId = 'temp-${DateTime.now().millisecondsSinceEpoch}';

  // 1. Optimistically add to UI
  messageNotifier.value = [
    ...messageNotifier.value,
    Message(
      id: tempId,
      content: content,
      status: MessageStatus.sending,
      createdAt: DateTime.now(),
    ),
  ];

  try {
    // 2. Send via WebSocket
    _ws.send({ 'event': 'message', 'thread_id': threadId, 'content': content });
    // 3. On WS ack, update status to sent
    messageNotifier.updateStatus(tempId, MessageStatus.sent);
  } catch (e) {
    // 4. On failure, mark failed and add to outbox
    messageNotifier.updateStatus(tempId, MessageStatus.failed);
    await OutboxStore.enqueue(OutboxItem(type: 'message', data: { 'content': content, 'thread_id': threadId }));
  }
}
```

### Optimistic Wallet Transfer

```typescript
// React Native example
function useOptimisticTransfer() {
  const [balance, setBalance] = useWalletBalance();

  async function transfer(recipientId: string, amount: number) {
    const previousBalance = balance;
    // Optimistically deduct
    setBalance(b => ({ ...b, available_balance: b.available_balance - amount }));

    try {
      await api.wallet.transfer({ recipient_user_id: recipientId, amount });
      // Refresh actual balance
      await refreshBalance();
    } catch (err) {
      // Rollback
      setBalance(previousBalance);
      showError(err.message);
    }
  }

  return { transfer };
}
```

---

## Conflict Resolution

When offline actions conflict with server state on sync:

### Strategy per data type

| Data Type | Strategy |
|---|---|
| Chat messages | Last-write-wins (server timestamp is authoritative) |
| Listing edits | Server wins if listing was approved/rejected while offline; show diff to user |
| Wallet operations | Server wins always; rollback optimistic UI, show actual balance |
| Bookings | Server wins; if booking was cancelled while offline, show cancellation notice |
| Profile updates | Last-write-wins by `updated_at` timestamp |

### Conflict detection

```dart
class ListingCache {
  static Future<void> syncListing(String listingId) async {
    final cached = await CacheStore.getListing(listingId);
    final fresh = await api.marketplace.getListing(listingId);

    if (cached == null) {
      await CacheStore.saveListing(fresh);
      return;
    }

    // Detect conflict: offline edit + server change
    if (cached.updatedLocally && fresh.updatedAt.isAfter(cached.localEditTime)) {
      // Show merge dialog to user
      conflictNotifier.add(ListingConflict(cached: cached, server: fresh));
    } else {
      await CacheStore.saveListing(fresh);
    }
  }
}
```

---

## Local Database Schema (SQLite)

```sql
-- Listings cache
CREATE TABLE listings_cache (
  id          TEXT PRIMARY KEY,
  data        TEXT NOT NULL,  -- JSON blob
  fetched_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- Chat threads
CREATE TABLE chat_threads (
  id              TEXT PRIMARY KEY,
  participant_a   TEXT NOT NULL,
  participant_b   TEXT NOT NULL,
  listing_id      TEXT,
  last_message    TEXT,
  updated_at      INTEGER NOT NULL
);

-- Chat messages
CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  sender_id   TEXT NOT NULL,
  type        TEXT NOT NULL,
  content     TEXT,
  s3_key      TEXT,
  status      TEXT NOT NULL DEFAULT 'sent',
  read_at     INTEGER,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES chat_threads(id)
);

-- Outbox for offline actions
CREATE TABLE outbox (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  data        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending'
);
```

---

## React Native Offline Setup

```typescript
// Using @react-native-async-storage/async-storage + react-query
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistQueryClient } from '@tanstack/react-query-persist-client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 min
      gcTime:    24 * 60 * 60 * 1000, // 24h
      retry: (count, err: any) => {
        if (err?.code === 'UNAUTHORIZED') return false;
        return count < 3;
      },
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'velontri-query-cache',
});

persistQueryClient({ queryClient, persister });
```

---

## Flutter Offline Setup

```yaml
# pubspec.yaml dependencies
dependencies:
  hive_flutter: ^1.1.0
  hive: ^2.2.3
  connectivity_plus: ^6.0.3
  flutter_secure_storage: ^9.0.0
  sqflite: ^2.3.2
```

```dart
// main.dart initialization
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  Hive.registerAdapter(ListingAdapter());
  await Hive.openBox<Listing>('listings');
  await Hive.openBox('settings');
  runApp(const VelontriApp());
}
```
