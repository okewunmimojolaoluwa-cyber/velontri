"""Check if last_verification_reminder column exists."""
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')

database_url = os.getenv('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_verification_reminder'
    """)
    
    result = cursor.fetchone()
    
    if result:
        print(f"✓ Column exists: {result[0]} ({result[1]})")
    else:
        print("✗ Column not found")
    
    cursor.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")
