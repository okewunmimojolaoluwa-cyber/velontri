"""
Diagnostic: check listing_media rows for a listing.
Usage: python scripts/check_listing_media.py [listing_id]
If no listing_id given, shows all listings with media counts.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
)


async def main():
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text

    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.connect() as conn:
        if len(sys.argv) > 1:
            lid = sys.argv[1]
            # Check a specific listing
            rows = (await conn.execute(text("""
                SELECT id, sort_order, media_type, LENGTH(s3_key) AS key_len,
                       LEFT(s3_key, 60) AS key_preview
                FROM listing_media
                WHERE CAST(listing_id AS TEXT) = :lid
                ORDER BY sort_order ASC
            """), {"lid": lid})).mappings().all()

            listing = (await conn.execute(text("""
                SELECT title, image_url IS NOT NULL AS has_image_url,
                       LENGTH(image_url) AS img_url_len
                FROM listings WHERE CAST(id AS TEXT) = :lid
            """), {"lid": lid})).mappings().first()

            if listing:
                print(f"\nListing: {listing['title']}")
                print(f"  image_url set: {listing['has_image_url']} (len: {listing['img_url_len']})")
            print(f"\nlisting_media rows: {len(rows)}")
            for r in rows:
                print(f"  sort_order={r['sort_order']} type={r['media_type']} key_len={r['key_len']} preview={r['key_preview'][:50]}...")

        else:
            # Summary of all listings with media
            rows = (await conn.execute(text("""
                SELECT CAST(l.id AS TEXT) as id, l.title,
                       l.image_url IS NOT NULL AS has_cover,
                       COUNT(m.id) AS media_count
                FROM listings l
                LEFT JOIN listing_media m ON CAST(m.listing_id AS TEXT) = CAST(l.id AS TEXT)
                GROUP BY l.id, l.title, l.image_url
                HAVING COUNT(m.id) > 0 OR l.image_url IS NOT NULL
                ORDER BY media_count DESC
                LIMIT 20
            """))).mappings().all()

            print(f"\nListings with images (top 20):")
            for r in rows:
                print(f"  {r['id'][:8]}... | {r['title'][:30]:<30} | cover={r['has_cover']} | media_rows={r['media_count']}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
