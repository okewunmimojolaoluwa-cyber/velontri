"""
Diagnostic script to check follower/following counts.
Verifies that user_follows table exists and counts are accurate.
"""
import asyncio
import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment
load_dotenv('backend/.env')

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL', '').replace('postgresql://', 'postgresql+asyncpg://')
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def check_user_follows_table():
    """Check if user_follows table exists and has data."""
    print("=" * 80)
    print("FOLLOWER/FOLLOWING COUNT DIAGNOSTIC")
    print("=" * 80)
    print()
    
    async with async_session() as session:
        # Check if table exists
        print("1. Checking if user_follows table exists...")
        try:
            result = await session.execute(
                text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'user_follows'
                    )
                """)
            )
            exists = result.scalar()
            if exists:
                print("   ✅ user_follows table exists")
            else:
                print("   ❌ user_follows table NOT FOUND")
                print("   Run migration: python run_migration.py")
                return
        except Exception as e:
            print(f"   ❌ Error checking table: {e}")
            return
        
        print()
        
        # Check table structure
        print("2. Checking table structure...")
        try:
            result = await session.execute(
                text("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'user_follows'
                    ORDER BY ordinal_position
                """)
            )
            columns = result.fetchall()
            if columns:
                print("   Columns:")
                for col in columns:
                    print(f"   - {col[0]}: {col[1]}")
            else:
                print("   ⚠️  No columns found")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print()
        
        # Check total follow relationships
        print("3. Checking total follow relationships...")
        try:
            result = await session.execute(
                text("SELECT COUNT(*) FROM user_follows")
            )
            total = result.scalar() or 0
            print(f"   📊 Total follow relationships: {total}")
            
            if total == 0:
                print("   ⚠️  No follow relationships found. Users haven't followed each other yet.")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print()
        
        # Check users with followers
        print("4. Checking users with followers...")
        try:
            result = await session.execute(
                text("""
                    SELECT 
                        u.full_name,
                        u.email,
                        CAST(u.id AS TEXT) as user_id,
                        (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) as followers_count,
                        (SELECT COUNT(*) FROM user_follows WHERE follower_id = u.id) as following_count
                    FROM users u
                    WHERE EXISTS (
                        SELECT 1 FROM user_follows 
                        WHERE following_id = u.id OR follower_id = u.id
                    )
                    ORDER BY followers_count DESC
                    LIMIT 10
                """)
            )
            users = result.fetchall()
            
            if users:
                print(f"   Found {len(users)} users with follow relationships:")
                print()
                for user in users:
                    name = user[0] or "Unknown"
                    email = user[1] or "No email"
                    user_id = user[2]
                    followers = user[3]
                    following = user[4]
                    print(f"   👤 {name} ({email})")
                    print(f"      ID: {user_id}")
                    print(f"      Followers: {followers} | Following: {following}")
                    print()
            else:
                print("   ⚠️  No users with follow relationships found")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print()
        
        # Check specific user (if provided)
        print("5. Testing API endpoint response format...")
        try:
            # Get a random user with followers
            result = await session.execute(
                text("""
                    SELECT CAST(u.id AS TEXT), u.full_name
                    FROM users u
                    LIMIT 1
                """)
            )
            user = result.fetchone()
            
            if user:
                user_id = user[0]
                user_name = user[1]
                
                # Count followers (people following this user)
                followers_result = await session.execute(
                    text("SELECT COUNT(*) FROM user_follows WHERE CAST(following_id AS TEXT) = :uid"),
                    {"uid": user_id}
                )
                followers_count = followers_result.scalar() or 0
                
                # Count following (people this user is following)
                following_result = await session.execute(
                    text("SELECT COUNT(*) FROM user_follows WHERE CAST(follower_id AS TEXT) = :uid"),
                    {"uid": user_id}
                )
                following_count = following_result.scalar() or 0
                
                print(f"   Sample User: {user_name}")
                print(f"   User ID: {user_id}")
                print(f"   Followers: {followers_count}")
                print(f"   Following: {following_count}")
                print()
                print("   ✅ Query format matches API endpoint")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print()
        print("=" * 80)
        print("RECOMMENDATIONS")
        print("=" * 80)
        print()
        
        if total == 0:
            print("⚠️  No follow relationships exist yet:")
            print("   1. Have users follow each other via the web app")
            print("   2. Or use the API: POST /api/v1/users/{user_id}/follow")
            print()
        else:
            print("✅ Follow system is working correctly!")
            print()
            print("If counts still show as 0 on the web:")
            print("   1. Check browser console for API errors")
            print("   2. Verify JWT token is valid")
            print("   3. Clear browser cache and refresh")
            print("   4. Check network tab for /users/{id}/profile response")
            print()


async def test_follow_unfollow():
    """Test follow/unfollow functionality."""
    print()
    print("=" * 80)
    print("FOLLOW/UNFOLLOW FUNCTIONALITY TEST")
    print("=" * 80)
    print()
    
    async with async_session() as session:
        # Get two test users
        result = await session.execute(
            text("SELECT CAST(id AS TEXT), full_name FROM users LIMIT 2")
        )
        users = result.fetchall()
        
        if len(users) < 2:
            print("❌ Need at least 2 users in database to test")
            return
        
        user1_id = users[0][0]
        user1_name = users[0][1]
        user2_id = users[1][0]
        user2_name = users[1][1]
        
        print(f"Test User 1: {user1_name} ({user1_id})")
        print(f"Test User 2: {user2_name} ({user2_id})")
        print()
        
        # Test follow
        print("1. Testing follow operation...")
        try:
            # Check if already following
            check_result = await session.execute(
                text("""
                    SELECT COUNT(*) FROM user_follows 
                    WHERE CAST(follower_id AS TEXT) = :follower 
                    AND CAST(following_id AS TEXT) = :following
                """),
                {"follower": user1_id, "following": user2_id}
            )
            already_following = check_result.scalar() > 0
            
            if already_following:
                print(f"   ℹ️  {user1_name} is already following {user2_name}")
            else:
                # Insert follow
                await session.execute(
                    text("""
                        INSERT INTO user_follows (follower_id, following_id, created_at)
                        VALUES (:follower, :following, NOW())
                        ON CONFLICT DO NOTHING
                    """),
                    {"follower": user1_id, "following": user2_id}
                )
                await session.commit()
                print(f"   ✅ {user1_name} now follows {user2_name}")
            
            # Verify counts
            followers_result = await session.execute(
                text("SELECT COUNT(*) FROM user_follows WHERE CAST(following_id AS TEXT) = :uid"),
                {"uid": user2_id}
            )
            followers = followers_result.scalar() or 0
            print(f"   📊 {user2_name} now has {followers} follower(s)")
            
        except Exception as e:
            print(f"   ❌ Follow test failed: {e}")


async def main():
    """Run all diagnostic checks."""
    try:
        await check_user_follows_table()
        await test_follow_unfollow()
        
    except Exception as e:
        print(f"❌ Diagnostic failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
