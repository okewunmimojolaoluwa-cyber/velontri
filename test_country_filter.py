"""
Test script to verify country filtering works correctly in the listings API.
This will help diagnose if the issue is with database data format or query logic.
"""

import asyncio
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load .env from backend directory
env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not found in backend/.env")
    print("Please ensure backend/.env has DATABASE_URL set.")
    exit(1)

async def test_country_filtering():
    """Test country filtering to identify the issue."""
    
    # Create sync engine for testing
    engine = create_engine(DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'))
    
    with engine.connect() as conn:
        print("=" * 80)
        print("COUNTRY FILTER DIAGNOSTIC TEST")
        print("=" * 80)
        
        # 1. Check what country values exist in the database
        print("\n1. Checking country values in listings table:")
        print("-" * 80)
        result = conn.execute(text("""
            SELECT DISTINCT country, COUNT(*) as count
            FROM listings
            WHERE status = 'active'
            GROUP BY country
            ORDER BY count DESC
            LIMIT 20
        """))
        
        countries = result.fetchall()
        if not countries:
            print("❌ No active listings found in database!")
        else:
            print(f"✓ Found {len(countries)} distinct country values:")
            for country, count in countries:
                print(f"  - '{country}': {count} listings")
        
        # 2. Test filtering with 2-letter code (what frontend sends)
        print("\n2. Testing filter with 2-letter code 'NG':")
        print("-" * 80)
        result = conn.execute(text("""
            SELECT id, title, country, city
            FROM listings
            WHERE status = 'active' AND country ILIKE :country
            LIMIT 5
        """), {"country": "%NG%"})
        
        ng_listings = result.fetchall()
        if ng_listings:
            print(f"✓ Found {len(ng_listings)} listings with 'NG' pattern:")
            for listing in ng_listings:
                print(f"  - {listing[1][:50]} | Country: '{listing[2]}' | City: {listing[3]}")
        else:
            print("❌ No listings found with 'NG' pattern")
        
        # 3. Test filtering with full country name
        print("\n3. Testing filter with full name 'Nigeria':")
        print("-" * 80)
        result = conn.execute(text("""
            SELECT id, title, country, city
            FROM listings
            WHERE status = 'active' AND country ILIKE :country
            LIMIT 5
        """), {"country": "%Nigeria%"})
        
        nigeria_listings = result.fetchall()
        if nigeria_listings:
            print(f"✓ Found {len(nigeria_listings)} listings with 'Nigeria' pattern:")
            for listing in nigeria_listings:
                print(f"  - {listing[1][:50]} | Country: '{listing[2]}' | City: {listing[3]}")
        else:
            print("❌ No listings found with 'Nigeria' pattern")
        
        # 4. Check schema validation
        print("\n4. Checking country field constraints:")
        print("-" * 80)
        result = conn.execute(text("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'listings' AND column_name = 'country'
        """))
        
        col_info = result.fetchone()
        if col_info:
            print(f"✓ Column info: {col_info[0]} | Type: {col_info[1]} | Max Length: {col_info[2]}")
        
        # 5. Sample some listings to see format
        print("\n5. Sample of actual country values:")
        print("-" * 80)
        result = conn.execute(text("""
            SELECT country, COUNT(*) as count
            FROM listings
            WHERE status = 'active' AND country IS NOT NULL
            GROUP BY country
            ORDER BY count DESC
            LIMIT 10
        """))
        
        samples = result.fetchall()
        for country, count in samples:
            length = len(country) if country else 0
            print(f"  - '{country}' ({length} chars): {count} listings")
        
        print("\n" + "=" * 80)
        print("DIAGNOSIS COMPLETE")
        print("=" * 80)
        
        # Provide recommendation
        print("\n📋 RECOMMENDATION:")
        if not countries:
            print("  ⚠️  No active listings in database - create test data first")
        elif any(len(c[0] or '') == 2 for c in countries if c[0]):
            print("  ✓ Database uses 2-letter country codes (correct format)")
            print("  ✓ Frontend sends 2-letter codes (e.g., 'NG', 'GH')")
            print("  ✓ Backend query uses ILIKE with wildcards (%NG%)")
            print("  → Country filtering should work correctly!")
        elif any(len(c[0] or '') > 2 for c in countries if c[0]):
            print("  ⚠️  Database stores full country names (e.g., 'Nigeria')")
            print("  ⚠️  Frontend sends 2-letter codes (e.g., 'NG')")
            print("  ❌ Mismatch causing filter to fail!")
            print("\n  FIX OPTIONS:")
            print("  1. Update frontend to send full country names")
            print("  2. Update backend to map codes to names")
            print("  3. Migrate database to use 2-letter codes (RECOMMENDED)")

if __name__ == '__main__':
    asyncio.run(test_country_filtering())
