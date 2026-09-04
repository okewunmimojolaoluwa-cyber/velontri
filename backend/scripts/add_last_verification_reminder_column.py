"""Add last_verification_reminder column to users table."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Get database URL and convert asyncpg URL to psycopg2 format
database_url = os.getenv('DATABASE_URL', '')
if database_url.startswith('postgresql+asyncpg://'):
    database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')

print("Adding last_verification_reminder column...")

try:
    # Connect to the database
    conn = psycopg2.connect(database_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_verification_reminder'
    """)
    
    result = cursor.fetchone()
    
    if result:
        print("✓ Column 'last_verification_reminder' already exists")
    else:
        # Add the column
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN last_verification_reminder TIMESTAMP WITH TIME ZONE
        """)
        print("✓ Added 'last_verification_reminder' column to users table")
    
    cursor.close()
    conn.close()
    print("Done!")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
