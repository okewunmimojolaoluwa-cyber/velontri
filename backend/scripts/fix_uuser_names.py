"""
Fix all 'Uuser' entries in the database by setting them to NULL
so the frontend can properly fallback to email username.
"""
import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_db_connection():
    """Get database connection from environment."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return None
    
    # Convert async URL to sync if needed
    if database_url.startswith('postgresql+asyncpg://'):
        database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    try:
        conn = psycopg2.connect(database_url)
        return conn
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        return None

def fix_uuser_names():
    """Update all users with 'Uuser' or similar invalid names."""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Find users with invalid names
        print("🔍 Searching for users with invalid names...")
        cursor.execute("""
            SELECT id, email, full_name 
            FROM users 
            WHERE 
                full_name ILIKE '%user%' 
                OR full_name = 'User'
            ORDER BY created_at DESC
        """)
        
        users = cursor.fetchall()
        print(f"📊 Found {len(users)} users with invalid names")
        
        if not users:
            print("✅ No users need fixing")
            return True
        
        # Show what will be fixed
        print("\n👥 Users to be fixed:")
        for user in users[:10]:  # Show first 10
            user_id, email, full_name = user
            print(f"  - {email}: full_name='{full_name}'")
        
        if len(users) > 10:
            print(f"  ... and {len(users) - 10} more")
        
        # Ask for confirmation
        response = input(f"\n⚠️  Update {len(users)} users? (yes/no): ").strip().lower()
        if response != 'yes':
            print("❌ Cancelled")
            return False
        
        # Update full_name to NULL where it's invalid
        print("\n🔧 Updating full_name...")
        cursor.execute("""
            UPDATE users 
            SET full_name = NULL 
            WHERE 
                full_name ILIKE '%user%' 
                OR full_name = 'User'
        """)
        full_name_count = cursor.rowcount
        print(f"✅ Updated {full_name_count} full_name entries")
        
        # Commit changes
        conn.commit()
        print(f"\n✅ Successfully fixed {len(users)} users!")
        print("ℹ️  Frontend will now use email usernames as fallback")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 Fix 'Uuser' Names in Database")
    print("=" * 60)
    print()
    
    success = fix_uuser_names()
    
    print()
    print("=" * 60)
    if success:
        print("✅ COMPLETE")
        print()
        print("Next steps:")
        print("1. Clear browser cache and refresh")
        print("2. Users should now see their email username instead of 'Uuser'")
    else:
        print("❌ FAILED - Check errors above")
    print("=" * 60)
