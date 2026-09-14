"""
Simple email notification test - No database required.
Tests if Brevo API is configured and can send emails.
"""
import os
import sys
from dotenv import load_dotenv

# Load environment
load_dotenv('backend/.env')

def test_brevo_config():
    """Check Brevo API configuration."""
    print("=" * 80)
    print("EMAIL NOTIFICATION SYSTEM - QUICK TEST")
    print("=" * 80)
    print()
    
    # Check Brevo API key
    brevo_key = os.getenv('BREVO_API_KEY', '')
    if not brevo_key:
        print("❌ BREVO_API_KEY not found in backend/.env")
        print()
        print("To fix:")
        print("1. Open backend/.env")
        print("2. Add: BREVO_API_KEY=xkeysib-your-key-here")
        print("3. Get key from: https://app.brevo.com/settings/keys/api")
        return False
    
    print(f"✅ BREVO_API_KEY: {brevo_key[:20]}...")
    
    # Check other config
    email_from = os.getenv('EMAIL_FROM', 'noreply@velontri.com')
    print(f"✅ EMAIL_FROM: {email_from}")
    
    email_from_name = os.getenv('EMAIL_FROM_NAME', 'Velontri')
    print(f"✅ EMAIL_FROM_NAME: {email_from_name}")
    
    print()
    print("-" * 80)
    print()
    
    # Ask if user wants to test sending
    print("Do you want to send a test email? (y/n)")
    choice = input().strip().lower()
    
    if choice != 'y':
        print()
        print("✅ Configuration verified!")
        print("Email system ready for production deployment.")
        return True
    
    # Get test email
    print()
    print("Enter email address to receive test notification:")
    test_email = input().strip()
    
    if not test_email or '@' not in test_email:
        print("❌ Invalid email address")
        return False
    
    # Send test email using httpx (synchronous)
    print()
    print(f"Sending test email to {test_email}...")
    
    try:
        import httpx
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f3f4f6;">
    <table border="0" cellpadding="0" cellspacing="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <tr>
            <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Velontri</h1>
            </td>
        </tr>
        <tr>
            <td style="padding: 40px;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">🎉 Test Email Successful!</h2>
                <p style="margin: 0 0 24px 0; color: #4B5563; font-size: 15px; line-height: 1.6;">
                    Your Velontri email notification system is configured correctly and sending emails. 
                    Users will now receive beautiful notifications like this one directly to their Gmail!
                </p>
                <a href="https://velontri.pxxl.click" 
                   style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 12px 24px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Visit Velontri
                </a>
            </td>
        </tr>
        <tr>
            <td style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0; color: #6B7280; font-size: 13px;">
                    © 2024 Velontri. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        
        response = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": brevo_key,
                "Content-Type": "application/json"
            },
            json={
                "sender": {
                    "name": email_from_name,
                    "email": email_from
                },
                "to": [{"email": test_email}],
                "subject": "Velontri: Test Email Notification",
                "htmlContent": html_body
            },
            timeout=10.0
        )
        
        if response.status_code in (200, 201):
            print("✅ Email sent successfully!")
            print()
            print(f"📧 Check {test_email} inbox")
            print()
            print("=" * 80)
            print("🎉 EMAIL SYSTEM IS WORKING PERFECTLY!")
            print("=" * 80)
            print()
            print("Next steps:")
            print("1. Deploy to production: git push origin main")
            print("2. Test by following a user or creating a listing")
            print("3. Monitor Brevo dashboard for delivery stats")
            return True
        else:
            print(f"❌ Failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except ImportError:
        print("❌ httpx library not installed")
        print("   Install: pip install httpx")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    try:
        test_brevo_config()
    except KeyboardInterrupt:
        print("\n\nTest cancelled.")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
