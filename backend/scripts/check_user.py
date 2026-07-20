#!/usr/bin/env python3
"""Check if user can login."""
import sqlite3
import bcrypt
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

    email = "owner@velontri.com"
    password = "Owner123!"

    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()

    if not user:
        print(f"User not found: {email}")
        return

    print(f"User found:")
    print(f"  ID: {user['id']}")
    print(f"  Email: {user['email']}")
    print(f"  Phone: {user['phone']}")
    print(f"  Name: {user['full_name']}")
    print(f"  Is Active: {user['is_active']}")
    print(f"  Is Locked: {user['is_locked']}")
    print(f"  Failed Attempts: {user['failed_attempts']}")
    print(f"  Phone Verified: {user['phone_verified']}")
    
    # Check password
    stored_hash = user['password_hash']
    print(f"\nPassword check:")
    print(f"  Stored hash: {stored_hash[:50]}...")
    
    try:
        matches = bcrypt.checkpw(password.encode(), stored_hash.encode())
        print(f"  Password matches: {matches}")
    except Exception as e:
        print(f"  Password check error: {e}")

    # Check roles
    cur.execute("SELECT role FROM user_roles WHERE user_id = ?", (user['id'],))
    roles = [r['role'] for r in cur.fetchall()]
    print(f"\nRoles: {roles}")

    conn.close()

if __name__ == "__main__":
    main()
