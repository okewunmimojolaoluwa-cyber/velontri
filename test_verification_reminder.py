"""
Quick test for verification reminder system.
Tests both web notifications and email sending.
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
ROOT = Path(__file__).resolve() / 'backend'
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv('backend/.env')

async def test_reminder_system():
    """Test the verification reminder system."""
    print("\n" + "="*80)
    print("VERIFICATION REMINDER SYSTEM TEST")
    print("="*80 + "\n")
    
    # Import after path is set
    from backend.scripts.verification_reminder_worker import send_verification_reminders
    
    print("Running reminder worker (will check for unverified users)...")
    print()
    
    try:
        count = await send_verification_reminders()
        
        print("\n" + "="*80)
        print("✅ TEST COMPLETE")
        print("="*80)
        print(f"\nReminders sent: {count}")
        print()
        print("What was sent:")
        print("  1. Web notifications → Created in database")
        print("  2. Email notifications → Sent via Brevo to Gmail")
        print()
        print("Check:")
        print("  • User dashboard notifications (bell icon)")
        print("  • Gmail inbox for email notifications")
        print("  • Brevo dashboard: https://app.brevo.com/")
        print()
        
    except Exception as e:
        print("\n" + "="*80)
        print("❌ TEST FAILED")
        print("="*80)
        print(f"\nError: {e}")
        print()
        print("Common issues:")
        print("  1. DATABASE_URL not set in backend/.env")
        print("  2. BREVO_API_KEY not set in backend/.env")
        print("  3. No unverified users in database")
        print()
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_reminder_system())
