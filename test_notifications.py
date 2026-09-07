"""
Test script to verify the notification system works correctly.
This creates test notifications directly in the database.
"""
import asyncio
import uuid
from sqlalchemy import text
from backend.shared.database import create_engine
from backend.shared.config import BaseServiceSettings


async def test_notifications():
    """Create test notifications to verify the system works."""
    settings = BaseServiceSettings()
    engine = create_engine(settings.DATABASE_URL)
    
    print("🔔 Testing Notification System")
    print("=" * 60)
    
    async with engine.begin() as conn:
        # Get a test user
        result = await conn.execute(text("""
            SELECT id, full_name, email FROM users 
            WHERE is_active = TRUE 
            LIMIT 1
        """))
        user = result.first()
        
        if not user:
            print("❌ No active users found. Create a user first.")
            return
        
        user_id = str(user[0])
        user_name = user[1]
        user_email = user[2]
        
        print(f"✅ Test User: {user_name} ({user_email})")
        print(f"   User ID: {user_id}")
        print()
        
        # Test 1: Create a NEW_FOLLOWER notification
        print("📝 Test 1: Creating NEW_FOLLOWER notification...")
        try:
            await conn.execute(text("""
                INSERT INTO notifications (
                    id,
                    recipient_user_id,
                    user_id,
                    notification_type,
                    title,
                    message,
                    sender_user_id,
                    sender_role,
                    related_resource_type,
                    related_resource_id,
                    action_url,
                    is_read,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    :recipient,
                    :recipient,
                    'NEW_FOLLOWER',
                    'New Follower',
                    'Test User started following you',
                    :sender,
                    'Test User',
                    'user',
                    :sender,
                    '/dashboard/followers',
                    FALSE,
                    NOW()
                )
            """), {
                "recipient": user_id,
                "sender": str(uuid.uuid4()),
            })
            print("   ✅ NEW_FOLLOWER notification created")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
        
        # Test 2: Create a listing_approved notification
        print("📝 Test 2: Creating listing_approved notification...")
        try:
            await conn.execute(text("""
                INSERT INTO notifications (
                    id,
                    recipient_user_id,
                    user_id,
                    notification_type,
                    title,
                    message,
                    sender_user_id,
                    sender_role,
                    related_resource_type,
                    related_resource_id,
                    action_url,
                    is_read,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    :recipient,
                    :recipient,
                    'listing_approved',
                    'Listing Approved',
                    'Your listing has been approved and is now live!',
                    :sender,
                    'Moderation Team',
                    'listing',
                    :listing_id,
                    '/dashboard/listings',
                    FALSE,
                    NOW()
                )
            """), {
                "recipient": user_id,
                "sender": user_id,
                "listing_id": str(uuid.uuid4()),
            })
            print("   ✅ listing_approved notification created")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
        
        # Test 3: Create a system notification
        print("📝 Test 3: Creating system notification...")
        try:
            await conn.execute(text("""
                INSERT INTO notifications (
                    id,
                    recipient_user_id,
                    user_id,
                    notification_type,
                    title,
                    message,
                    is_read,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    :recipient,
                    :recipient,
                    'system',
                    'Welcome to Velontri',
                    'Test system notification to verify the notification system works correctly.',
                    FALSE,
                    NOW()
                )
            """), {
                "recipient": user_id,
            })
            print("   ✅ system notification created")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
        
        # Verify notifications were created
        print()
        print("📊 Verifying notifications...")
        result = await conn.execute(text("""
            SELECT 
                notification_type,
                title,
                message,
                is_read,
                created_at
            FROM notifications
            WHERE (recipient_user_id = :uid OR user_id = :uid)
            ORDER BY created_at DESC
            LIMIT 10
        """), {"uid": user_id})
        
        notifications = result.fetchall()
        print(f"   ✅ Found {len(notifications)} total notifications for user")
        print()
        print("   Recent notifications:")
        for notif in notifications[:5]:
            print(f"     • [{notif[0]}] {notif[1]}")
            print(f"       {notif[2][:60]}...")
            print(f"       Read: {notif[3]} | {notif[4]}")
            print()
    
    await engine.dispose()
    
    print("=" * 60)
    print("✅ Notification system test complete!")
    print()
    print("🌐 Next steps:")
    print("   1. Log in to your Velontri account")
    print("   2. Go to /dashboard/notifications")
    print("   3. You should see the test notifications")
    print("   4. Click on a notification to mark it as read")
    print("   5. Click 'Mark all read' to clear all")


if __name__ == "__main__":
    asyncio.run(test_notifications())
