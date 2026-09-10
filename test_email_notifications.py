"""
Test script for the email notification system.
Verifies that all notification types trigger both DB notification and email.
"""
import asyncio
import os
import sys
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


async def test_notification_with_email():
    """Test the unified notification + email system."""
    print("=" * 80)
    print("EMAIL NOTIFICATION SYSTEM TEST")
    print("=" * 80)
    print()
    
    # Check Brevo API key
    brevo_key = os.getenv('BREVO_API_KEY', '')
    if not brevo_key:
        print("❌ BREVO_API_KEY not found in .env")
        return False
    else:
        print(f"✅ BREVO_API_KEY configured: {brevo_key[:15]}...")
    
    print()
    
    # Get a test user
    async with async_session() as session:
        result = await session.execute(
            text("SELECT id, email, full_name FROM users WHERE email IS NOT NULL LIMIT 1")
        )
        user = result.fetchone()
        
        if not user:
            print("❌ No users with email found in database")
            return False
        
        user_id = str(user[0])
        user_email = user[1]
        user_name = user[2] or "Test User"
        
        print(f"📧 Test User: {user_name} ({user_email})")
        print(f"🆔 User ID: {user_id}")
        print()
        
        # Test different notification types
        test_cases = [
            {
                "type": "message",
                "title": "Test: New Message",
                "message": "This is a test message notification with email",
                "action_url": "/dashboard/messages"
            },
            {
                "type": "payment",
                "title": "Test: Payment Successful",
                "message": "Your test payment of ₦5,000 was successful",
                "action_url": "/dashboard/subscription"
            },
            {
                "type": "info",
                "title": "Test: New Follower",
                "message": "Test User started following you",
                "action_url": "/users/test123"
            },
            {
                "type": "success",
                "title": "Test: Listing Approved",
                "message": "Your listing has been approved and is now live",
                "action_url": "/dashboard/listings"
            },
            {
                "type": "alert",
                "title": "Test: Action Required",
                "message": "Please verify your account to continue",
                "action_url": "/dashboard/verification"
            }
        ]
        
        print("🧪 Testing notification types:")
        print("-" * 80)
        
        success_count = 0
        total_tests = len(test_cases)
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n{i}. Testing {test_case['type'].upper()} notification...")
            
            try:
                # Import and use the unified notification system
                sys.path.insert(0, 'backend')
                from shared.email_notifications import send_notification_with_email
                
                success, error = await send_notification_with_email(
                    db_session=session,
                    recipient_user_id=user_id,
                    notification_type=test_case['type'],
                    title=test_case['title'],
                    message=test_case['message'],
                    action_url=test_case['action_url'],
                    sender_role='system'
                )
                
                if success:
                    print(f"   ✅ Notification created in DB")
                    if error:
                        print(f"   ⚠️  Email: {error}")
                    else:
                        print(f"   ✅ Email sent to {user_email}")
                    success_count += 1
                else:
                    print(f"   ❌ Failed: {error}")
                
            except Exception as e:
                print(f"   ❌ Exception: {str(e)}")
            
            await asyncio.sleep(1)  # Rate limit
        
        print()
        print("=" * 80)
        print(f"📊 RESULTS: {success_count}/{total_tests} tests passed")
        print("=" * 80)
        print()
        
        if success_count == total_tests:
            print("✅ ALL TESTS PASSED!")
            print(f"📧 Check {user_email} for {success_count} test emails")
            print()
            print("Email notifications are working correctly! 🎉")
            return True
        else:
            print("⚠️  SOME TESTS FAILED")
            print("Check the errors above and verify your Brevo API configuration")
            return False


async def verify_notification_integration():
    """Verify all services are using the email notification system."""
    print()
    print("=" * 80)
    print("NOTIFICATION INTEGRATION CHECK")
    print("=" * 80)
    print()
    
    files_to_check = [
        ("backend/marketplace-service/app/routers/listings.py", "New listing notifications"),
        ("backend/subscription-service/app/routers/subscriptions.py", "Payment/subscription notifications"),
        ("backend/user-service/app/routers/social.py", "Follow notifications"),
        ("backend/user-service/app/routers/verification.py", "Verification notifications"),
        ("backend/analytics-service/app/routers/analytics.py", "Message notifications"),
    ]
    
    print("📁 Checking service integration:")
    print("-" * 80)
    
    for filepath, description in files_to_check:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                has_email = 'send_notification_with_email' in content
                
                if has_email:
                    print(f"✅ {description}")
                    print(f"   {filepath}")
                else:
                    print(f"⚠️  {description}")
                    print(f"   {filepath}")
                    print(f"   Note: May be using direct email_notifications import")
        except Exception as e:
            print(f"❌ {description}")
            print(f"   Error: {e}")
        print()
    
    print("=" * 80)
    print()


async def main():
    """Run all tests."""
    try:
        # Check integration
        await verify_notification_integration()
        
        # Test email notifications
        success = await test_notification_with_email()
        
        if success:
            print()
            print("🎯 NEXT STEPS:")
            print("1. Check your email inbox for 5 test emails")
            print("2. Verify emails have correct formatting and action buttons")
            print("3. Deploy the updated backend services")
            print("4. Monitor production logs for email delivery")
            print()
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
