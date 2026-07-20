import sqlite3, os
db = os.path.join(os.path.dirname(__file__), '..', 'dev_gateway.db')
conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print('=== All users ===')
for r in cur.execute('SELECT email, full_name FROM users').fetchall():
    print(f'  {r["email"]} | {r["full_name"]}')

cur.execute("""
    SELECT COUNT(*) AS cnt FROM users
    WHERE id NOT IN (
        SELECT user_id FROM user_roles
        WHERE role IN ('enterprise_admin','super_admin')
    )
""")
print('\nRegistered users (excl admin):', cur.fetchone()['cnt'])

print('\n=== user_roles ===')
for r in cur.execute('SELECT user_id, role FROM user_roles').fetchall():
    print(f'  {r["user_id"][:8]}... | {r["role"]}')

conn.close()
