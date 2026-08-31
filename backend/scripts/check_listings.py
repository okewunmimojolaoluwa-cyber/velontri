import psycopg2, psycopg2.extras
DB = "postgresql://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DB, cursor_factory=psycopg2.extras.RealDictCursor)
cur = conn.cursor()
cur.execute("SELECT listing_type, status, COUNT(*) as cnt FROM listings GROUP BY listing_type, status ORDER BY cnt DESC LIMIT 20")
print("Listings by type+status:", [dict(r) for r in cur.fetchall()])
cur.execute("SELECT id, title, listing_type, status FROM listings ORDER BY created_at DESC LIMIT 5")
print("Latest 5:", [dict(r) for r in cur.fetchall()])
conn.close()
