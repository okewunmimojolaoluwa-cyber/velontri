"""Check which tables exist in the database."""
import asyncio
import sys
import os

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from shared.database import get_supabase_session_factory
from sqlalchemy import text


async def check_tables():
    """Check if required tables exist."""
    session_factory = get_supabase_session_factory()
    
    async with session_factory() as session:
        # Check for messaging and social tables
        result = await session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('threads', 'messages', 'queued_messages', 'user_follows')
            ORDER BY table_name
        """))
        
        tables = [row[0] for row in result.fetchall()]
        
        print("=" * 60)
        print("DATABASE TABLE CHECK")
        print("=" * 60)
        
        required_tables = {
            'user_follows': 'Followers/Following system',
            'threads': 'Messaging system',
            'messages': 'Messaging system',
            'queued_messages': 'Messaging system'
        }
        
        for table_name, purpose in required_tables.items():
            exists = table_name in tables
            status = "✅ EXISTS" if exists else "❌ MISSING"
            print(f"{status:15} {table_name:20} ({purpose})")
        
        print("=" * 60)
        
        # Count existing tables
        existing_count = sum(1 for t in required_tables if t in tables)
        total_count = len(required_tables)
        
        print(f"\nSummary: {existing_count}/{total_count} tables exist")
        
        if existing_count < total_count:
            print("\n⚠️  MIGRATION REQUIRED ⚠️")
            print("Missing tables must be created before features will work.")
        else:
            print("\n✅ All required tables exist!")


if __name__ == "__main__":
    asyncio.run(check_tables())
