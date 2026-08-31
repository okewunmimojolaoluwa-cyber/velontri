"""
Fix subscription for user 09158200927 (amirmojolaoluwa@gmail.com).
The subscription row was created by the previous run with tier=growth.
This script verifies and also ensures the users table has the right flags.
"""
import psycopg2
import psycopg2.extras
import uuid
from datetime import datetime, timezone, timedelta

DB = "postgresql://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
PHONE    = "09158200927"
NEW_TIER = "growth"   # growth = Starter plan (20 listings)

conn = psycopg2.connect(DB, cursor_factory=psycopg2.extras.RealDictCursor)
conn.autocommit = False
cur = conn.cursor()

try:
    # Find user
    cur.execute("SELECT id, email, phone, full_name FROM users WHERE phone LIKE %s", (f"%{PHONE}%",))
    user = cur.fetchone()
    if not user:
        print(f"User {PHONE} not found")
        exit(1)

    user_id = str(user['id'])
    print(f"User: {user['email']} | {user['full_name']} | id={user_id}")

    # Check subscription
    cur.execute("SELECT * FROM subscriptions WHERE CAST(user_id AS TEXT) = %s", (user_id,))
    sub = cur.fetchone()
    print(f"Subscription: {dict(sub) if sub else 'NONE'}")

    now = datetime.now(tz=timezone.utc)
    period_end = now + timedelta(days=30)

    if sub:
        # Update existing
        cur.execute(
            "UPDATE subscriptions SET tier=%s, is_active=TRUE, current_period_start=%s, current_period_end=%s WHERE CAST(user_id AS TEXT)=%s",
            (NEW_TIER, now, period_end, user_id)
        )
        print(f"✅ Updated subscription to tier={NEW_TIER}, active=True, expires={period_end.date()}")
    else:
        # Create new
        cur.execute(
            "INSERT INTO subscriptions (id, user_id, tier, is_active, current_period_start, current_period_end) VALUES (%s, %s, %s, TRUE, %s, %s)",
            (str(uuid.uuid4()), user_id, NEW_TIER, now, period_end)
        )
        print(f"✅ Created subscription tier={NEW_TIER}")

    # Check users table columns for any subscription-related field
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name LIKE '%tier%' OR column_name LIKE '%subscription%'")
    user_cols = [r['column_name'] for r in cur.fetchall()]
    print(f"User table subscription columns: {user_cols}")

    conn.commit()

    # Verify
    cur.execute("SELECT tier, is_active, current_period_end FROM subscriptions WHERE CAST(user_id AS TEXT)=%s", (user_id,))
    final = cur.fetchone()
    print(f"\n📋 Final: tier={final['tier']}, active={final['is_active']}, expires={final['current_period_end'].date()}")
    print("\n✅ Done! User (amirmojolaoluwa@gmail.com) must log out and back in to get the updated JWT.")
    print("   After login their listing limit will be 20 (Starter plan).")

except Exception as e:
    conn.rollback()
    print(f"❌ Error: {e}")
    raise
finally:
    cur.close()
    conn.close()
