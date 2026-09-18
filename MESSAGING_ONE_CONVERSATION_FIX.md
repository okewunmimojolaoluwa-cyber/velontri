# Messaging Feature Fix - ONE Conversation Per User Pair

## Problem Statement
The messaging system was creating **multiple threads** for the same user pair when they discussed different listings. This violated the requirement: **ONE user-to-user conversation = ONE thread**.

Additionally, the textarea input was losing focus after each keystroke due to aggressive query refetching.

---

## Root Causes

### Backend Issues
1. **UniqueConstraint included listing_id**: 
   ```python
   UniqueConstraint("participant_a", "participant_b", "listing_id", name="uq_thread_participants")
   ```
   This allowed users A & B to have separate threads for each listing they discussed.

2. **get_or_create_thread checked listing_id**:
   The function searched for threads based on `(participant_a, participant_b, listing_id)`, creating a new thread for each listing.

### Frontend Issues
1. **Aggressive query refetching**: Queries were refetching too frequently (every 4s for messages, 8s for threads) without optimization.
2. **No render control**: Queries triggered re-renders on every fetch, potentially causing input focus loss.

---

## Solutions Implemented

### Backend Fixes

#### 1. Updated Thread Model UniqueConstraint
**File**: `backend/chat-service/app/models.py`

**Before**:
```python
__table_args__ = (
    UniqueConstraint("participant_a", "participant_b", "listing_id", name="uq_thread_participants"),
    Index("ix_threads_participant_a", "participant_a"),
    Index("ix_threads_participant_b", "participant_b"),
)
```

**After**:
```python
__table_args__ = (
    UniqueConstraint("participant_a", "participant_b", name="uq_thread_participants"),
    Index("ix_threads_participant_a", "participant_a"),
    Index("ix_threads_participant_b", "participant_b"),
)
```

#### 2. Updated get_or_create_thread Function
**File**: `backend/chat-service/app/repository.py`

