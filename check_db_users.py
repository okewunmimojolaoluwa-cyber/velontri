"""Simple sync script to check database users"""
import os
from sqlalchemy import create_engine, text

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres")

# Convert to sync URL
if "+asyncpg" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("+asyncpg", "")
if "+psycopg2" not in DATABASE_URL and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://")

print("=" * 70)
print("🔍 CHECKING DATABASE USERS")
print("=" * 70)

try:
    engine = create_engine(DATABASE_URL, echo=False)
    
    with engine.connect() as conn:
        # Count total users
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        total = result.scalar()
        print(f"\n✅ Total users: {total}")
        
        # Count active users  
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE is_active = true"))
        active = result.scalar()
        print(f"✅ Active users: {active}")
        
        # Show sample names
        print(f"\n📋 Sample user names (first 20):")
        result = conn.execute(text("""
            SELECT full_name, email, is_active 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 20
        """))
        
        users = result.fetchall()
        if users:
            print(f"\n{'Name':<30} {'Email':<35} {'Active'}")
            print("-" * 70)
            for name, email, active_status in users:
                active_icon = "✅" if active_status else "❌"
                print(f"{name:<30} {email:<35} {active_icon}")
        else:
            print("   ❌ No users found in database!")
            
        # Test search
        print(f"\n🔍 Testing search for 'nbi'...")
        result = conn.execute(text("""
            SELECT full_name, is_active 
            FROM users 
            WHERE full_name ILIKE :search
        """), {"search": "%nbi%"})
        
        matches = result.fetchall()
        if matches:
            print(f"   ✅ Found {len(matches)} match(es):")
            for name, active_status in matches:
                print(f"      - {name} (active: {active_status})")
        else:
            print("   ❌ No matches for 'nbi'")
            print("   💡 Try searching for names shown above!")

except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nMake sure psycopg2 is installed: pip install psycopg2-binary")

print("\n" + "=" * 70)
