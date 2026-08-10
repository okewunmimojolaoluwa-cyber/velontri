import asyncio, asyncpg

async def check():
    dsn = "postgresql://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
    conn = await asyncpg.connect(dsn, ssl="require", statement_cache_size=0)

    tables = await conn.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' "
        "AND tablename IN ('listings', 'listing_media', 'users') ORDER BY tablename"
    )
    print("Tables found:", [r["tablename"] for r in tables])

    try:
        cols = await conn.fetch(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name='listing_media' ORDER BY ordinal_position"
        )
        print("listing_media columns:", [(r["column_name"], r["data_type"]) for r in cols])
    except Exception as e:
        print("listing_media error:", e)

    try:
        col = await conn.fetch(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='listings' AND column_name='image_url'"
        )
        print("listings.image_url exists:", len(col) > 0)
    except Exception as e:
        print("listings.image_url error:", e)

    try:
        count = await conn.fetchval("SELECT COUNT(*) FROM listing_media")
        print("listing_media rows:", count)
    except Exception as e:
        print("listing_media count error:", e)

    await conn.close()

asyncio.run(check())
