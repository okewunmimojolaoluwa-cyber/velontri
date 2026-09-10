"""
Test script to check seller search functionality
"""
import asyncio
import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    print("\nPlease set it:")
    print('$env:DATABASE_URL="postgresql+asyncpg://user:pass@host/db"')
    exit(1)

# Convert to async URL if needed
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

async def test_search():
    print("=" * 60)
    print("🔍 TESTING SELLER SEARCH")
    print("=" * 60)
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # 1. Check total users
        print("\n1️⃣  Checking total users...")
        result = await session.execute(text("SELECT COUNT(*) FROM users"))
        total_users = result.scalar()
        print(f"   Total users in database: {total_users}")
        
        # 2. Check active users
        print("\n2️⃣  Checking active users...")
        result = await session.execute(text("SELECT COUNT(*) FROM users WHERE is_active = true"))
        active_users = result.scalar()
        print(f"   Active users: {active_users}")
        
        # 3. Show sample users
        print("\n3️⃣  Sample users (first 10 active):")
        result = await session.execute(text("""
            SELECT id, full_name, email, is_active, followers_count, created_at
            FROM users 
            WHERE is_active = true
            ORDER BY created_at DESC
            LIMIT 10
        """))
        users = result.fetchall()
        
        if users:
            print(f"\n   {'Full Name':<25} {'Email':<30} {'Followers':<10} {'Active'}")
            print("   " + "-" * 80)
            for user in users:
                print(f"   {user[1]:<25} {user[2]:<30} {user[4] or 0:<10} {user[3]}")
        else:
            print("   ❌ No active users found!")
        
        # 4. Test search for "nbi"
        print("\n4️⃣  Testing search for 'nbi'...")
        result = await session.execute(text("""
            SELECT id, full_name, email, is_active
            FROM users 
            WHERE full_name ILIKE :search AND is_active = true
            LIMIT 5
        """), {"search": "%nbi%"})
        matches = result.fetchall()
        
        if matches:
            print(f"   ✅ Found {len(matches)} match(es):")
            for match in matches:
                print(f"      - {match[1]} ({match[2]})")
        else:
            print("   ❌ No users found matching 'nbi'")
        
        # 5. Test search for common names
        print("\n5️⃣  Testing search for common names...")
        for name in ["john", "mary", "test", "admin", "user"]:
            result = await session.execute(text("""
                SELECT COUNT(*) FROM users 
                WHERE full_name ILIKE :search AND is_active = true
            """), {"search": f"%{name}%"})
            count = result.scalar()
            if count > 0:
                print(f"   ✅ '{name}': {count} match(es)")
        
        # 6. Check if search endpoint path is correct
        print("\n6️⃣  Search endpoint info:")
        print("   Backend URL: /users/search")
        print("   Frontend calls: /users/search?q=nbi&page=1&page_size=20")
        print("   Gateway should route to user-service")
        
        print("\n" + "=" * 60)
        print("✅ TEST COMPLETE")
        print("=" * 60)
        
        if active_users == 0:
            print("\n⚠️  NO ACTIVE USERS FOUND!")
            print("   The database has no users with is_active=true")
            print("   You need to:")
            print("   1. Register new users via the app")
            print("   2. Or update existing users: UPDATE users SET is_active=true")
        elif total_users > 0 and active_users > 0:
            print("\n✅ Database has active users!")
            print(f"   Try searching for parts of these names in the app")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_search())
