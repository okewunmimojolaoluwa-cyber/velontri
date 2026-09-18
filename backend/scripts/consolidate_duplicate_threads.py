"""
Consolidate duplicate chat threads into ONE thread per user pair.

This script:
1. Finds duplicate threads for the same user pairs (with different listing_ids)
2. Keeps the oldest thread for each user pair
3. Migrates all messages to the kept thread
4. Deletes duplicate threads
5. Drops and recreates the unique constraint to only use (participant_a, participant_b)
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/velontri")


async def consolidate_threads():
    """Consolidate duplicate threads."""
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        print("\n" + "="*80)
        print("STEP 1: Find duplicate threads (same user pairs, different listing_ids)")
        print("="*80)
        
        # Find all duplicate thread groups
        result = await session.execute(text("""
            SELECT 
                participant_a,
                participant_b,
                COUNT(*) as thread_count,
                MIN(created_at) as oldest_created_at
            FROM threads
            GROUP BY participant_a, participant_b
            HAVING COUNT(*) > 1
            ORDER BY thread_count DESC
        """))
        
        duplicates = result.fetchall()
        print(f"\nFound {len(duplicates)} user pairs with duplicate threads")
        
        if len(duplicates) == 0:
            print("\n✓ No duplicate threads found. Database is clean.")
        else:
            total_duplicates_removed = 0
            total_messages_migrated = 0
            
            for dup in duplicates:
                pa, pb, count, oldest = dup
                print(f"\n→ User pair {pa} <-> {pb}: {count} threads")
                
                # Get all threads for this pair
                threads_result = await session.execute(text("""
                    SELECT id, listing_id, created_at
                    FROM threads
                    WHERE participant_a = :pa AND participant_b = :pb
                    ORDER BY created_at ASC
                """), {"pa": str(pa), "pb": str(pb)})
                
                threads = threads_result.fetchall()
                keeper_id = threads[0][0]  # Keep the oldest thread
                to_delete = [t[0] for t in threads[1:]]
                
                print(f"  ├─ Keeping thread: {keeper_id} (created {threads[0][2]})")
                print(f"  └─ Removing {len(to_delete)} duplicate threads")
                
                # Migrate messages from duplicate threads to keeper
                for thread_id in to_delete:
                    # Count messages in this thread
                    count_result = await session.execute(text("""
                        SELECT COUNT(*) FROM messages WHERE thread_id = :tid
                    """), {"tid": str(thread_id)})
                    msg_count = count_result.scalar()
                    
                    if msg_count > 0:
                        print(f"    → Migrating {msg_count} messages from {thread_id} to {keeper_id}")
                        # Update messages to point to keeper thread
                        await session.execute(text("""
                            UPDATE messages 
                            SET thread_id = :keeper 
                            WHERE thread_id = :old
                        """), {"keeper": str(keeper_id), "old": str(thread_id)})
                        total_messages_migrated += msg_count
                    
                    # Delete the duplicate thread
                    await session.execute(text("""
                        DELETE FROM threads WHERE id = :tid
                    """), {"tid": str(thread_id)})
                    total_duplicates_removed += 1
            
            await session.commit()
            
            print("\n" + "="*80)
            print(f"✓ Consolidation complete!")
            print(f"  • Removed {total_duplicates_removed} duplicate threads")
            print(f"  • Migrated {total_messages_migrated} messages")
            print("="*80)
        
        print("\n" + "="*80)
        print("STEP 2: Update database constraint")
        print("="*80)
        
        # Drop old constraint
        print("\n→ Dropping old constraint 'uq_thread_participants'...")
        try:
            await session.execute(text("""
                ALTER TABLE threads 
                DROP CONSTRAINT IF EXISTS uq_thread_participants
            """))
            print("  ✓ Old constraint dropped")
        except Exception as e:
            print(f"  ⚠ Could not drop constraint (might not exist): {e}")
        
        # Create new constraint (without listing_id)
        print("\n→ Creating new constraint 'uq_thread_participants' on (participant_a, participant_b)...")
        try:
            await session.execute(text("""
                ALTER TABLE threads 
                ADD CONSTRAINT uq_thread_participants 
                UNIQUE (participant_a, participant_b)
            """))
            await session.commit()
            print("  ✓ New constraint created successfully!")
        except Exception as e:
            await session.rollback()
            print(f"  ✗ Failed to create constraint: {e}")
            print("  Note: You may need to manually update the constraint in your database")
        
        print("\n" + "="*80)
        print("FINAL VERIFICATION")
        print("="*80)
        
        # Verify no duplicates remain
        result = await session.execute(text("""
            SELECT 
                participant_a,
                participant_b,
                COUNT(*) as thread_count
            FROM threads
            GROUP BY participant_a, participant_b
            HAVING COUNT(*) > 1
        """))
        
        remaining_dups = result.fetchall()
        if len(remaining_dups) == 0:
            print("\n✓ SUCCESS! All user pairs now have exactly ONE thread")
        else:
            print(f"\n⚠ WARNING: {len(remaining_dups)} user pairs still have duplicates")
            print("You may need to run this script again or investigate manually")
        
        # Show total thread and message counts
        thread_count = await session.execute(text("SELECT COUNT(*) FROM threads"))
        message_count = await session.execute(text("SELECT COUNT(*) FROM messages"))
        
        print(f"\nFinal counts:")
        print(f"  • Total threads: {thread_count.scalar()}")
        print(f"  • Total messages: {message_count.scalar()}")
        print("="*80 + "\n")

    await engine.dispose()


if __name__ == "__main__":
    print("\n" + "="*80)
    print("THREAD CONSOLIDATION MIGRATION")
    print("="*80)
    print("\nThis script will:")
    print("  1. Find all duplicate threads (same users, different listings)")
    print("  2. Keep the oldest thread for each user pair")
    print("  3. Migrate all messages to the kept thread")
    print("  4. Delete duplicate threads")
    print("  5. Update database constraint to prevent future duplicates")
    print("\nPress Ctrl+C now to cancel, or Enter to continue...")
    
    try:
        input()
    except KeyboardInterrupt:
        print("\n\nCancelled by user.")
        sys.exit(0)
    
    asyncio.run(consolidate_threads())
    print("\n✓ Migration complete!\n")
