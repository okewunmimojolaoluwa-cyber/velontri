"""Quick check: does saved_listings table exist and are the routes registered?"""
import asyncio
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from native_stubs import apply_patches
apply_patches("gateway")

async def main():
    import aiosqlite

    db_path = ROOT / "dev_gateway.db"
    if not db_path.exists():
        print("dev_gateway.db not found — has the backend started at least once?")
        return

    async with aiosqlite.connect(str(db_path)) as db:
        # Check if table exists
        rows = await db.execute_fetchall(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='saved_listings'"
        )
        if rows:
            count = await db.execute_fetchall("SELECT COUNT(*) as cnt FROM saved_listings")
            print(f"✅ saved_listings table EXISTS — {count[0][0]} rows")
        else:
            print("❌ saved_listings table MISSING — restart the backend to create it")
            print("   Creating it now...")
            await db.execute("""
                CREATE TABLE IF NOT EXISTS saved_listings (
                    id          TEXT PRIMARY KEY,
                    user_id     TEXT NOT NULL,
                    listing_id  TEXT NOT NULL,
                    saved_at    TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(user_id, listing_id)
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS ix_saved_listings_user_id ON saved_listings(user_id)"
            )
            await db.commit()
            print("   ✅ Table created — restart the backend to register the routes")

asyncio.run(main())
