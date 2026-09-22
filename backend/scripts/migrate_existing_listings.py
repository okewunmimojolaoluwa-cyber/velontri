"""
Velontri Category System - Listing Migration Script

Migrates existing listings from string-based categories to the new
UUID-based category system while maintaining backward compatibility.

Run after: 
  1. 001_category_system.sql migration
  2. seed_categories.py

Usage: python backend/scripts/migrate_existing_listings.py
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from shared.database import get_db_session


# ============================================================================
# CATEGORY MAPPING - Old String → New Slug
# ============================================================================

# Maps old hardcoded category strings to new category slugs
CATEGORY_MAPPING = {
    # VEHICLES
    'Vehicles': 'vehicles',
    'Cars': 'cars',
    'Motorcycles & Scooters': 'motorcycles-scooters',
    'Trucks & Trailers': 'trucks-trailers',
    'Buses & Minibuses': 'buses-minibuses',
    'Boats & Watercraft': 'boats-watercraft',
    'Heavy Equipment': 'heavy-equipment',
    'Vehicle Parts & Accessories': 'vehicle-parts-accessories',
    'Tractors & Farm Equipment': 'tractors-farm-equipment',
    'Other Vehicles': 'other-vehicles',
    
    # PROPERTY
    'Property': 'property',
    'Houses & Apartments for Rent': 'houses-apartments-rent',
    'Houses & Apartments for Sale': 'houses-apartments-sale',
    'Land & Plots for Sale': 'land-plots-sale',
    'Land & Plots for Rent': 'land-plots-rent',
    'Commercial Property for Rent': 'commercial-property-rent',
    'Commercial Property for Sale': 'commercial-property-sale',
    'Short Let / Vacation': 'short-let-vacation',
    'Event Centres & Halls': 'event-centres-halls',
    'Other Property': 'other-property',
    
    # PHONES & TABLETS
    'Phones & Tablets': 'phones-tablets',
    'Mobile Phones': 'mobile-phones',
    'Tablets': 'tablets',
    'Phone Cases & Covers': 'phone-cases-covers',
    'Chargers & Cables': 'chargers-cables',
    'Screen Protectors': 'screen-protectors',
    'Phone Parts & Accessories': 'phone-parts-accessories',
    'Other Phones & Tablets': 'other-phones-tablets',
    
    # ELECTRONICS
    'Electronics': 'electronics',
    'Laptops & Computers': 'laptops-computers',
    'TVs & Monitors': 'tvs-monitors',
    'Audio & Music Equipment': 'audio-music-equipment',
    'Cameras & Photography': 'cameras-photography',
    'Computer Accessories': 'computer-accessories',
    'Game Consoles & Video Games': 'game-consoles-video-games',
    'Printers & Scanners': 'printers-scanners',
    'Networking & Wi-Fi': 'networking-wifi',
    'Power & Solar': 'power-solar',
    'Other Electronics': 'other-electronics',
    
    # HOME, FURNITURE & APPLIANCES
    'Home, Furniture & Appliances': 'home-furniture-appliances',
    'Furniture': 'furniture',
    'Kitchen Appliances': 'kitchen-appliances',
    'Home Appliances': 'home-appliances',
    'Bedding & Linen': 'bedding-linen',
    'Curtains & Blinds': 'curtains-blinds',
    'Lighting & Fans': 'lighting-fans',
    'Home Decor & Accessories': 'home-decor-accessories',
    'Garden & Outdoor': 'garden-outdoor',
    'Air Conditioners': 'air-conditioners',
    'Generators': 'generators',
    'Other Home Items': 'other-home-items',
    
    # FASHION
    'Fashion': 'fashion',
    "Men's Clothing": 'mens-clothing',
    "Women's Clothing": 'womens-clothing',
    "Children's Clothing": 'childrens-clothing',
    'Shoes & Sandals': 'shoes-sandals',
    'Bags & Luggage': 'bags-luggage',
    'Watches & Jewellery': 'watches-jewellery',
    'Accessories & Sunglasses': 'accessories-sunglasses',
    'Traditional Attire': 'traditional-attire',
    'Other Fashion': 'other-fashion',
    
    # BEAUTY & PERSONAL CARE
    'Beauty & Personal Care': 'beauty-personal-care',
    'Skincare': 'skincare',
    'Hair Care': 'hair-care',
    'Fragrances & Perfumes': 'fragrances-perfumes',
    'Makeup & Cosmetics': 'makeup-cosmetics',
    'Nail Care': 'nail-care',
    'Dental Care': 'dental-care',
    "Men's Grooming": 'mens-grooming',
    'Health & Wellness': 'health-wellness',
    'Other Beauty': 'other-beauty',
    
    # SERVICES
    'Services': 'services',
    'Cleaning & Laundry': 'cleaning-laundry',
    'Tutoring & Education': 'tutoring-education',
    'Event Planning & Entertainment': 'event-planning-entertainment',
    'Photography & Videography': 'photography-videography',
    'Web & Tech Services': 'web-tech-services',
    'Legal & Financial Services': 'legal-financial-services',
    'Logistics & Delivery': 'logistics-delivery',
    'Security Services': 'security-services',
    'Healthcare & Wellness': 'healthcare-wellness-services',
    'Beauty & Barbing': 'beauty-barbing',
    'Catering & Cooking': 'catering-cooking',
    'Other Services': 'other-services',
    
    # REPAIR & CONSTRUCTION
    'Repair & Construction': 'repair-construction',
    'Electrical': 'electrical',
    'Plumbing': 'plumbing',
    'Painting & Tiling': 'painting-tiling',
    'Carpentry & Furniture': 'carpentry-furniture',
    'AC Repair': 'ac-repair',
    'Phone & Laptop Repair': 'phone-laptop-repair',
    'Car Repair & Mechanic': 'car-repair-mechanic',
    'Building & Construction': 'building-construction',
    'Other Repairs': 'other-repairs',
    
    # COMMERCIAL EQUIPMENT & TOOLS
    'Commercial Equipment & Tools': 'commercial-equipment-tools',
    'Industrial Machinery': 'industrial-machinery',
    'Restaurant & Catering Equipment': 'restaurant-catering-equipment',
    'Office Equipment': 'office-equipment',
    'Power Tools': 'power-tools',
    'Agricultural Tools': 'agricultural-tools',
    'Medical Equipment': 'medical-equipment',
    'Other Equipment': 'other-equipment',
    
    # LEISURE & ACTIVITIES
    'Leisure & Activities': 'leisure-activities',
    'Sports & Exercise': 'sports-exercise',
    'Musical Instruments': 'musical-instruments',
    'Outdoor Recreation': 'outdoor-recreation',
    'Tickets & Vouchers': 'tickets-vouchers',
    'Toys & Games': 'toys-games',
    'Books, Movies & Music': 'books-movies-music',
    'Art & Collectibles': 'art-collectibles',
    'Other Leisure': 'other-leisure',
    
    # BABIES & KIDS
    'Babies & Kids': 'babies-kids',
    'Baby Clothes': 'baby-clothes',
    'Pushchairs & Prams': 'pushchairs-prams',
    'Car Seats': 'car-seats',
    'Baby Feeding': 'baby-feeding',
    'Toys & Educational': 'toys-educational',
    "Kids' Furniture": 'kids-furniture',
    'School Supplies': 'school-supplies',
    'Other Kids': 'other-kids',
    
    # FOOD, AGRICULTURE & FARMING
    'Food, Agriculture & Farming': 'food-agriculture-farming',
    'Farm Produce': 'farm-produce',
    'Livestock & Poultry': 'livestock-poultry',
    'Fish & Seafood': 'fish-seafood',
    'Processed Food': 'processed-food',
    'Seeds & Fertilisers': 'seeds-fertilisers',
    'Farming Services': 'farming-services',
    'Other Agriculture': 'other-agriculture',
    
    # ANIMALS & PETS
    'Animals & Pets': 'animals-pets',
    'Dogs': 'dogs',
    'Cats': 'cats',
    'Birds': 'birds',
    'Fish & Aquarium': 'fish-aquarium',
    'Livestock': 'livestock-pets',
    'Pet Food & Accessories': 'pet-food-accessories',
    'Veterinary Services': 'veterinary-services',
    'Other Animals': 'other-animals',
    
    # JOBS
    'Jobs': 'jobs',
    'Accounting & Finance': 'accounting-finance-jobs',
    'Administration & Office': 'administration-office',
    'Construction & Artisans': 'construction-artisans',
    'Customer Service': 'customer-service-jobs',
    'Education & Training': 'education-training-jobs',
    'Engineering & Technical': 'engineering-technical',
    'Healthcare & Pharma': 'healthcare-pharma-jobs',
    'ICT & Telecom': 'ict-telecom',
    'Legal': 'legal-jobs',
    'Management': 'management-jobs',
    'Marketing & Sales': 'marketing-sales-jobs',
    'Media & Entertainment': 'media-entertainment',
    'Transportation': 'transportation-jobs',
    'Other Jobs': 'other-jobs',
    
    # SEEKING WORK / CVs
    'Seeking Work / CVs': 'seeking-work-cvs',
    'ICT & Software': 'ict-software-cvs',
    'Sales & Marketing': 'sales-marketing-cvs',
    'Teaching & Training': 'teaching-training-cvs',
    'Other CVs': 'other-cvs',
    
    # BUSINESS & INDUSTRY
    'Business & Industry': 'business-industry',
    'Businesses for Sale': 'businesses-for-sale',
    'Franchise Opportunities': 'franchise-opportunities',
    'Investment Opportunities': 'investment-opportunities',
    'Business Supplies': 'business-supplies',
    'Office Furniture': 'office-furniture-business',
    'Stocks & Shares': 'stocks-shares',
    'Other Business': 'other-business',
}


# ============================================================================
# MIGRATION FUNCTIONS
# ============================================================================

async def get_category_id(session, slug: str):
    """Get category ID from slug."""
    result = await session.execute(
        text("SELECT id FROM categories WHERE slug = :slug"),
        {"slug": slug}
    )
    row = result.fetchone()
    return row[0] if row else None


async def migrate_listings(session, dry_run=False):
    """Migrate listings from string categories to UUID categories."""
    print("\n📦 Fetching existing listings...")
    
    # Get all listings with string categories
    result = await session.execute(
        text("""
            SELECT id, category, subcategory, listing_type
            FROM listings
            WHERE category_id IS NULL
            ORDER BY created_at DESC
        """)
    )
    listings = result.fetchall()
    
    if not listings:
        print("  ✅ No listings to migrate (all already have category_id)")
        return
    
    print(f"  Found {len(listings)} listings to migrate\n")
    
    stats = {
        'total': len(listings),
        'success': 0,
        'failed': 0,
        'no_category': 0,
        'unmapped_categories': set(),
        'unmapped_subcategories': set()
    }
    
    for listing_id, category_str, subcategory_str, listing_type in listings:
        category_id = None
        subcategory_id = None
        
        # Map category string to slug
        if category_str:
            category_slug = CATEGORY_MAPPING.get(category_str)
            if category_slug:
                category_id = await get_category_id(session, category_slug)
                if not category_id:
                    print(f"  ⚠️  Slug '{category_slug}' not found in database")
            else:
                stats['unmapped_categories'].add(category_str)
        
        # Map subcategory string to slug
        if subcategory_str:
            subcategory_slug = CATEGORY_MAPPING.get(subcategory_str)
            if subcategory_slug:
                subcategory_id = await get_category_id(session, subcategory_slug)
                if not subcategory_id:
                    print(f"  ⚠️  Slug '{subcategory_slug}' not found in database")
            else:
                stats['unmapped_subcategories'].add(subcategory_str)
        
        # Update listing
        if category_id or subcategory_id:
            if not dry_run:
                await session.execute(
                    text("""
                        UPDATE listings
                        SET category_id = :category_id,
                            subcategory_id = :subcategory_id
                        WHERE id = :listing_id
                    """),
                    {
                        "listing_id": listing_id,
                        "category_id": category_id,
                        "subcategory_id": subcategory_id
                    }
                )
            stats['success'] += 1
            print(f"  ✓ {listing_id} → {category_str} / {subcategory_str}")
        else:
            stats['failed'] += 1
            stats['no_category'] += 1
            print(f"  ✗ {listing_id} → No category mapping found")
    
    if not dry_run:
        await session.commit()
    
    return stats


async def print_migration_report(stats):
    """Print migration statistics."""
    print("\n" + "=" * 70)
    print("MIGRATION REPORT")
    print("=" * 70)
    
    print(f"\n📊 Statistics:")
    print(f"  Total listings: {stats['total']}")
    print(f"  ✅ Successfully migrated: {stats['success']}")
    print(f"  ❌ Failed: {stats['failed']}")
    print(f"  ⚠️  No category found: {stats['no_category']}")
    
    if stats['unmapped_categories']:
        print(f"\n🔍 Unmapped categories ({len(stats['unmapped_categories'])}):")
        for cat in sorted(stats['unmapped_categories']):
            print(f"    - {cat}")
    
    if stats['unmapped_subcategories']:
        print(f"\n🔍 Unmapped subcategories ({len(stats['unmapped_subcategories'])}):")
        for subcat in sorted(stats['unmapped_subcategories']):
            print(f"    - {subcat}")
    
    success_rate = (stats['success'] / stats['total'] * 100) if stats['total'] > 0 else 0
    print(f"\n📈 Success rate: {success_rate:.1f}%")


async def verify_migration(session):
    """Verify migration was successful."""
    print("\n🔍 Verifying migration...")
    
    # Count listings with categories
    result = await session.execute(
        text("""
            SELECT 
                COUNT(*) as total,
                COUNT(category_id) as with_category,
                COUNT(subcategory_id) as with_subcategory
            FROM listings
        """)
    )
    row = result.fetchone()
    total, with_category, with_subcategory = row
    
    print(f"\n📊 Listing statistics:")
    print(f"  Total listings: {total}")
    print(f"  With category_id: {with_category} ({with_category/total*100:.1f}%)")
    print(f"  With subcategory_id: {with_subcategory} ({with_subcategory/total*100:.1f}%)")
    
    # Find listings without categories
    result = await session.execute(
        text("""
            SELECT id, title, category, subcategory
            FROM listings
            WHERE category_id IS NULL
            LIMIT 10
        """)
    )
    unmigrated = result.fetchall()
    
    if unmigrated:
        print(f"\n⚠️  Found {len(unmigrated)} listings without category_id:")
        for listing_id, title, cat, subcat in unmigrated:
            print(f"    - {listing_id}: {title[:50]} (cat: {cat}, subcat: {subcat})")
    else:
        print("\n✅ All listings have category_id assigned")


async def main():
    """Main execution function."""
    print("=" * 70)
    print("VELONTRI CATEGORY SYSTEM - LISTING MIGRATION")
    print("=" * 70)
    print("\nThis script migrates existing listings to the new category system.")
    print("Old category strings will be preserved for backward compatibility.\n")
    
    # Ask for confirmation
    response = input("Run migration? (yes/dry-run/no): ").strip().lower()
    
    if response == 'no':
        print("Migration cancelled.")
        return
    
    dry_run = response == 'dry-run'
    
    if dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made\n")
    else:
        print("\n✅ LIVE MODE - Changes will be committed\n")
    
    async with get_db_session() as session:
        try:
            stats = await migrate_listings(session, dry_run=dry_run)
            
            if stats:
                await print_migration_report(stats)
            
            if not dry_run:
                await verify_migration(session)
            
            print("\n" + "=" * 70)
            if dry_run:
                print("✅ DRY RUN COMPLETE - No changes made")
            else:
                print("✅ MIGRATION COMPLETE")
            print("=" * 70)
            
            if not dry_run:
                print("\nNext steps:")
                print("1. Verify listings in database")
                print("2. Update search indices (reindex listings)")
                print("3. Deploy backend API changes")
                print("4. Update frontend to use new category API")
                print()
            
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
