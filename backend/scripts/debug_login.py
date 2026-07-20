#!/usr/bin/env python3
"""Debug login by directly checking database and simulating token."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "dev_gateway.db"

def main():
    if not DB.exists():
        print(f"ERROR: DB not found at {DB}")
        return

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    email = "owner@velontri.com"
    
    # Get user
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()
    
    if not user:
        print(f"User not found: {email}")
        return

    print(f"User ID: {user['id']}")
    print(f"Email: {user['email']}")
    print(f"Is Active: {user['is_active']}")
    
    # Get roles
    cur.execute("SELECT role FROM user_roles WHERE user_id = ?", (user['id'],))
    roles = [r['role'] for r in cur.fetchall()]
    print(f"Roles from DB: {roles}")
    
    # Check what role would be used
    if 'enterprise_admin' in roles:
        print("Would normalize to: super_admin")
    elif 'moderator' in roles:
        print("Would normalize to: moderator")
    else:
        print("Would normalize to: user")

    conn.close()

if __name__ == "__main__":
    main()
