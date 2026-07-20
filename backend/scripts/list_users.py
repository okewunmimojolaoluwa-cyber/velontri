#!/usr/bin/env python3
"""List all users in the database."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB   = ROOT / "dev_gateway.db"

def main():
    if not DB.exists():
        print(f"ERROR: DB not found at {DB}")
        return

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    cur  = conn.cursor()

    cur.execute("""
        SELECT u.id, u.email, u.phone, u.full_name, u.country_code, u.is_active, u.created_at,
               GROUP_CONCAT(ur.role) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    """)
    
    users = cur.fetchall()
    
    print("\n  All Users in Database")
    print("  " + "-" * 120)
    print(f"  {'ID':<36} {'Email':<30} {'Phone':<15} {'Name':<20} {'Roles':<20}")
    print("  " + "-" * 120)
    
    for user in users:
        print(f"  {user['id']:<36} {user['email']:<30} {user['phone']:<15} {user['full_name']:<20} {user['roles'] or 'None':<20}")
    
    print(f"\n  Total: {len(users)} users")
    
    conn.close()

if __name__ == "__main__":
    main()
