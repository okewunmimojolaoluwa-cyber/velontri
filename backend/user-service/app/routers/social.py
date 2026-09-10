"""
Social features router - Followers/Following system.

Endpoints:
- POST   /users/{user_id}/follow      - Follow a user
- DELETE /users/{user_id}/follow      - Unfollow a user
- GET    /users/{user_id}/followers   - Get user's followers
- GET    /users/{user_id}/following   - Get who user follows
- GET    /users/{user_id}/follow-status - Check follow status
- GET    /users/search                - Search users
- GET    /me/followers                - Get authenticated user's followers
- GET    /me/following                - Get authenticated user's following
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import (
    InvalidInputError,
    ForbiddenError,
    NotFoundError,
    SuccessResponse,
)
from shared.jwt_utils import verify_token

router = APIRouter(tags=["Social"])


# ── Schemas ────────────────────────────────────────────────────────────────────


class FollowStatusResponse(BaseModel):
    """Response for follow status check."""
    following: bool
    followers_count: int
    following_count: int


class UserBasic(BaseModel):
    """Basic user information for followers/following lists."""
    id: str
    full_name: str
    email: Optional[str] = None
    followers_count: int
    following_count: int
    seller_verification_status: Optional[str] = None
    created_at: str
    followed_at: Optional[str] = None  # When the follow relationship was created


# ── Dependencies ───────────────────────────────────────────────────────────────


def get_current_user_id(request: Request) -> str:
    """Extract authenticated user ID from JWT token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise ForbiddenError("Missing or invalid authentication token")
    
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        # Get JWT public key from app settings
        from ..config import UserSettings
        settings = UserSettings()
        payload = verify_token(settings.JWT_PUBLIC_KEY_PATH, token)
        return payload["sub"]
    except Exception as e:
        raise ForbiddenError(f"Invalid token: {str(e)}")


async def get_session(request: Request) -> AsyncSession:
    """Get database session from app state."""
    async with request.app.state.session_factory() as session:
        yield session


# ── Helper Functions ───────────────────────────────────────────────────────────


async def user_exists(session: AsyncSession, user_id: str) -> bool:
    """Check if a user exists and is active."""
    result = await session.execute(
        text("SELECT id FROM users WHERE id = :uid AND is_active = TRUE"),
        {"uid": user_id}
    )
    return result.first() is not None


async def get_follow_counts(session: AsyncSession, user_id: str) -> tuple[int, int]:
    """
    Get followers and following counts for a user.
    Counts directly from user_follows table for accuracy.
    """
    # Count followers (people following this user)
    followers_result = await session.execute(
        text("""
            SELECT COUNT(*) FROM user_follows 
            WHERE following_id = :uid
        """),
        {"uid": user_id}
    )
    followers_count = followers_result.scalar() or 0
    
    # Count following (people this user follows)
    following_result = await session.execute(
        text("""
            SELECT COUNT(*) FROM user_follows 
            WHERE follower_id = :uid
        """),
        {"uid": user_id}
    )
    following_count = following_result.scalar() or 0
    
    return (followers_count, following_count)


async def is_following(session: AsyncSession, follower_id: str, following_id: str) -> bool:
    """Check if follower_id follows following_id."""
    result = await session.execute(
        text("""
            SELECT 1 FROM user_follows 
            WHERE follower_id = :follower AND following_id = :following
        """),
        {"follower": follower_id, "following": following_id}
    )
    return result.first() is not None


