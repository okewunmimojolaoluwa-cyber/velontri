# Velontri Followers/Following System - Implementation Plan

## Status: PHASE 1 - INSPECTION COMPLETE

### Existing Architecture Audit

#### ✅ Confirmed Existing Systems
1. **Users Table**: `users` table exists with UUID primary keys
2. **Authentication**: JWT-based auth with Bearer tokens
3. **Notifications**: Existing notification system with `notifications` table
4. **Dashboard**: User dashboard exists at `/dashboard/*`
5. **API Convention**: Uses `/api/v1/*` with FastAPI routers
6. **Database**: PostgreSQL with SQLAlchemy ORM
7. **Frontend**: Next.js with React Query, TypeScript, Tailwind CSS

#### ❌ No Existing Follow System
- No `follows` or `user_follows` table found
- `/dashboard/following` exists but shows saved listings, not real follows
- No follow/unfollow API endpoints exist

### Implementation Strategy

## PHASE 2: DATABASE SCHEMA

### New Table: `user_follows`
```sql
CREATE TABLE user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_follows_pair UNIQUE (follower_id, following_id),
    CONSTRAINT ck_user_follows_no_self CHECK (follower_id != following_id)
);

CREATE INDEX ix_user_follows_follower ON user_follows(follower_id);
CREATE INDEX ix_user_follows_following ON user_follows(following_id);
CREATE INDEX ix_user_follows_created_at ON user_follows(created_at DESC);
```

**Rationale**:
- UUID for consistency with existing schema
- `follower_id`: User who is following
- `following_id`: User being followed
- `UNIQUE` constraint prevents duplicate follows
- `CHECK` constraint prevents self-follows
- Cascading deletes keep data clean
- Indexes for efficient queries on both directions

## PHASE 3: BACKEND IMPLEMENTATION

### 3.1 Create User Service (Social Features)

**New Service**: `backend/user-service/app/routers/social.py`

#### Endpoints:
```python
POST   /api/v1/users/{user_id}/follow     # Follow a user
DELETE /api/v1/users/{user_id}/follow     # Unfollow a user
GET    /api/v1/users/{user_id}/followers  # Get user's followers (paginated)
GET    /api/v1/users/{user_id}/following  # Get who user follows (paginated)
GET    /api/v1/users/{user_id}/follow-status # Check if authenticated user follows this user
GET    /api/v1/users/search               # Search users/sellers

GET    /api/v1/me/followers               # Authenticated user's followers
GET    /api/v1/me/following               # Authenticated user's following
```

#### Response Format (follows existing convention):
```json
{
  "success": true,
  "message": "...",
  "data": {
    "following": true,
    "followers_count": 125,
    "following_count": 80
  }
}
```

### 3.2 Security Requirements
- All endpoints require valid JWT token (except public counts)
- Extract `user_id` from JWT, never trust frontend
- Validate target user exists and is active
- Prevent self-follows at API level (database also prevents)
- Rate limiting for follow/unfollow operations

### 3.3 Notification Integration

**New Notification Types**:
1. `NEW_FOLLOWER` - When someone follows you
2. `NEW_FOLLOWED_USER_LISTING` - When followed user publishes listing

**Implementation**:
- Reuse existing `notifications` table
- Add to `notification-service/app/service.py`
- Trigger from appropriate events

## PHASE 4: LISTING PUBLICATION EVENT

### Modify Marketplace Service
- When listing status changes to `active/approved`:
  - Query `user_follows` for followers of listing owner
  - Create notification for each follower
  - Use background task to avoid blocking listing approval

**Location**: `backend/marketplace-service/app/routers/listings.py`

## PHASE 5: FRONTEND IMPLEMENTATION

### 5.1 API Client
**File**: `frontend/src/lib/api/endpoints/social.ts`

```typescript
export const socialApi = {
  followUser(userId: string): Promise<ApiResponse<FollowStatus>>;
  unfollowUser(userId: string): Promise<ApiResponse<FollowStatus>>;
  getFollowers(userId: string, page: number): Promise<ApiResponse<User[]>>;
  getFollowing(userId: string, page: number): Promise<ApiResponse<User[]>>;
  getFollowStatus(userId: string): Promise<ApiResponse<FollowStatus>>;
  searchUsers(query: string): Promise<ApiResponse<User[]>>;
};
```

### 5.2 Follow Button Component
**File**: `frontend/src/components/social/follow-button.tsx`

- Optimistic UI updates
- Loading states
- Error handling
- Guest user handling (redirect to login)
- Prevents double-clicks

### 5.3 Dashboard Pages

#### Replace: `frontend/src/app/dashboard/following/page.tsx`
- Show REAL users being followed
- Unfollow functionality
- Pagination
- Empty state
- Search/filter

#### New: `frontend/src/app/dashboard/followers/page.tsx`
- Show REAL followers
- Follow back functionality
- Pagination
- Empty state

