import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "backend", "dev_gateway.db")
con = sqlite3.connect(db_path)

# Fix garbled phone values - UUID fragments or non-E164 values
# Use empty string instead of NULL (column may have NOT NULL constraint)
cur = con.execute(
    "UPDATE users SET phone = '' "
    "WHERE phone LIKE '+0000%' "
    "OR (phone IS NOT NULL AND phone != '' AND phone NOT LIKE '+%' AND length(phone) > 15)"
)
print(f"Fixed {cur.rowcount} garbled phone rows")
con.commit()

rows = con.execute("SELECT email, phone FROM users").fetchall()
for r in rows:
    print(r)
con.close()
print("Done.")
