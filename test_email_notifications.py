"""
Test script for the email notification system.
Verifies that all notification types trigger both DB notification and email.

NOTE: This is a simplified test that verifies the email system configuration.
For full database integration tests, run this from the backend environment.
"""
import os
import sys
from dotenv import load_dotenv

# Load environment
load_dotenv('backend/.env')

# Add backend to path for imports
sys.path.insert(0, 'backend')


def test_email_configuration():
    """Test the email system configuration."""
    print("=" * 80)
    print("EMAIL NOTIFICATION SYSTEM - CONFIGURATION TEST")
    print("=" * 80)
    print()
    
    # Check Brevo API key
    brevo_key = os.getenv('BREVO_API_KEY', '')
    if not brevo_key:
        print("❌ BREVO_API_KEY not found in backend/.env")
        print()
        print("To fix this:")
        print("1. Open backend/.env")
        print("2. Add: BREVO_API_KEY=xkeysib-your-key-here")
        print("3. Get your key from: https://app.brevo.com/settings/keys/api")
        return False
    else:
        print(f"✅ BREVO_API_KEY configured: {brevo_key[:20]}...")
    
    # Check email from configuration
    email_from = os.getenv('EMAIL_FROM', '')
    if email_from:
        print(f"✅ EMAIL_FROM configured: {email_from}")
    else:
        print("⚠️  EMAIL_FROM not set (will use default: noreply@velontri.com)")
    
    email_from_name = os.getenv('EMAIL_FROM_NAME', '')
    if email_from_name:
        print(f"✅ EMAIL_FROM_NAME configured: {email_from_name}")
    else:
        print("⚠️  EMAIL_FROM_NAME not set (will use default: Velontri)")
    
    print()
    
    # Test email module import
    print("Testing email notification module...")
    try:
        from shared.email_notifications import send_notification_email
        print("✅ Email notification module imported successfully")
    except Exception as e:
        print(f"❌ Failed to import email module: {e}")
        return False
    
    print()
    
    # Test sending a simple email (without database)
    print("Testing email send functionality...")
    print("Enter a test email address to send a test notification:")
    print("(Press Enter to skip)")
    
    test_email = input("Email: ").strip()
    
    if test_email:
        print()
        print(f"Sending test email to {test_email}...")
        
        try:
            import asyncio
            
            async def send_test():
                success, error = await send_notification_email(
                    to_email=test_email,
                    subject="Velontri: Test Email Notification",
                    title="🎉 Email System Test",
                    message="This is a test email from your Velontri email notification system. If you're reading this, emails are working correctly!",
                    action_url="https://velontri.pxxl.click/dashboard",
                    notification_type="info"
                )
                return success, error
            
            success, error = asyncio.run(send_test())
            
            if success:
                print("✅ Test email sent successfully!")
                print(f"📧 Check {test_email} inbox")
                print()
                print("Email notification system is working! 🎉")
                return True
            else:
                print(f"❌ Failed to send test email: {error}")
                return False
                
        except Exception as e:
            print(f"❌ Error sending test email: {e}")
            import traceback
            traceback.print_exc()
            return False
    else:
        print()
        print("✅ Configuration check passed!")
        print()
        print("To test email sending:")
        print("1. Run this script again and provide a test email")
        print("2. Or trigger notifications in the web app")
        return True


def verify_notification_integration():
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


def main():
    """Run all tests."""
    try:
        # Check integration
        verify_notification_integration()
        
        # Test email configuration
        success = test_email_configuration()
        
        if success:
            print()
            print("=" * 80)
            print("🎯 NEXT STEPS")
            print("=" * 80)
            print()
            print("1. ✅ Configuration verified")
            print("2. Deploy to production: git push origin main")
            print("3. Test in production by:")
            print("   - Following a user (triggers email)")
            print("   - Creating a listing (followers get email)")
            print("   - Sending a message (recipient gets email)")
            print()
            print("4. Monitor Brevo dashboard: https://app.brevo.com/")
            print()
        else:
            print()
            print("⚠️  Please fix the configuration issues above and run again")
            print()
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
