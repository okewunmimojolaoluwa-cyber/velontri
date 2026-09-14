"""
Check follower counts for Nbi Stars user
"""
import os
import psycopg2

# Database URL from environment (convert asyncpg to psycopg2 format)
DATABASE_URL = 'postgresql://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'

def check_follows():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Find Nbi Stars user ID
    print("=== Finding Nbi Stars user ===")
    cur.execute("SELECT id, full_name, email FROM users WHERE full_name ILIKE '%nbi%' LIMIT 5")
    users = cur.fetchall()
    for user in users:
        print(f"ID: {user[0]}, Name: {user[1]}, Email: {user[2]}")
    
    if users:
        nbi_id = str(users[0][0])
        print(f"\n=== Checking follows for Nbi Stars (ID: {nbi_id}) ===")
        
        # Check followers (people following Nbi Stars)
        cur.execute("""
            SELECT follower_id, following_id, created_at 
            FROM user_follows 
            WHERE following_id = %s
        """, (nbi_id,))
        followers = cur.fetchall()
        print(f"\nFollowers (following_id = {nbi_id}):")
        for f in followers:
            print(f"  follower_id: {f[0]}, following_id: {f[1]}, created_at: {f[2]}")
        print(f"Total Followers: {len(followers)}")
        
        # Check following (people Nbi Stars is following)
        cur.execute("""
            SELECT follower_id, following_id, created_at 
            FROM user_follows 
            WHERE follower_id = %s
        """, (nbi_id,))
        following = cur.fetchall()
        print(f"\nFollowing (follower_id = {nbi_id}):")
        for f in following:
            print(f"  follower_id: {f[0]}, following_id: {f[1]}, created_at: {f[2]}")
        print(f"Total Following: {len(following)}")
        
        # Test the exact query from the endpoint (FIXED)
        print(f"\n=== Testing fixed endpoint query ===")
        cur.execute("SELECT COUNT(*) FROM user_follows WHERE following_id = %s::uuid", (nbi_id,))
        count = cur.fetchone()
        print(f"Followers count (UUID comparison): {count[0] if count else 0}")
        
        # Check data types in user_follows table
        print(f"\n=== Checking column types ===")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_follows'
        """)
        columns = cur.fetchall()
        for col in columns:
            print(f"  {col[0]}: {col[1]}")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    check_follows()
