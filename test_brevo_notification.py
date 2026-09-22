#!/usr/bin/env python3
"""
Test script for Brevo email notifications.
Tests the notification service email sending with Brevo API.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

async def test_brevo_email():
    """Test Brevo email sending through notification service."""
    from dotenv import load_dotenv
    load_dotenv(backend_path / ".env")
    
    # Import after setting up path
    from notification_service.app.channels import send_email
    
    # Get config from environment
    brevo_key = os.getenv("BREVO_API_KEY", "").strip()
    email_from = os.getenv("EMAIL_FROM", "okewunmimojolaoluwa@gmail.com")
    email_from_name = os.getenv("EMAIL_FROM_NAME", "Velontri")
    
    # Test email
    test_email = input("Enter test email address (default: okewunmimojolaoluwa@gmail.com): ").strip()
    if not test_email:
        test_email = "okewunmimojolaoluwa@gmail.com"
    
    print(f"\n{'='*60}")
    print("Testing Brevo Email Notification System")
    print(f"{'='*60}")
    print(f"API Key: {'✓ Configured' if brevo_key else '✗ Missing'}")
    print(f"From Email: {email_from}")
    print(f"From Name: {email_from_name}")
    print(f"To Email: {test_email}")
    print(f"{'='*60}\n")
    
    if not brevo_key:
        print("❌ ERROR: BREVO_API_KEY not found in environment")
        print("Please set BREVO_API_KEY in backend/.env")
        return False
    
    # Test HTML email
    subject = "🎉 Velontri Email Notification Test"
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
    <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Velontri</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Africa's #1 Marketplace</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Email System Test</h2>
            
            <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                Great news! Your email notification system is working perfectly. This test email confirms that:
            </p>
            
            <ul style="color: #475569; line-height: 1.8; margin: 0 0 24px 0; padding-left: 24px;">
                <li>✅ Brevo API connection is successful</li>
                <li>✅ Email configuration is correct</li>
                <li>✅ Notifications can be delivered to Gmail</li>
                <li>✅ HTML templates are rendering properly</li>
            </ul>
            
            <div style="background: #f1f5f9; border-left: 4px solid #667eea; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #475569; margin: 0; font-size: 14px;">
                    <strong style="color: #1e293b;">Test Details:</strong><br>
                    Timestamp: {asyncio.get_event_loop().time()}<br>
                    Service: Brevo (api.brevo.com)<br>
                    Status: Active
                </p>
            </div>
            
            <p style="color: #475569; line-height: 1.6; margin: 24px 0 0 0;">
                Your users will now receive:
            </p>
            
            <ul style="color: #475569; line-height: 1.8; margin: 12px 0 0 0; padding-left: 24px;">
                <li>Welcome emails on registration</li>
                <li>OTP verification codes</li>
                <li>Password reset links</li>
                <li>Order and listing notifications</li>
                <li>Important account updates</li>
            </ul>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 24px 30px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 13px; margin: 0; text-align: center;">
                This is an automated test email from Velontri<br>
                <a href="https://velontri.com" style="color: #667eea; text-decoration: none;">velontri.com</a>
            </p>
        </div>
    </div>
</body>
</html>
    """
    
    print("Sending test email...")
    try:
        success, reason = await send_email(
            to_email=test_email,
            subject=subject,
            html_body=html_body,
            api_key=brevo_key,
            from_email=email_from,
            from_name=email_from_name
        )
        
        if success:
            print("\n✅ SUCCESS! Email sent successfully")
            print(f"\n📧 Check your inbox at: {test_email}")
            print("   (Check spam folder if you don't see it within 1-2 minutes)")
            return True
        else:
            print(f"\n❌ FAILED: {reason}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n🔧 Velontri Email Notification Test")
    print("Testing Brevo email integration...\n")
    
    result = asyncio.run(test_brevo_email())
    
    print(f"\n{'='*60}")
    if result:
        print("✅ Email notification system is working correctly!")
        print("\nNext steps:")
        print("1. Check the test email in your inbox")
        print("2. Verify registration emails are working")
        print("3. Test OTP delivery for new users")
    else:
        print("❌ Email notification system needs attention")
        print("\nTroubleshooting:")
        print("1. Verify BREVO_API_KEY in backend/.env")
        print("2. Check Brevo dashboard for API errors")
        print("3. Ensure sender email is verified in Brevo")
    print(f"{'='*60}\n")
    
    sys.exit(0 if result else 1)
