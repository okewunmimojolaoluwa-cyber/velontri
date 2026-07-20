#!/usr/bin/env python3
"""Inspect database schema."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB   = ROOT / "dev_gateway.db"

def main():
    if not DB.exists():
        print(f"ERROR: DB not found at {DB}")
        return

    conn = sqlite3.connect(str(DB))
    cur  = conn.cursor()

    print("\n  Users Table Schema:")
    cur.execute("PRAGMA table_info(users)")
    for row in cur.fetchall():
        print(f"    {row}")

    print("\n  User Roles Table Schema:")
    cur.execute("PRAGMA table_info(user_roles)")
    for row in cur.fetchall():
        print(f"    {row}")

    print("\n  Wallets Table Schema:")
    cur.execute("PRAGMA table_info(wallets)")
    for row in cur.fetchall():
        print(f"    {row}")

    conn.close()

if __name__ == "__main__":
    main()