async def create_follow_notification(
    session: AsyncSession,
    follower_id: str,
    following_id: str,
    follower_name: str
):
    """Create a notification when someone follows a user."""
    try:
        from shared.email_notifications import send_notification_with_email
        await send_notification_with_email(
            db_session=session,
            recipient_user_id=following_id,
            notification_type='info',
            title='New Follower',
            message=f"{follower_name} started following you",
            action_url=f"/users/{follower_id}",
            sender_user_id=follower_id,
            sender_role=follower_name,
            related_resource_type='user',
            related_resource_id=follower_id
        )
    except Exception as e:
        # Don't fail the follow operation if notification fails
        print(f"Failed to create follow notification: {e}")


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post("/users/{user_id}/follow", response_model=SuccessResponse)
async def follow_user(
    user_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
) -> SuccessResponse:
    """
    Follow a user.
    
    - Prevents self-follows
    - Prevents duplicate follows (idempotent)
    - Creates notification for followed user
    - Updates follower counts automatically via trigger
    """
    # Validate user_id is a valid UUID
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise InvalidInputError("Invalid user ID format")
    
    # Prevent self-follow
    if current_user_id == user_id:
        raise InvalidInputError("You cannot follow yourself")
    
    async with request.app.state.session_factory() as session:
        # Check if target user exists and is active
        if not await user_exists(session, user_id):
            raise NotFoundError("User not found or inactive")
        
        # Check if already following (idempotent - just return success)
        if await is_following(session, current_user_id, user_id):
            followers_count, following_count = await get_follow_counts(session, user_id)
            return SuccessResponse(
                message="Already following this user",
                data={
                    "following": True,
                    "followers_count": followers_count,
                    "following_count": following_count,
                }
            )
        
        # Create follow relationship
        try:
            await session.execute(
                text("""
                    INSERT INTO user_follows (follower_id, following_id, created_at)
                    VALUES (:follower, :following, NOW())
                """),
                {"follower": current_user_id, "following": user_id}
            )
            
            # Get follower name for notification
            result = await session.execute(
                text("SELECT full_name FROM users WHERE id = :uid"),
                {"uid": current_user_id}
            )
            follower_row = result.first()
            follower_name = follower_row[0] if follower_row else "Someone"
            
            # Create notification (async, don't block on failure)
            await create_follow_notification(
                session, current_user_id, user_id, follower_name
            )
            
            await session.commit()
            
            # Get updated counts
            followers_count, following_count = await get_follow_counts(session, user_id)
            
            return SuccessResponse(
                message="Successfully followed user",
                data={
                    "following": True,
                    "followers_count": followers_count,
                    "following_count": following_count,
                }
            )
        except Exception as e:
            await session.rollback()
            # Check if it was a constraint violation (duplicate or self-follow)
            if "uq_user_follows_pair" in str(e):
                raise InvalidInputError("Already following this user")
            elif "ck_user_follows_no_self" in str(e):
                raise InvalidInputError("Cannot follow yourself")
            else:
                raise HTTPException(status_code=500, detail=f"Failed to follow user: {str(e)}")


@router.delete("/users/{user_id}/follow", response_model=SuccessResponse)
async def unfollow_user(
    user_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
) -> SuccessResponse:
    """
    Unfollow a user.
    
    - Idempotent (returns success even if not following)
    - Updates follower counts automatically via trigger
    """
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise InvalidInputError("Invalid user ID format")
    
    async with request.app.state.session_factory() as session:
        # Delete the follow relationship
        result = await session.execute(
            text("""
                DELETE FROM user_follows
                WHERE follower_id = :follower AND following_id = :following
            """),
            {"follower": current_user_id, "following": user_id}
        )
        
        await session.commit()
        
        # Get updated counts
        followers_count, following_count = await get_follow_counts(session, user_id)
        
        return SuccessResponse(
            message="Successfully unfollowed user",
            data={
                "following": False,
                "followers_count": followers_count,
                "following_count": following_count,
            }
        )


@router.get("/users/{user_id}/follow-status", response_model=SuccessResponse)
async def get_follow_status(
    user_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
) -> SuccessResponse:
    """
    Check if authenticated user follows the specified user.
    
    Also returns follower/following counts for the specified user.
    """
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise InvalidInputError("Invalid user ID format")
    
    async with request.app.state.session_factory() as session:
        # Check follow status
        following = await is_following(session, current_user_id, user_id)
        
        # Get counts
        followers_count, following_count = await get_follow_counts(session, user_id)
        
        return SuccessResponse(
            data={
                "following": following,
                "followers_count": followers_count,
                "following_count": following_count,
            }
        )


