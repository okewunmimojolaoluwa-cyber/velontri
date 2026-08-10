import asyncio, asyncpg

async def verify():
    dsn = "postgresql://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
    conn = await asyncpg.connect(dsn, ssl="require", statement_cache_size=0)
    rows = await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    tables = [r["tablename"] for r in rows]
    print(f"Total tables in Supabase: {len(tables)}")
    for t in tables:
        print(f"  OK: {t}")
    await conn.close()

asyncio.run(verify())
