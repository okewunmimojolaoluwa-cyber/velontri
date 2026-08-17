"""
Quick test — runs Brevo email send directly.
Usage (from backend/ dir):
    python scripts/test_brevo_email.py your@email.com
"""
import asyncio
import sys
import os

# Allow running from backend/ or project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def test_brevo(to_email: str) -> None:
    import httpx

    brevo_key = os.environ.get(
        "BREVO_API_KEY",
        "",  # set BREVO_API_KEY env var before running
    )
    if not brevo_key:
        print("ERROR: BREVO_API_KEY environment variable is not set.")
        print("Run: set BREVO_API_KEY=your_key_here  (Windows)")
        print("  or export BREVO_API_KEY=your_key_here  (Linux/Mac)")
        return
    sender_email = os.environ.get("EMAIL_FROM", "okewunmimojolaoluwa@gmail.com")

    print(f"Sending test OTP email via Brevo...")
    print(f"  From : {sender_email}")
    print(f"  To   : {to_email}")
    print(f"  Key  : {brevo_key[:20]}...")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": brevo_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "sender": {"name": "Velontri", "email": sender_email},
                "to": [{"email": to_email}],
                "subject": "Velontri OTP Test — 123456",
                "textContent": "Your test OTP is: 123456\n\nThis is a delivery test.",
                "htmlContent": "<p>Your test OTP is: <strong>123456</strong></p><p>This is a delivery test from Velontri.</p>",
            },
        )

    print(f"\nStatus : {resp.status_code}")
    print(f"Body   : {resp.text[:500]}")

    if resp.status_code in (200, 201, 202):
        print("\n✅ SUCCESS — email dispatched via Brevo. Check inbox (and spam).")
    else:
        print("\n❌ FAILED — see error body above.")
        if resp.status_code == 401:
            print("   → API key is invalid or not set in environment.")
        elif resp.status_code == 400:
            print("   → Bad request — sender email may not be verified in Brevo.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_brevo_email.py <recipient@email.com>")
        sys.exit(1)
    asyncio.run(test_brevo(sys.argv[1]))