@router.get("/users/{user_id}/followers", response_model=SuccessResponse)
async def get_user_followers(
    user_id: str,
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    """
    Get a user's followers with pagination.
    
    Public endpoint - anyone can see who follows whom.
    """
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise InvalidInputError("Invalid user ID format")
    
    offset = (page - 1) * page_size
    
    async with request.app.state.session_factory() as session:
        # Get followers with accurate counts from user_follows
        result = await session.execute(
            text("""
                SELECT 
                    u.id,
                    u.full_name,
                    (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) as followers_count,
                    (SELECT COUNT(*) FROM user_follows WHERE follower_id = u.id) as following_count,
                    u.seller_verification_status,
                    u.created_at,
                    uf.created_at as followed_at
                FROM user_follows uf
                JOIN users u ON u.id = uf.follower_id
                WHERE uf.following_id = :uid AND u.is_active = TRUE
                ORDER BY uf.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"uid": user_id, "limit": page_size, "offset": offset}
        )
        
        followers = []
        for row in result:
            followers.append({
                "id": str(row[0]),
                "full_name": row[1],
                "followers_count": row[2],
                "following_count": row[3],
                "seller_verification_status": row[4],
                "created_at": str(row[5]),
                "followed_at": str(row[6]) if row[6] else None,
            })
        
        # Get total count
        count_result = await session.execute(
            text("""
                SELECT COUNT(*) FROM user_follows uf
                JOIN users u ON u.id = uf.follower_id
                WHERE uf.following_id = :uid AND u.is_active = TRUE
            """),
            {"uid": user_id}
        )
        total = count_result.scalar() or 0
        
        return SuccessResponse(
            data={
                "followers": followers,
                "meta": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size,
                    "has_next": page * page_size < total,
                    "has_prev": page > 1,
                }
            }
        )


@router.get("/users/{user_id}/following", response_model=SuccessResponse)
async def get_user_following(
    user_id: str,
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    """
    Get users that this user follows with pagination.
    
    Public endpoint.
    """
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise InvalidInputError("Invalid user ID format")
    
    offset = (page - 1) * page_size
    
    async with request.app.state.session_factory() as session:
        # Get following with accurate counts from user_follows
        result = await session.execute(
            text("""
                SELECT 
                    u.id,
                    u.full_name,
                    (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) as followers_count,
                    (SELECT COUNT(*) FROM user_follows WHERE follower_id = u.id) as following_count,
                    u.seller_verification_status,
                    u.created_at,
                    uf.created_at as followed_at
                FROM user_follows uf
                JOIN users u ON u.id = uf.following_id
                WHERE uf.follower_id = :uid AND u.is_active = TRUE
                ORDER BY uf.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"uid": user_id, "limit": page_size, "offset": offset}
        )
        
        following = []
        for row in result:
            following.append({
                "id": str(row[0]),
                "full_name": row[1],
                "followers_count": row[2],
                "following_count": row[3],
                "seller_verification_status": row[4],
                "created_at": str(row[5]),
                "followed_at": str(row[6]) if row[6] else None,
            })
        
        # Get total count
        count_result = await session.execute(
            text("""
                SELECT COUNT(*) FROM user_follows uf
                JOIN users u ON u.id = uf.following_id
                WHERE uf.follower_id = :uid AND u.is_active = TRUE
            """),
            {"uid": user_id}
        )
        total = count_result.scalar() or 0
        
        return SuccessResponse(
            data={
                "following": following,
                "meta": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size,
                    "has_next": page * page_size < total,
                    "has_prev": page > 1,
                }
            }
        )


@router.get("/me/followers", response_model=SuccessResponse)
async def get_my_followers(
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    """Get authenticated user's followers."""
    return await get_user_followers(current_user_id, request, page, page_size)


@router.get("/me/following", response_model=SuccessResponse)
async def get_my_following(
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    """Get users that authenticated user follows."""
    return await get_user_following(current_user_id, request, page, page_size)


@router.get("/users/search", response_model=SuccessResponse)
async def search_users(
    request: Request,
    q: str = Query(..., min_length=2),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SuccessResponse:
    """
    Search for users/sellers by name.
    
    Searches in: full_name
    Public endpoint.
    """
    offset = (page - 1) * page_size
    search_pattern = f"%{q}%"
    
    async with request.app.state.session_factory() as session:
        # Search users with listings count and profile info
        # Count followers/following directly from user_follows table for accuracy
        result = await session.execute(
            text("""
                SELECT 
                    u.id,
                    u.full_name,
                    (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) as followers_count,
                    (SELECT COUNT(*) FROM user_follows WHERE follower_id = u.id) as following_count,
                    u.seller_verification_status,
                    u.created_at,
                    u.phone_verified as is_phone_verified,
                    p.bio,
                    p.city,
                    p.state,
                    p.country,
                    p.profile_photo_url,
                    (SELECT COUNT(*) FROM listings l 
                     WHERE CAST(l.seller_id AS TEXT) = CAST(u.id AS TEXT) 
                     AND l.status = 'active') as listings_count
                FROM users u
                LEFT JOIN user_profiles p ON CAST(p.user_id AS TEXT) = CAST(u.id AS TEXT)
                WHERE u.is_active = TRUE 
                  AND (u.full_name ILIKE :pattern)
                ORDER BY 
                    CASE WHEN u.seller_verification_status = 'verified' THEN 0 ELSE 1 END,
                    (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) DESC,
                    u.full_name
                LIMIT :limit OFFSET :offset
            """),
            {"pattern": search_pattern, "limit": page_size, "offset": offset}
        )
        
        users = []
        for row in result:
            users.append({
                "id": str(row[0]),
                "full_name": row[1],
                "followers_count": row[2],
                "following_count": row[3],
                "seller_verification_status": row[4],
                "created_at": str(row[5]) if row[5] else None,
                "is_phone_verified": bool(row[6]) if row[6] is not None else False,
                "bio": row[7],
                "city": row[8],
                "state": row[9],
                "country": row[10],
                "profile_photo_url": row[11],
                "listings_count": row[12] if row[12] is not None else 0,
            })
        
        # Get total count
        count_result = await session.execute(
            text("""
                SELECT COUNT(*) FROM users u
                WHERE u.is_active = TRUE 
                  AND (u.full_name ILIKE :pattern)
            """),
            {"pattern": search_pattern}
        )
        total = count_result.scalar() or 0
        
        return SuccessResponse(
            data={
                "users": users,
                "meta": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size,
                    "has_next": page * page_size < total,
                    "has_prev": page > 1,
                }
            }
        )
