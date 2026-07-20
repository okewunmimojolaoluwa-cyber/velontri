"""Test that moderator insertion works with the current DB schema."""
import asyncio, uuid, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

async def main():
    import aiosqlite
    db_path = os.path.join(os.path.dirname(__file__), '..', 'dev_gateway.db')
    test_id = str(uuid.uuid4())
    role_id = str(uuid.uuid4())

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        try:
            # Test inserting a user with all required NOT NULL fields
            await db.execute("""
                INSERT INTO users (id, email, phone, phone_verified, password_hash, full_name,
                                   country_code, is_active, is_locked, failed_attempts, created_at)
                VALUES (?, ?, ?, 1, ?, ?, ?, 1, 0, 0, datetime('now'))
            """, [test_id, 'testmod123@velontri.com', '+2341234567890',
                  '$2b$12$fakehash', 'Test Moderator', 'NG'])

            # Test inserting moderator role
            await db.execute("""
                INSERT INTO user_roles (id, user_id, role, granted_at)
                VALUES (?, ?, 'moderator', datetime('now'))
            """, [role_id, test_id])

            await db.commit()
            print("✅ INSERT succeeded!")

            # Verify
            rows = await db.execute_fetchall(
                "SELECT u.email, r.role FROM users u JOIN user_roles r ON r.user_id=u.id WHERE u.id=?",
                [test_id]
            )
            for r in rows:
                print(f"   Verified: {r['email']} | role={r['role']}")

        except Exception as e:
            print(f"❌ FAILED: {e}")
        finally:
            # Clean up
            await db.execute("DELETE FROM user_roles WHERE user_id=?", [test_id])
            await db.execute("DELETE FROM users WHERE id=?", [test_id])
            await db.commit()
            print("   Test rows cleaned up.")

asyncio.run(main())
