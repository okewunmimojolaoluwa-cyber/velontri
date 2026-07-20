#!/usr/bin/env python3
"""Velontri owner account seeder — creates the business owner super admin account."""
import sqlite3, uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    import bcrypt
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "bcrypt", "-q"])
    import bcrypt

ROOT = Path(__file__).resolve().parents[1]
DB   = ROOT / "dev_gateway.db"

OWNER = (
    "owner@velontri.com",
    "+2348000000000",
    "Owner123!",
    "Velontri Owner",
    "NG",
    "enterprise_admin",
)

def main():
    print("\n  Velontri — Owner Account Seeder")
    print("  " + "-" * 46)

    if not DB.exists():
        print(f"  ERROR: DB not found at {DB}")
        print("  Start the backend first: npm run dev:backend")
        return

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    cur  = conn.cursor()

    # Delete ALL existing users and their data
    cur.execute("SELECT id FROM users")
    all_users = cur.fetchall()
    
    for user in all_users:
        uid = user["id"]
        cur.execute("DELETE FROM user_roles WHERE user_id = ?", (uid,))
        cur.execute("DELETE FROM wallets WHERE user_id = ?", (uid,))
        cur.execute("DELETE FROM users WHERE id = ?", (uid,))
    
    print(f"  DEL   {len(all_users)} existing users")

    # Discover actual column names
    cur.execute("PRAGMA table_info(users)")
    ucols = {r["name"] for r in cur.fetchall()}

    cur.execute("PRAGMA table_info(user_roles)")
    rcols = {r["name"] for r in cur.fetchall()}

    phone_col = "phone_verified" if "phone_verified" in ucols else None

    email, phone, pwd, name, country, role = OWNER
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    uid      = str(uuid.uuid4())
    pw_hash  = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt(12)).decode()

    cols = ["id", "email", "phone", "password_hash", "full_name",
            "country_code", "is_active", "failed_attempts", "created_at"]
    vals = [uid, email, phone, pw_hash, name, country, 1, 0, now]

    if phone_col:
        cols.append(phone_col)
        vals.append(1)

    if "is_locked" in ucols:
        cols.append("is_locked")
        vals.append(0)

    ph = ", ".join("?" * len(cols))
    cs = ", ".join(cols)

    cur.execute(f"INSERT INTO users ({cs}) VALUES ({ph})", vals)

    # Role row
    if "granted_at" in rcols:
        cur.execute(
            "INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (?,?,?,?)",
            (str(uuid.uuid4()), uid, role, now))
    elif "created_at" in rcols:
        cur.execute(
            "INSERT INTO user_roles (user_id, role, created_at) VALUES (?,?,?)",
            (uid, role, now))
    else:
        cur.execute("INSERT INTO user_roles (user_id, role) VALUES (?,?)", (uid, role))

    # Wallet
    cur.execute(
        "INSERT INTO wallets (user_id,currency,balance,held_balance,rewards_points,updated_at) "
        "VALUES (?,'NGN',0,0,0,?)",
        (uid, now))

    conn.commit()
    conn.close()
    
    print(f"  OK    Owner account created")
    print(f"""
  +-------------+---------------------------+--------------+---------------------------+
  | Role        | Email                     | Password     | Redirects to              |
  +-------------+---------------------------+--------------+---------------------------+
  | Super Admin | owner@velontri.com        | Owner123!    | /admin                    |
  +-------------+---------------------------+--------------+---------------------------+
  Login at:  http://localhost:3000/login
    """)

if __name__ == "__main__":
    main()
