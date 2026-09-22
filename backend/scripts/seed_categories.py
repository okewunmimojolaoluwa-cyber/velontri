"""
Velontri Category System - Complete Seed Script

Seeds all remaining subcategories and common category attributes
for the comprehensive 3-level category taxonomy.

Run after: 001_category_system.sql migration
Usage: python backend/scripts/seed_categories.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from shared.database import get_db_session


# ============================================================================
# REMAINING SUBCATEGORIES DATA
# ============================================================================

# Categories organized by parent slug
SUBCATEGORIES_DATA = {
    # BEAUTY & PERSONAL CARE
    'beauty-personal-care': [
        ('Skincare', 'skincare', 'Face and body skincare products', 1),
        ('Hair Care', 'hair-care', 'Shampoos, conditioners, hair treatments', 2),
        ('Fragrances & Perfumes', 'fragrances-perfumes', 'Perfumes, colognes, and body sprays', 3),
        ('Makeup & Cosmetics', 'makeup-cosmetics', 'Makeup and beauty products', 4),
        ('Nail Care', 'nail-care', 'Nail polish, tools, and treatments', 5),
        ('Dental Care', 'dental-care', 'Toothpaste, mouthwash, and oral care', 6),
        ("Men's Grooming", 'mens-grooming', 'Shaving, beard care, and grooming', 7),
        ('Health & Wellness', 'health-wellness', 'Supplements, vitamins, and wellness', 8),
        ('Other Beauty', 'other-beauty', 'All other beauty products', 9),
    ],
    
    # SERVICES
    'services': [
        ('Cleaning & Laundry', 'cleaning-laundry', 'Home and office cleaning services', 1),
        ('Tutoring & Education', 'tutoring-education', 'Private lessons and tutoring', 2),
        ('Event Planning & Entertainment', 'event-planning-entertainment', 'DJs, MC, event management', 3),
        ('Photography & Videography', 'photography-videography', 'Professional photo and video services', 4),
        ('Web & Tech Services', 'web-tech-services', 'Web design, app development, IT support', 5),
        ('Legal & Financial Services', 'legal-financial-services', 'Lawyers, accountants, consultants', 6),
        ('Logistics & Delivery', 'logistics-delivery', 'Moving, courier, and delivery services', 7),
        ('Security Services', 'security-services', 'Guards, surveillance, security systems', 8),
        ('Healthcare & Wellness', 'healthcare-wellness-services', 'Nursing, therapy, medical services', 9),
        ('Beauty & Barbing', 'beauty-barbing', 'Hairdressing, makeup, salon services', 10),
        ('Catering & Cooking', 'catering-cooking', 'Chefs, catering, meal prep services', 11),
        ('Other Services', 'other-services', 'All other professional services', 12),
    ],
    
    # REPAIR & CONSTRUCTION
    'repair-construction': [
        ('Electrical', 'electrical', 'Electrical repairs and installations', 1),
        ('Plumbing', 'plumbing', 'Plumbing repairs and installations', 2),
        ('Painting & Tiling', 'painting-tiling', 'Interior and exterior painting, tiling', 3),
        ('Carpentry & Furniture', 'carpentry-furniture', 'Woodwork and furniture making', 4),
        ('AC Repair', 'ac-repair', 'Air conditioning repair and maintenance', 5),
        ('Phone & Laptop Repair', 'phone-laptop-repair', 'Electronics and device repairs', 6),
        ('Car Repair & Mechanic', 'car-repair-mechanic', 'Auto repair and maintenance', 7),
        ('Building & Construction', 'building-construction', 'Construction and building projects', 8),
        ('Other Repairs', 'other-repairs', 'All other repair services', 9),
    ],
    
    # COMMERCIAL EQUIPMENT & TOOLS
    'commercial-equipment-tools': [
        ('Industrial Machinery', 'industrial-machinery', 'Factory and industrial equipment', 1),
        ('Restaurant & Catering Equipment', 'restaurant-catering-equipment', 'Commercial kitchen equipment', 2),
        ('Office Equipment', 'office-equipment', 'Copiers, printers, office machines', 3),
        ('Power Tools', 'power-tools', 'Electric and power tools', 4),
        ('Agricultural Tools', 'agricultural-tools', 'Farm tools and implements', 5),
        ('Medical Equipment', 'medical-equipment', 'Healthcare and medical devices', 6),
        ('Other Equipment', 'other-equipment', 'All other commercial equipment', 7),
    ],
    
    # LEISURE & ACTIVITIES
    'leisure-activities': [
        ('Sports & Exercise', 'sports-exercise', 'Gym equipment, sports gear, fitness', 1),
        ('Musical Instruments', 'musical-instruments', 'Guitars, keyboards, drums, and instruments', 2),
        ('Outdoor Recreation', 'outdoor-recreation', 'Camping, hiking, outdoor gear', 3),
        ('Tickets & Vouchers', 'tickets-vouchers', 'Event tickets and gift vouchers', 4),
        ('Toys & Games', 'toys-games', 'Board games, puzzles, toys', 5),
        ('Books, Movies & Music', 'books-movies-music', 'Physical books, DVDs, CDs', 6),
        ('Art & Collectibles', 'art-collectibles', 'Artwork, antiques, collectibles', 7),
        ('Other Leisure', 'other-leisure', 'All other leisure items', 8),
    ],
    
    # BABIES & KIDS
    'babies-kids': [
        ('Baby Clothes', 'baby-clothes', 'Infant and baby clothing', 1),
        ('Pushchairs & Prams', 'pushchairs-prams', 'Strollers, prams, and carriers', 2),
        ('Car Seats', 'car-seats', 'Baby car seats and boosters', 3),
        ('Baby Feeding', 'baby-feeding', 'Bottles, sterilizers, feeding equipment', 4),
        ('Toys & Educational', 'toys-educational', 'Baby toys and learning materials', 5),
        ("Kids' Furniture", 'kids-furniture', 'Beds, cribs, and children furniture', 6),
        ('School Supplies', 'school-supplies', 'Bags, books, stationery for kids', 7),
        ('Other Kids', 'other-kids', 'All other baby and kids items', 8),
    ],
    
    # FOOD, AGRICULTURE & FARMING
    'food-agriculture-farming': [
        ('Farm Produce', 'farm-produce', 'Fresh fruits, vegetables, grains', 1),
        ('Livestock & Poultry', 'livestock-poultry', 'Cows, goats, chickens, and livestock', 2),
        ('Fish & Seafood', 'fish-seafood', 'Fresh and frozen fish and seafood', 3),
        ('Processed Food', 'processed-food', 'Packaged and processed food items', 4),
        ('Seeds & Fertilisers', 'seeds-fertilisers', 'Agricultural inputs and supplies', 5),
        ('Farming Services', 'farming-services', 'Agricultural services and consulting', 6),
        ('Other Agriculture', 'other-agriculture', 'All other agricultural products', 7),
    ],
    
    # ANIMALS & PETS
    'animals-pets': [
        ('Dogs', 'dogs', 'Dogs for sale and adoption', 1),
        ('Cats', 'cats', 'Cats for sale and adoption', 2),
        ('Birds', 'birds', 'Parrots, canaries, and pet birds', 3),
        ('Fish & Aquarium', 'fish-aquarium', 'Aquarium fish and supplies', 4),
        ('Livestock', 'livestock-pets', 'Farm animals', 5),
        ('Pet Food & Accessories', 'pet-food-accessories', 'Pet supplies, food, toys', 6),
        ('Veterinary Services', 'veterinary-services', 'Vet care and animal health', 7),
        ('Other Animals', 'other-animals', 'All other pets and animals', 8),
    ],
    
    # JOBS
    'jobs': [
        ('Accounting & Finance', 'accounting-finance-jobs', 'Finance and accounting roles', 1),
        ('Administration & Office', 'administration-office', 'Admin and clerical positions', 2),
        ('Construction & Artisans', 'construction-artisans', 'Skilled trades and construction', 3),
        ('Customer Service', 'customer-service-jobs', 'Customer support roles', 4),
        ('Education & Training', 'education-training-jobs', 'Teaching and training positions', 5),
        ('Engineering & Technical', 'engineering-technical', 'Engineering and technical roles', 6),
        ('Healthcare & Pharma', 'healthcare-pharma-jobs', 'Medical and healthcare jobs', 7),
        ('ICT & Telecom', 'ict-telecom', 'IT and telecommunications', 8),
        ('Legal', 'legal-jobs', 'Legal and compliance roles', 9),
        ('Management', 'management-jobs', 'Management and executive positions', 10),
        ('Marketing & Sales', 'marketing-sales-jobs', 'Marketing and sales roles', 11),
        ('Media & Entertainment', 'media-entertainment', 'Creative and media jobs', 12),
        ('Transportation', 'transportation-jobs', 'Driving and logistics jobs', 13),
        ('Other Jobs', 'other-jobs', 'All other job categories', 14),
    ],
    
    # SEEKING WORK / CVs
    'seeking-work-cvs': [
        ('Accounting & Finance', 'accounting-finance-cvs', 'Finance professionals seeking work', 1),
        ('Administration', 'administration-cvs', 'Admin professionals seeking work', 2),
        ('Customer Service', 'customer-service-cvs', 'Customer service professionals', 3),
        ('Engineering', 'engineering-cvs', 'Engineers seeking opportunities', 4),
        ('Healthcare', 'healthcare-cvs', 'Healthcare professionals seeking work', 5),
        ('ICT & Software', 'ict-software-cvs', 'IT professionals seeking work', 6),
        ('Sales & Marketing', 'sales-marketing-cvs', 'Sales professionals seeking work', 7),
        ('Teaching & Training', 'teaching-training-cvs', 'Teachers and trainers seeking work', 8),
        ('Transportation', 'transportation-cvs', 'Drivers and logistics professionals', 9),
        ('Other CVs', 'other-cvs', 'All other professionals seeking work', 10),
    ],
    
    # BUSINESS & INDUSTRY
    'business-industry': [
        ('Businesses for Sale', 'businesses-for-sale', 'Existing businesses for acquisition', 1),
        ('Franchise Opportunities', 'franchise-opportunities', 'Franchise businesses', 2),
        ('Investment Opportunities', 'investment-opportunities', 'Investment and partnership deals', 3),
        ('Business Supplies', 'business-supplies', 'Office and business supplies', 4),
        ('Office Furniture', 'office-furniture-business', 'Commercial office furniture', 5),
        ('Stocks & Shares', 'stocks-shares', 'Financial instruments and securities', 6),
        ('Other Business', 'other-business', 'All other business opportunities', 7),
    ],
}


# ============================================================================
# COMMON ATTRIBUTES FOR CATEGORIES
# ============================================================================

# Format: (category_slug, attribute_name, attribute_slug, type, required, searchable, filterable, options, validation_rules)
CATEGORY_ATTRIBUTES = [
    # VEHICLES - Cars
    ('cars', 'Make', 'make', 'text', True, True, True, None, {'max_length': 100}),
    ('cars', 'Model', 'model', 'text', True, True, True, None, {'max_length': 100}),
    ('cars', 'Year', 'year', 'number', True, True, True, None, {'min': 1950, 'max': 2027}),
    ('cars', 'Mileage (km)', 'mileage_km', 'number', False, False, True, None, {'min': 0}),
    ('cars', 'Fuel Type', 'fuel_type', 'select', False, False, True, 
     ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'LPG'], None),
    ('cars', 'Transmission', 'transmission', 'select', False, False, True,
     ['Manual', 'Automatic'], None),
    ('cars', 'Color', 'color', 'select', False, False, True,
     ['Black', 'White', 'Silver', 'Grey', 'Red', 'Blue', 'Green', 'Yellow', 'Brown', 'Other'], None),
    ('cars', 'Body Type', 'body_type', 'select', False, False, True,
     ['Sedan', 'SUV', 'Hatchback', 'Wagon', 'Coupe', 'Van', 'Pickup', 'Convertible'], None),
    ('cars', 'Engine Size (cc)', 'engine_size_cc', 'number', False, False, True, None, {'min': 500, 'max': 10000}),
    
    # PROPERTY - Houses & Apartments
    ('houses-apartments-rent', 'Bedrooms', 'bedrooms', 'number', True, False, True, None, {'min': 0, 'max': 20}),
    ('houses-apartments-rent', 'Bathrooms', 'bathrooms', 'number', True, False, True, None, {'min': 0, 'max': 20}),
    ('houses-apartments-rent', 'Area (sqm)', 'area_sqm', 'number', False, False, True, None, {'min': 10}),
    ('houses-apartments-rent', 'Furnishing', 'furnishing', 'select', False, False, True,
     ['Fully Furnished', 'Semi Furnished', 'Unfurnished'], None),
    ('houses-apartments-rent', 'Parking Spaces', 'parking_spaces', 'number', False, False, True, None, {'min': 0, 'max': 10}),
    
    ('houses-apartments-sale', 'Bedrooms', 'bedrooms', 'number', True, False, True, None, {'min': 0, 'max': 20}),
    ('houses-apartments-sale', 'Bathrooms', 'bathrooms', 'number', True, False, True, None, {'min': 0, 'max': 20}),
    ('houses-apartments-sale', 'Area (sqm)', 'area_sqm', 'number', False, False, True, None, {'min': 10}),
    ('houses-apartments-sale', 'Property Type', 'property_type', 'select', False, False, True,
     ['House', 'Apartment', 'Flat', 'Duplex', 'Bungalow', 'Villa', 'Townhouse'], None),
    
    # PHONES & TABLETS - Mobile Phones
    ('mobile-phones', 'Brand', 'brand', 'text', True, True, True, None, {'max_length': 100}),
    ('mobile-phones', 'Model', 'model', 'text', True, True, True, None, {'max_length': 100}),
    ('mobile-phones', 'Storage', 'storage', 'select', False, False, True,
     ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'], None),
    ('mobile-phones', 'RAM', 'ram', 'select', False, False, True,
     ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'], None),
    ('mobile-phones', 'Screen Size', 'screen_size', 'text', False, False, False, None, {'max_length': 50}),
    ('mobile-phones', 'Battery Capacity', 'battery_capacity', 'text', False, False, False, None, {'max_length': 50}),
    
    # ELECTRONICS - Laptops & Computers
    ('laptops-computers', 'Brand', 'brand', 'text', True, True, True, None, {'max_length': 100}),
    ('laptops-computers', 'Processor', 'processor', 'text', False, True, True, None, {'max_length': 100}),
    ('laptops-computers', 'RAM', 'ram', 'select', False, False, True,
     ['4GB', '8GB', '16GB', '32GB', '64GB'], None),
    ('laptops-computers', 'Storage Type', 'storage_type', 'select', False, False, True,
     ['HDD', 'SSD', 'Hybrid'], None),
    ('laptops-computers', 'Storage Size', 'storage_size', 'select', False, False, True,
     ['128GB', '256GB', '512GB', '1TB', '2TB'], None),
    ('laptops-computers', 'Screen Size', 'screen_size', 'select', False, False, True,
     ['11 inch', '13 inch', '14 inch', '15 inch', '17 inch'], None),
    ('laptops-computers', 'Graphics Card', 'graphics_card', 'text', False, False, False, None, {'max_length': 100}),
    
    # FASHION - Clothing (apply to multiple subcategories)
    ('mens-clothing', 'Size', 'size', 'select', False, False, True,
     ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], None),
    ('mens-clothing', 'Material', 'material', 'text', False, False, False, None, {'max_length': 100}),
    
    ('womens-clothing', 'Size', 'size', 'select', False, False, True,
     ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], None),
    ('womens-clothing', 'Material', 'material', 'text', False, False, False, None, {'max_length': 100}),
    
    # HOME - Furniture
    ('furniture', 'Material', 'material', 'text', False, False, True, None, {'max_length': 100}),
    ('furniture', 'Dimensions', 'dimensions', 'text', False, False, False, None, {'max_length': 100}),
    ('furniture', 'Color', 'color', 'text', False, False, True, None, {'max_length': 50}),
    
    # JOBS
    ('accounting-finance-jobs', 'Job Type', 'job_type', 'select', True, False, True,
     ['Full Time', 'Part Time', 'Contract', 'Remote'], None),
    ('accounting-finance-jobs', 'Experience Level', 'experience_level', 'select', False, False, True,
     ['Entry Level', 'Mid Level', 'Senior Level', 'Executive'], None),
]


# ============================================================================
# SEED FUNCTIONS
# ============================================================================

async def seed_subcategories(session):
    """Seed all remaining subcategories."""
    print("\n📦 Seeding subcategories...")
    
    total_added = 0
    
    for parent_slug, subcats in SUBCATEGORIES_DATA.items():
        # Get parent category ID
        result = await session.execute(
            text("SELECT id FROM categories WHERE slug = :slug AND level = 1"),
            {"slug": parent_slug}
        )
        parent_row = result.fetchone()
        
        if not parent_row:
            print(f"  ⚠️  Parent category '{parent_slug}' not found. Skipping subcategories.")
            continue
        
        parent_id = parent_row[0]
        print(f"\n  📁 {parent_slug.upper()}")
        
        for name, slug, description, sort_order in subcats:
            # Check if already exists
            existing = await session.execute(
                text("SELECT id FROM categories WHERE slug = :slug"),
                {"slug": slug}
            )
            if existing.fetchone():
                print(f"    ✓ {name} (already exists)")
                continue
            
            # Insert subcategory
            await session.execute(
                text("""
                    INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active)
                    VALUES (:name, :slug, :description, :parent_id, 2, :sort_order, TRUE)
                """),
                {
                    "name": name,
                    "slug": slug,
                    "description": description,
                    "parent_id": parent_id,
                    "sort_order": sort_order
                }
            )
            print(f"    + {name}")
            total_added += 1
        
        await session.commit()
    
    print(f"\n✅ Added {total_added} subcategories")


async def seed_category_attributes(session):
    """Seed category-specific attributes."""
    print("\n🏷️  Seeding category attributes...")
    
    total_added = 0
    
    for (category_slug, name, slug, attr_type, required, searchable, 
         filterable, options, validation_rules) in CATEGORY_ATTRIBUTES:
        
        # Get category ID
        result = await session.execute(
            text("SELECT id FROM categories WHERE slug = :slug"),
            {"slug": category_slug}
        )
        category_row = result.fetchone()
        
        if not category_row:
            print(f"  ⚠️  Category '{category_slug}' not found. Skipping attribute '{name}'.")
            continue
        
        category_id = category_row[0]
        
        # Check if attribute already exists
        existing = await session.execute(
            text("""
                SELECT id FROM category_attributes 
                WHERE category_id = :category_id AND slug = :slug
            """),
            {"category_id": category_id, "slug": slug}
        )
        if existing.fetchone():
            continue
        
        # Convert options and validation_rules to JSON
        import json
        options_json = json.dumps(options) if options else None
        validation_json = json.dumps(validation_rules) if validation_rules else None
        
        # Insert attribute
        await session.execute(
            text("""
                INSERT INTO category_attributes 
                (category_id, name, slug, type, required, searchable, filterable, options, validation_rules)
                VALUES 
                (:category_id, :name, :slug, :type, :required, :searchable, :filterable, 
                 :options::jsonb, :validation_rules::jsonb)
            """),
            {
                "category_id": category_id,
                "name": name,
                "slug": slug,
                "type": attr_type,
                "required": required,
                "searchable": searchable,
                "filterable": filterable,
                "options": options_json,
                "validation_rules": validation_json
            }
        )
        print(f"  + {category_slug} → {name} ({attr_type})")
        total_added += 1
    
    await session.commit()
    print(f"\n✅ Added {total_added} attributes")


async def verify_seeding(session):
    """Verify the seeding was successful."""
    print("\n🔍 Verifying seeded data...")
    
    # Count categories by level
    result = await session.execute(
        text("SELECT level, COUNT(*) FROM categories GROUP BY level ORDER BY level")
    )
    
    print("\n📊 Category counts:")
    for row in result:
        level, count = row
        level_name = {1: "Top-level", 2: "Subcategories", 3: "Level-3"}
        print(f"  {level_name.get(level, f'Level {level}')}: {count}")
    
    # Count attributes
    result = await session.execute(
        text("SELECT COUNT(*) FROM category_attributes")
    )
    attr_count = result.scalar()
    print(f"\n🏷️  Total attributes: {attr_count}")
    
    print("\n✅ Verification complete")


async def main():
    """Main execution function."""
    print("=" * 70)
    print("VELONTRI CATEGORY SYSTEM - SEED SCRIPT")
    print("=" * 70)
    
    async with get_db_session() as session:
        try:
            await seed_subcategories(session)
            await seed_category_attributes(session)
            await verify_seeding(session)
            
            print("\n" + "=" * 70)
            print("✅ CATEGORY SEEDING COMPLETE")
            print("=" * 70)
            print("\nNext steps:")
            print("1. Run: python backend/scripts/migrate_existing_listings.py")
            print("2. Verify listings have category_id references")
            print("3. Update frontend to use new category API")
            print()
            
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
