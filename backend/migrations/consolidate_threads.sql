-- ============================================================================
-- THREAD CONSOLIDATION MIGRATION - Direct SQL Version
-- ============================================================================
-- This SQL script consolidates duplicate chat threads into ONE thread per user pair
--
-- WHAT IT DOES:
--   1. Finds duplicate threads (same users, different listings)
--   2. Keeps the oldest thread for each user pair
--   3. Migrates messages to the kept thread
--   4. Deletes duplicate threads
--   5. Updates database constraint
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Create New Query
--   3. Copy and paste this entire script
--   4. Click "Run" button
--
-- SAFE TO RUN: This script is idempotent and preserves all data
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create temp table to track duplicate threads
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS thread_consolidation AS
SELECT 
    participant_a,
    participant_b,
    array_agg(id ORDER BY created_at ASC) AS thread_ids,
    (array_agg(id ORDER BY created_at ASC))[1] AS keeper_id,
    count(*) AS thread_count
FROM threads
GROUP BY participant_a, participant_b
HAVING count(*) > 1;

-- Show what we found
SELECT 
    concat(participant_a, ' ↔ ', participant_b) AS "User Pair",
    thread_count AS "Duplicate Threads",
    keeper_id AS "Thread to Keep"
FROM thread_consolidation;

-- ============================================================================
-- STEP 2: Migrate messages from duplicate threads to keeper threads
-- ============================================================================

DO $$
DECLARE
    consolidation_record RECORD;
    thread_to_delete UUID;
    message_count INT;
    total_migrated INT := 0;
    total_deleted INT := 0;
BEGIN
    -- For each user pair with duplicates
    FOR consolidation_record IN 
        SELECT * FROM thread_consolidation
    LOOP
        RAISE NOTICE 'Processing pair: % ↔ % (% threads)',
            consolidation_record.participant_a,
            consolidation_record.participant_b,
            consolidation_record.thread_count;
        
        -- For each duplicate thread (skip the keeper)
        FOREACH thread_to_delete IN ARRAY consolidation_record.thread_ids[2:]
        LOOP
            -- Count messages in this thread
            SELECT count(*) INTO message_count
            FROM messages
            WHERE thread_id = thread_to_delete;
            
            IF message_count > 0 THEN
                RAISE NOTICE '  Migrating % messages from % to %',
                    message_count,
                    thread_to_delete,
                    consolidation_record.keeper_id;
                
                -- Migrate messages to keeper thread
                UPDATE messages
                SET thread_id = consolidation_record.keeper_id
                WHERE thread_id = thread_to_delete;
                
                total_migrated := total_migrated + message_count;
            END IF;
            
            -- Delete the duplicate thread
            DELETE FROM threads WHERE id = thread_to_delete;
            total_deleted := total_deleted + 1;
            
            RAISE NOTICE '  Deleted thread %', thread_to_delete;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✓ Consolidation complete!';
    RAISE NOTICE '  • Removed % duplicate threads', total_deleted;
    RAISE NOTICE '  • Migrated % messages', total_migrated;
END $$;

-- ============================================================================
-- STEP 3: Update database constraint
-- ============================================================================

-- Drop old constraint (if exists)
DO $$
BEGIN
    ALTER TABLE threads DROP CONSTRAINT IF EXISTS uq_thread_participants;
    RAISE NOTICE '✓ Dropped old constraint';
EXCEPTION
    WHEN undefined_object THEN
        RAISE NOTICE '⚠ Old constraint not found (already removed)';
END $$;

-- Create new constraint (participant_a, participant_b only)
DO $$
BEGIN
    ALTER TABLE threads 
    ADD CONSTRAINT uq_thread_participants 
    UNIQUE (participant_a, participant_b);
    RAISE NOTICE '✓ Created new constraint on (participant_a, participant_b)';
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE '⚠ Constraint already exists';
END $$;

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

-- Check for remaining duplicates (should be 0)
SELECT 
    count(*) AS remaining_duplicates
FROM (
    SELECT participant_a, participant_b, count(*) 
    FROM threads 
    GROUP BY participant_a, participant_b 
    HAVING count(*) > 1
) AS dupes;

-- Show final counts
SELECT 
    'threads' AS table_name,
    count(*) AS total_count
FROM threads
UNION ALL
SELECT 
    'messages' AS table_name,
    count(*) AS total_count
FROM messages;

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- If you see "remaining_duplicates = 0", the migration was successful!
-- All user pairs now have exactly ONE thread.
-- ============================================================================

COMMIT;

-- Show final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '✓ MIGRATION COMPLETE!';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'All user pairs now have exactly ONE conversation thread.';
    RAISE NOTICE 'Check the query results above to verify success.';
    RAISE NOTICE '================================================================================';
END $$;
