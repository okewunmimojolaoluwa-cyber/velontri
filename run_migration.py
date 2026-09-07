"""
Simple migration runner for user_follows table.
Run this from the project root: python run_migration.py
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import text
from shared.database import create_engine
from shared.config import BaseServiceSettings


async def create_user_follows_table():
    """Create the user_follows table and associated indexes."""
    print("Starting migration...")
    print(f"Working directory: {os.getcwd()}")
    
    settings = BaseServiceSettings()
    print(f"Database URL: {settings.DATABASE_URL[:30]}...")
    
    engine = create_engine(settings.DATABASE_URL)
    
    print("\nCreating user_follows table...")
    
    try:
        async with engine.begin() as conn:
            # Create the main table
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_follows (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_user_follows_pair UNIQUE (follower_id, following_id),
                    CONSTRAINT ck_user_follows_no_self CHECK (follower_id != following_id)
                );
            """))
            print("✓ Table created")
            
            # Create indexes for efficient queries
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_user_follows_follower 
                ON user_follows(follower_id);
            """))
            print("✓ Index on follower_id created")
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_user_follows_following 
                ON user_follows(following_id);
            """))
            print("✓ Index on following_id created")
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_user_follows_created_at 
                ON user_follows(created_at DESC);
            """))
            print("✓ Index on created_at created")
            
            # Add helper columns to users table if they don't exist
            await conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='users' AND column_name='followers_count'
                    ) THEN
                        ALTER TABLE users ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 0;
                    END IF;
                END $$;
            """))
            
            await conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='users' AND column_name='following_count'
                    ) THEN
                        ALTER TABLE users ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;
                    END IF;
                END $$;
            """))
            print("✓ User count columns added")
            
            # Create function to update counts automatically
            await conn.execute(text("""
                CREATE OR REPLACE FUNCTION update_follow_counts()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF (TG_OP = 'INSERT') THEN
                        -- Increment followers_count for the user being followed
                        UPDATE users SET followers_count = followers_count + 1 
                        WHERE id = NEW.following_id;
                        
                        -- Increment following_count for the user who followed
                        UPDATE users SET following_count = following_count + 1 
                        WHERE id = NEW.follower_id;
                        
                        RETURN NEW;
                    ELSIF (TG_OP = 'DELETE') THEN
                        -- Decrement followers_count for the user being unfollowed
                        UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) 
                        WHERE id = OLD.following_id;
                        
                        -- Decrement following_count for the user who unfollowed
                        UPDATE users SET following_count = GREATEST(following_count - 1, 0) 
                        WHERE id = OLD.follower_id;
                        
                        RETURN OLD;
                    END IF;
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✓ Count update function created")
            
            # Create trigger
            await conn.execute(text("""
                DROP TRIGGER IF EXISTS trg_update_follow_counts ON user_follows;
                CREATE TRIGGER trg_update_follow_counts
                AFTER INSERT OR DELETE ON user_follows
                FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
            """))
            print("✓ Trigger created")
            
        await engine.dispose()
        
        print("\n" + "="*60)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("="*60)
        print("\nTable structure:")
        print("  - id: UUID (PK)")
        print("  - follower_id: UUID (FK → users.id)")
        print("  - following_id: UUID (FK → users.id)")
        print("  - created_at: TIMESTAMPTZ")
        print("\nConstraints:")
        print("  - UNIQUE(follower_id, following_id) - prevents duplicate follows")
        print("  - CHECK(follower_id != following_id) - prevents self-follows")
        print("  - ON DELETE CASCADE - cleans up on user deletion")
        print("\nIndexes:")
        print("  - ix_user_follows_follower - fast follower queries")
        print("  - ix_user_follows_following - fast following queries")
        print("  - ix_user_follows_created_at - chronological ordering")
        print("\nTrigger:")
        print("  - Auto-updates followers_count and following_count on users table")
        print("\n✅ You can now test the followers/following feature!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(create_user_follows_table())
