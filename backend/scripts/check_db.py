import sqlite3, os, sys

db_path = os.path.join(os.path.dirname(__file__), '..', 'dev_gateway.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print('=== users table ===')
cur.execute('SELECT COUNT(*) AS cnt FROM users')
print('Total users:', cur.fetchone()['cnt'])

print('\n=== user_roles schema ===')
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_roles'")
row = cur.fetchone()
print(row['sql'] if row else 'NOT FOUND')

print('\n=== distinct roles ===')
roles = [r[0] for r in cur.execute('SELECT DISTINCT role FROM user_roles').fetchall()]
print(roles)

print('\n=== moderators ===')
for r in cur.execute("SELECT u.email, u.full_name FROM users u JOIN user_roles ur ON ur.user_id=u.id WHERE ur.role='moderator'").fetchall():
    print(' -', r['email'], '|', r['full_name'])

print('\n=== enterprise_admin ===')
for r in cur.execute("SELECT u.email, u.full_name FROM users u JOIN user_roles ur ON ur.user_id=u.id WHERE ur.role='enterprise_admin'").fetchall():
    print(' -', r['email'], '|', r['full_name'])

conn.close()
