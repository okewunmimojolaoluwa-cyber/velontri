-- ============================================================================
-- Velontri Followers/Following System - Database Migration
-- ============================================================================
-- This script creates the user_follows table and all supporting infrastructure
-- Run this on your PostgreSQL database (production or development)
-- ============================================================================

-- Create the main user_follows table
CREATE TABLE IF NOT EXISTS user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_follows_pair UNIQUE (follower_id, following_id),
    CONSTRAINT ck_user_follows_no_self CHECK (follower_id != following_id)
);

COMMENT ON TABLE user_follows IS 'Tracks follower/following relationships between users';
COMMENT ON COLUMN user_follows.follower_id IS 'User who is following';
COMMENT ON COLUMN user_follows.following_id IS 'User being followed';
COMMENT ON CONSTRAINT uq_user_follows_pair ON user_follows IS 'Prevents duplicate follow relationships';
COMMENT ON CONSTRAINT ck_user_follows_no_self ON user_follows IS 'Prevents users from following themselves';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS ix_user_follows_follower 
ON user_follows(follower_id);

CREATE INDEX IF NOT EXISTS ix_user_follows_following 
ON user_follows(following_id);

CREATE INDEX IF NOT EXISTS ix_user_follows_created_at 
ON user_follows(created_at DESC);

-- Add count columns to users table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='followers_count'
    ) THEN
        ALTER TABLE users ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='following_count'
    ) THEN
        ALTER TABLE users ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Create function to automatically update follower/following counts
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

COMMENT ON FUNCTION update_follow_counts() IS 'Automatically updates follower/following counts when relationships change';

-- Create trigger to invoke the function
DROP TRIGGER IF EXISTS trg_update_follow_counts ON user_follows;
CREATE TRIGGER trg_update_follow_counts
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

COMMENT ON TRIGGER trg_update_follow_counts ON user_follows IS 'Keeps follower/following counts in sync automatically';

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- What was created:
--   ✓ user_follows table with proper constraints
--   ✓ 3 indexes for efficient queries
--   ✓ followers_count and following_count columns on users table
--   ✓ Trigger function for automatic count updates
--   ✓ Trigger that fires on insert/delete
--
-- Test with:
--   SELECT * FROM user_follows LIMIT 10;
--   SELECT id, email, followers_count, following_count FROM users LIMIT 10;
-- ============================================================================
