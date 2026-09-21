"""Test script to verify email notifications for unverified users"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'backend'))

from dotenv import load_dotenv
load_dotenv(ROOT / 'backend' / '.env')

from sqlalchemy import text
from backend.shared.database import get_supabase_session_factory
from backend.shared.email_notifications import send_notification_email
from backend.shared.logging import get_logger

logger = get_logger(__name__)


async def test_verification_emails():
    """Test sending verification emails"""
    session_factory = get_supabase_session_factory()
    
    print("=" * 70)
    print("VERIFICATION EMAIL TEST")
    print("=" * 70)
    print()
    
    async with session_factory() as session:
        # Check for unverified users
        print("1. Checking for unverified users...")
        result = await session.execute(text("""
            SELECT 
                CAST(id AS TEXT) as user_id,
                email,
                full_name,
                seller_verification_status,
                is_phone_verified,
                created_at
            FROM users
            WHERE seller_verification_status IN ('not_verified', 'pending', 'rejected')
            AND email IS NOT NULL
            AND email != ''
            ORDER BY created_at DESC
            LIMIT 10
        """))
        
        users = result.mappings().all()
        
        if not users:
            print("   ❌ No unverified users found in database")
            print()
            
            # Check all users
            all_result = await session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email,
                    COUNT(CASE WHEN seller_verification_status = 'verified' THEN 1 END) as verified,
                    COUNT(CASE WHEN seller_verification_status = 'not_verified' THEN 1 END) as not_verified,
                    COUNT(CASE WHEN seller_verification_status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN seller_verification_status = 'rejected' THEN 1 END) as rejected
                FROM users
            """))
            stats = all_result.mappings().first()
            
            print(f"   Database stats:")
            print(f"   - Total users: {stats['total']}")
            print(f"   - With email: {stats['with_email']}")
            print(f"   - Verified: {stats['verified']}")
            print(f"   - Not verified: {stats['not_verified']}")
            print(f"   - Pending: {stats['pending']}")
            print(f"   - Rejected: {stats['rejected']}")
            return
        
        print(f"   ✅ Found {len(users)} unverified user(s)")
        print()
        
        # Display users
        print("2. Unverified users:")
        for i, user in enumerate(users, 1):
            print(f"\n   User {i}:")
            print(f"   - ID: {user['user_id']}")
            print(f"   - Email: {user['email']}")
            print(f"   - Name: {user['full_name'] or 'N/A'}")
            print(f"   - Status: {user['seller_verification_status']}")
            print(f"   - Phone verified: {user['is_phone_verified']}")
            print(f"   - Created: {user['created_at']}")
        
        print()
        print("=" * 70)
        print()
        
        # Test sending email to first user
        if users:
            test_user = users[0]
            email = test_user['email']
            name = test_user['full_name'] or 'Seller'
            status = test_user['seller_verification_status']
            
            print(f"3. Testing email send to: {email}")
            print(f"   Name: {name}")
            print(f"   Status: {status}")
            print()
            
            # Determine message based on status
            if status == 'rejected':
                title = "Resubmit Your Verification"
                message = "Your previous verification was rejected. Please review the feedback and resubmit with the required documents to start selling on Velontri."
                subject = "Velontri: Resubmit Your Verification"
            elif status == 'pending':
                title = "Verification Under Review"
                message = "Your seller verification is currently being reviewed by our team. This process typically takes 24-48 hours. We'll notify you as soon as it's complete!"
                subject = "Velontri: Verification Under Review"
            else:  # not_verified
                title = "Complete Your Seller Verification"
                message = "Get verified to build trust with buyers! Verified sellers get 3× more inquiries and sell faster. The verification process only takes 5 minutes. Complete it now to unlock your full selling potential!"
                subject = "Velontri: Complete Your Seller Verification"
            
            action_url = "https://velontri.pxxl.click/dashboard/verification"
            
            print(f"   Sending email...")
            print(f"   - Subject: {subject}")
            print(f"   - Title: {title}")
            print(f"   - Action URL: {action_url}")
            print()
            
            success, error = await send_notification_email(
                to_email=email,
                subject=subject,
                title=title,
                message=message,
                action_url=action_url,
                notification_type="alert" if status == 'rejected' else "info"
            )
            
            if success:
                print(f"   ✅ Email sent successfully to {email}!")
                print()
                print("   Check your inbox (and spam folder) for the email.")
            else:
                print(f"   ❌ Email failed to send: {error}")
                print()
                print("   Possible issues:")
                print("   - BREVO_API_KEY might be invalid or expired")
                print("   - Brevo account might have sending limits")
                print("   - Email address might be invalid")
                print("   - Network connectivity issues")
    
    print()
    print("=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(test_verification_emails())
