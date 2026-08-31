import psycopg2
import psycopg2.extras

DB = "postgresql://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DB, cursor_factory=psycopg2.extras.RealDictCursor)
cur = conn.cursor()

cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
tables = [r['tablename'] for r in cur.fetchall()]
print("Tables:", tables)

# Check what subscription-related tables exist
for t in tables:
    if 'sub' in t.lower() or 'profile' in t.lower() or 'user' in t.lower():
        print(f"  -> {t}")

conn.close()