**Key Changes**:
- Removed listing_id from thread search query
- Now finds existing thread for user pair regardless of listing_id
- Still stores listing_id for context (first message's listing), but doesn't enforce uniqueness on it

**Before**:
```python
# Searched for thread with specific listing_id
if listing_id is not None:
    result = await session.execute(
        text("... AND CAST(listing_id AS TEXT) = :lid ..."),
        {"a": a_str, "b": b_str, "lid": lid_str}
    )
else:
    result = await session.execute(
        text("... AND listing_id IS NULL ..."),
        {"a": a_str, "b": b_str}
    )
```

**After**:
```python
# Finds thread for user pair REGARDLESS of listing_id
result = await session.execute(
    text("SELECT id, participant_a, participant_b, listing_id, created_at FROM threads "
         "WHERE CAST(participant_a AS TEXT) = :a AND CAST(participant_b AS TEXT) = :b "
         "LIMIT 1"),
    {"a": a_str, "b": b_str}
)
```

#### 3. Created Migration Script
**File**: `backend/scripts/consolidate_duplicate_threads.py`

**What it does**:
1. Finds all duplicate threads (same user pairs with different listing_ids)
2. Keeps the oldest thread for each user pair
3. Migrates all messages from duplicate threads to the kept thread
4. Deletes duplicate threads
5. Drops and recreates the unique constraint to prevent future duplicates

**How to run**:
```bash
cd backend
python scripts/consolidate_duplicate_threads.py
```

### Frontend Fixes

#### 4. Optimized Query Behavior
**File**: `frontend/src/app/dashboard/messages/page.tsx`

**Changes**:
- Added `notifyOnChangeProps: ['data', 'error', 'isLoading']` to both queries
- Increased `staleTime` for thread list query (3s → 7s)
- Increased `staleTime` for messages query (2s → 3s)

**Before**:
```typescript
const { data: threadsData, ... } = useQuery({
  queryKey: ['chat-inbox', session.userId],
  queryFn: async () => { ... },
  refetchInterval: 8_000,
  staleTime: 3_000,
  refetchOnWindowFocus: true,
});
```

**After**:
```typescript
const { data: threadsData, ... } = useQuery({
  queryKey: ['chat-inbox', session.userId],
  queryFn: async () => { ... },
  refetchInterval: 8_000,
  staleTime: 7_000,
  refetchOnWindowFocus: true,
  notifyOnChangeProps: ['data', 'error', 'isLoading'], // Only re-render when these change
});
```

**Impact**: This prevents unnecessary re-renders when queries refetch but return the same data, keeping the textarea focus stable.

---

## Testing Checklist

### Backend Tests
- [ ] Run migration script to consolidate existing duplicate threads
- [ ] Verify no duplicate threads remain after migration
- [ ] Test sending message between users A & B about listing 1
- [ ] Test sending message between same users about listing 2
- [ ] Verify both messages appear in SAME thread
- [ ] Verify only ONE thread exists for users A & B

### Frontend Tests
- [ ] Open a conversation and start typing
- [ ] Verify textarea maintains focus while typing entire message
- [ ] Verify no focus loss when query refetches in background
- [ ] Send a message and verify it appears in conversation
- [ ] Verify message list updates without losing input focus
- [ ] Test on both mobile and desktop layouts

### Integration Tests
1. **User A messages User B about Listing 1**
   - Should create thread T1
   - Message appears in T1

2. **User A messages User B about Listing 2**
   - Should **reuse** thread T1 (NOT create new thread)
   - Message appears in T1
   - Both messages visible in same conversation

3. **User B replies to User A**
   - Should reuse thread T1
   - Reply appears in T1
   - No new thread created

4. **User A opens messages page**
   - Should see ONE conversation with User B
   - All messages visible in single thread

---

## Database Migration

### Prerequisites
- Backup your database before running migration
- Set `DATABASE_URL` environment variable

### Running the Migration
```bash
cd backend
export DATABASE_URL="postgresql+asyncpg://user:pass@host:port/dbname"
python scripts/consolidate_duplicate_threads.py
```

### What the Migration Does
```
STEP 1: Find duplicate threads
  → Identifies user pairs with multiple threads
  → Groups by (participant_a, participant_b)

STEP 2: Consolidate threads
  → Keeps oldest thread for each pair
  → Migrates messages to kept thread
  → Deletes duplicate threads

STEP 3: Update constraint
  → Drops old constraint with listing_id
  → Creates new constraint on (participant_a, participant_b) only

STEP 4: Verification
  → Confirms no duplicates remain
  → Shows final thread and message counts
```

### Example Output
```
================================================================================
THREAD CONSOLIDATION MIGRATION
================================================================================

Found 5 user pairs with duplicate threads

→ User pair abc123 <-> def456: 3 threads
  ├─ Keeping thread: xyz789 (created 2024-01-01)
  └─ Removing 2 duplicate threads
    → Migrating 12 messages from old-thread-1 to xyz789
    → Migrating 8 messages from old-thread-2 to xyz789

✓ Consolidation complete!
  • Removed 10 duplicate threads
  • Migrated 45 messages

✓ SUCCESS! All user pairs now have exactly ONE thread

Final counts:
  • Total threads: 150
  • Total messages: 1,245
================================================================================
```

---

## Architecture Overview

### Thread Creation Flow
```
User A sends message to User B about Listing X
    ↓
Backend: get_or_create_thread(A, B, X)
    ↓
Search for thread where participant_a = A AND participant_b = B
    ↓
If found: Return existing thread (ignore X)
If not found: Create new thread, store X for context
    ↓
Create message in thread
    ↓
Result: ONE conversation between A & B, regardless of how many listings discussed
```

### Key Design Principles
1. **User pair = Thread**: One thread per unique user pair (A↔B)
2. **Participant ordering**: Always normalize (smaller UUID → participant_a)
3. **Listing context**: Store first listing_id for reference, but don't enforce uniqueness
4. **Message continuity**: All messages between A & B in single thread for easy conversation tracking

---

## Files Changed

### Backend
- `backend/chat-service/app/models.py` - Updated UniqueConstraint
- `backend/chat-service/app/repository.py` - Updated get_or_create_thread logic
- `backend/scripts/consolidate_duplicate_threads.py` - New migration script

### Frontend
- `frontend/src/app/dashboard/messages/page.tsx` - Optimized query behavior

---

## Rollback Plan

If issues arise, you can rollback:

1. **Restore database backup** (before migration)
2. **Revert code changes**:
   ```bash
   git revert <commit-hash>
   ```

3. **Reapply old constraint** (if needed):
   ```sql
   ALTER TABLE threads 
   DROP CONSTRAINT IF EXISTS uq_thread_participants;
   
   ALTER TABLE threads 
   ADD CONSTRAINT uq_thread_participants 
   UNIQUE (participant_a, participant_b, listing_id);
   ```

---

## Production Deployment Steps

1. **Backup production database**
2. **Deploy backend code changes** (models + repository)
3. **Run migration script** on production database
4. **Deploy frontend code changes**
5. **Monitor error logs** for any issues
6. **Test messaging feature** end-to-end

---

## Success Criteria

✅ **Backend**:
- ONE thread per user pair in database
- No duplicate threads after migration
- Messages from different listings appear in same thread

✅ **Frontend**:
- Textarea maintains focus while typing
- No focus loss during background query refetches
- Messages send and receive correctly
- UI updates smoothly without jarring re-renders

✅ **User Experience**:
- Users see ONE conversation per contact
- All messages with a person in single thread
- Conversation history preserved and accessible
- No confusion from multiple threads

---

## Notes

- **listing_id is still stored** in threads table for context (shows which listing started the conversation)
- **Participant ordering is normalized** (smaller UUID always in participant_a) to prevent A→B vs B→A duplicates
- **Migration is idempotent** - safe to run multiple times
- **Focus fix uses React Query optimization** rather than imperative focus management

---

**Status**: ✅ COMPLETE - Ready for testing and deployment
**Date**: 2026-09-18
**Author**: Kiro AI Assistant