### 5.4 Profile Integration
- Add Follow button to user profiles
- Add Follow button to seller profiles in listings
- Add Follow button to store pages
- Show follower/following counts

### 5.5 Feed Section
**File**: `frontend/src/app/dashboard/page.tsx`

Add "From Sellers You Follow" section:
- Query recent listings from followed users
- Show 4-6 listings
- Link to full listings page

## PHASE 6: USER SEARCH

### Backend: User Search Endpoint
**Existing**: `backend/search-service/app/routers/search.py`
- Add `/search/users` endpoint if not exists
- Search by: full_name, store_name
- Return: user_id, name, profile_photo, verified_status, follower_count
- Pagination support

### Frontend: Search UI
**File**: `frontend/src/components/social/user-search.tsx`
- Search input
- Results list with Follow buttons
- Debounced search
- Link to profiles

## PHASE 7: TESTING PLAN

### Database Tests
- [  ] Unique constraint prevents duplicate follows
- [  ] Check constraint prevents self-follows
- [  ] Cascading deletes work correctly
- [  ] Indexes improve query performance

### Backend API Tests
- [  ] Follow creates relationship
- [  ] Unfollow removes relationship
- [  ] Cannot follow twice (idempotent)
- [  ] Cannot follow self
- [  ] Requires authentication
- [  ] Follower/following counts are accurate
- [  ] Pagination works correctly
- [  ] New listing triggers notifications

### Frontend Tests
- [  ] Follow button works
- [  ] Optimistic UI updates correctly
- [  ] Error handling shows messages
- [  ] Guest users see login prompt
- [  ] Followers page loads
- [  ] Following page loads
- [  ] Search finds users
- [  ] Notifications appear for new listings

### Integration Tests
- [  ] Follow → unfollow → follow sequence
- [  ] Multiple users following same user
- [  ] New listing → all followers notified
- [  ] User deletion cascades properly

## PHASE 8: DEPLOYMENT CHECKLIST

### Pre-Deployment
- [  ] Run migration script to create `user_follows` table
- [  ] Add indexes
- [  ] TypeScript compilation passes
- [  ] No ESLint errors
- [  ] All tests pass
- [  ] Review all modified files

### Post-Deployment Verification
- [  ] Database migration applied successfully
- [  ] API endpoints accessible
- [  ] Follow/unfollow works in production
- [  ] Notifications sending correctly
- [  ] No console errors
- [  ] Mobile responsive
- [  ] Performance acceptable

## FILES TO CREATE

### Backend
1. `backend/user-service/app/routers/social.py` - Follow/unfollow endpoints
2. `backend/scripts/create_follows_table.py` - Migration script
3. `backend/user-service/app/models.py` - Add UserFollow model (if using ORM)

### Frontend
1. `frontend/src/lib/api/endpoints/social.ts` - API client for social features
2. `frontend/src/components/social/follow-button.tsx` - Reusable follow button
3. `frontend/src/components/social/user-search.tsx` - User search component
4. `frontend/src/app/dashboard/followers/page.tsx` - Followers page
5. `frontend/src/types/social.ts` - TypeScript types

### Frontend Files to MODIFY
1. `frontend/src/app/dashboard/following/page.tsx` - Replace with real implementation
2. `frontend/src/app/dashboard/page.tsx` - Add "From Sellers You Follow" section
3. `frontend/src/config/routes.ts` - Add routes if needed
4. Listing detail pages - Add Follow button for seller
5. User/seller profile pages - Add Follow button

### Backend Files to MODIFY
1. `backend/marketplace-service/app/routers/listings.py` - Add notification trigger on listing approval
2. `backend/notification-service/app/service.py` - Add notification types
3. `backend/gateway/app.py` - Include social router

## IMPLEMENTATION ORDER

1. ✅ **Inspection Complete**
2. **Database Migration** - Create table and indexes
3. **Backend API** - Implement social.py router
4. **Notification Integration** - Add notification types and triggers
5. **Frontend API Client** - Create social.ts endpoints
6. **Follow Button** - Create reusable component
7. **Dashboard Pages** - Implement followers/following pages
8. **Profile Integration** - Add Follow buttons to profiles
9. **User Search** - Implement search functionality
10. **Feed Section** - Add "From Sellers You Follow"
11. **Testing** - Run all tests
12. **Documentation** - Update API docs
13. **Deployment** - Deploy to production

## CONSTRAINTS & RULES

### ✅ DO
- Use existing PostgreSQL database
- Follow existing API conventions
- Reuse existing notification system
- Match existing UI/UX patterns
- Add proper error handling
- Use transactions where needed
- Add database indexes
- Paginate large lists
- Cache follower counts if needed

### ❌ DON'T
- Create new user roles
- Create separate social network app
- Duplicate authentication
- Break existing features
- Skip error handling
- Allow SQL injection
- Trust frontend user_id
- Skip input validation
- Hardcode test data
- Silent failures

## NEXT STEPS

Ready to proceed with **PHASE 2: Database Migration**.

Awaiting approval to create migration script and begin implementation.
