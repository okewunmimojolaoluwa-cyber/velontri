"""Add last_verification_reminder column to users table."""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import text as _text
from shared.database import get_supabase_session_factory
from shared.logging import get_logger

logger = get_logger(__name__)


async def add_column():
    """Add last_verification_reminder column if it doesn't exist."""
    session_factory = get_supabase_session_factory()
    
    try:
        async with session_factory() as session:
            # Check if column exists
            check_result = (await session.execute(_text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name = 'last_verification_reminder'
            """))).fetchone()
            
            if check_result:
                logger.info("Column 'last_verification_reminder' already exists")
                return
            
            # Add the column
            await session.execute(_text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS last_verification_reminder TIMESTAMP WITH TIME ZONE
            """))
            
            await session.commit()
            logger.info("✓ Added 'last_verification_reminder' column to users table")
            
    except Exception as e:
        logger.error(f"Error adding column: {e}")
        raise


async def main():
    logger.info("Adding last_verification_reminder column...")
    await add_column()
    logger.info("Done!")


if __name__ == "__main__":
    asyncio.run(main())
