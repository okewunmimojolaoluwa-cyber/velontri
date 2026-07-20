"""
One-time migration: recreate user_roles table without the restrictive CHECK constraint
so 'moderator', 'super_admin' etc. can be inserted.
Safe to run multiple times.
"""
import sqlite3, os

db_path = os.path.join(os.path.dirname(__file__), '..', 'dev_gateway.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check current schema
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_roles'")
row = cur.fetchone()
if not row:
    print("user_roles table not found — nothing to do.")
    conn.close()
    exit(0)

schema = row[0]
print("Current schema snippet:", schema[:120])

if "'moderator'" in schema:
    print("Schema already allows 'moderator' — no migration needed.")
    conn.close()
    exit(0)

print("Migrating user_roles table...")

cur.executescript("""
    PRAGMA foreign_keys=OFF;

    CREATE TABLE IF NOT EXISTS user_roles_new (
        id         TEXT NOT NULL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        role       TEXT NOT NULL,
        scope_id   TEXT,
        granted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO user_roles_new (id, user_id, role, scope_id, granted_at)
    SELECT
        id,
        user_id,
        role,
        scope_id,
        COALESCE(granted_at, datetime('now'))
    FROM user_roles;

    DROP TABLE user_roles;

    ALTER TABLE user_roles_new RENAME TO user_roles;

    CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles(user_id);

    PRAGMA foreign_keys=ON;
""")

conn.commit()
print("Migration complete!")

# Verify
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_roles'")
print("New schema:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM user_roles")
print("Roles preserved:", cur.fetchone()[0])

conn.close()
