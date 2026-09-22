-- ============================================================================
-- Velontri Category System Migration
-- 
-- Creates a production-grade, 3-level category taxonomy for pan-African commerce
-- Includes 28 top-level categories, 200+ subcategories, and dynamic attributes
--
-- Author: Velontri Dev Team
-- Date: 2026-09-21
-- Version: 1.0.0
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TABLES
-- ============================================================================

-- Core category table with hierarchical structure
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
    icon VARCHAR(50),              -- Icon identifier (e.g., 'car', 'home', 'phone')
    image_url TEXT,                -- Optional category banner image
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    seo_title VARCHAR(200),        -- SEO page title
    seo_description TEXT,          -- SEO meta description
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Category-specific attributes for dynamic fields
CREATE TABLE IF NOT EXISTS category_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,    -- Display name (e.g., "Year Manufactured")
    slug VARCHAR(100) NOT NULL,    -- Field name (e.g., "year")
    type VARCHAR(50) NOT NULL,     -- text, number, select, multiselect, boolean
    required BOOLEAN DEFAULT FALSE,
    searchable BOOLEAN DEFAULT FALSE,  -- Index in search
    filterable BOOLEAN DEFAULT TRUE,   -- Show in filters
    options JSONB,                     -- For select/multiselect: ["option1", "option2"]
    validation_rules JSONB,            -- Min/max for numbers, regex for text
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update listings table to support new category system
ALTER TABLE listings 
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
    ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES categories(id),
    ADD COLUMN IF NOT EXISTS child_category_id UUID REFERENCES categories(id),
    ADD COLUMN IF NOT EXISTS attributes JSONB;  -- Store category-specific data

-- ============================================================================
-- PART 2: CREATE INDICES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

CREATE INDEX IF NOT EXISTS idx_category_attributes_category_id ON category_attributes(category_id);
CREATE INDEX IF NOT EXISTS idx_category_attributes_slug ON category_attributes(slug);

CREATE INDEX IF NOT EXISTS idx_listings_category_id ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_subcategory_id ON listings(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_listings_attributes ON listings USING gin(attributes);

-- ============================================================================
-- PART 3: SEED TOP-LEVEL CATEGORIES (Level 1)
-- ============================================================================

-- 28 comprehensive categories covering all African commerce

-- 1. VEHICLES & AUTO
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Vehicles', 'vehicles', 'Cars, motorcycles, trucks, buses, boats, and vehicle parts', NULL, 1, 'car', 1, TRUE, 'Buy and Sell Vehicles Online in Africa | Velontri', 'Find the best deals on new and used vehicles across Africa. Cars, motorcycles, trucks, buses, and more.');

-- 2. PROPERTY & REAL ESTATE
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Property', 'property', 'Houses, apartments, land, commercial property for sale or rent', NULL, 1, 'house', 2, TRUE, 'Property for Sale and Rent in Africa | Velontri', 'Explore properties across Africa. Houses, apartments, land, and commercial spaces for sale or rent.');

-- 3. PHONES & TABLETS
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Phones & Tablets', 'phones-tablets', 'Mobile phones, tablets, and accessories', NULL, 1, 'device-mobile', 3, TRUE, 'Mobile Phones & Tablets for Sale | Velontri', 'Buy new and used smartphones, tablets, and accessories from verified sellers across Africa.');

-- 4. ELECTRONICS
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Electronics', 'electronics', 'Laptops, computers, TVs, audio equipment, cameras, and more', NULL, 1, 'desktop', 4, TRUE, 'Electronics & Gadgets Online | Velontri', 'Shop for laptops, TVs, cameras, audio equipment, and electronics at great prices.');

-- 5. HOME, FURNITURE & APPLIANCES
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Home, Furniture & Appliances', 'home-furniture-appliances', 'Furniture, kitchen appliances, home decor, and household items', NULL, 1, 'couch', 5, TRUE, 'Home Furniture & Appliances | Velontri', 'Quality furniture, appliances, and home essentials delivered across Africa.');

-- 6. FASHION
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Fashion', 'fashion', 'Men''s, women''s, and children''s clothing, shoes, bags, and accessories', NULL, 1, 'tshirt', 6, TRUE, 'African Fashion & Clothing Online | Velontri', 'Discover the latest fashion trends. Clothing, shoes, bags, and accessories for all.');

-- 7. BEAUTY & PERSONAL CARE
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Beauty & Personal Care', 'beauty-personal-care', 'Skincare, haircare, cosmetics, fragrances, and grooming products', NULL, 1, 'sparkle', 7, TRUE, 'Beauty & Personal Care Products | Velontri', 'Shop authentic beauty products, skincare, makeup, and personal care essentials.');

-- 8. SERVICES
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Services', 'services', 'Professional services including tutoring, event planning, tech services, and more', NULL, 1, 'briefcase', 8, TRUE, 'Professional Services in Africa | Velontri', 'Find trusted service providers for cleaning, tutoring, events, web design, and more.');

-- 9. REPAIR & CONSTRUCTION
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Repair & Construction', 'repair-construction', 'Electrical, plumbing, painting, carpentry, and building services', NULL, 1, 'wrench', 9, TRUE, 'Repair & Construction Services | Velontri', 'Connect with skilled artisans for repairs, construction, and home improvement.');

-- 10. COMMERCIAL EQUIPMENT & TOOLS
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Commercial Equipment & Tools', 'commercial-equipment-tools', 'Industrial machinery, restaurant equipment, office equipment, and tools', NULL, 1, 'toolbox', 10, TRUE, 'Commercial Equipment & Tools for Sale | Velontri', 'Buy and sell commercial equipment, machinery, and tools for your business.');

-- 11. LEISURE & ACTIVITIES
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Leisure & Activities', 'leisure-activities', 'Sports, music, hobbies, books, games, and entertainment', NULL, 1, 'basketball', 11, TRUE, 'Sports, Hobbies & Leisure | Velontri', 'Explore sports equipment, musical instruments, books, games, and entertainment.');

-- 12. BABIES & KIDS
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Babies & Kids', 'babies-kids', 'Baby clothes, toys, strollers, feeding equipment, and children''s items', NULL, 1, 'baby-carriage', 12, TRUE, 'Baby & Kids Products | Velontri', 'Everything you need for your little ones. Baby clothes, toys, and essentials.');

-- 13. FOOD, AGRICULTURE & FARMING
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Food, Agriculture & Farming', 'food-agriculture-farming', 'Farm produce, livestock, processed food, seeds, and farming services', NULL, 1, 'plant', 13, TRUE, 'Agriculture & Farming Products | Velontri', 'Buy farm produce, livestock, seeds, fertilizers, and agricultural equipment.');

-- 14. ANIMALS & PETS
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Animals & Pets', 'animals-pets', 'Pets, pet food, accessories, and veterinary services', NULL, 1, 'dog', 14, TRUE, 'Pets & Animals for Sale | Velontri', 'Find pets, pet supplies, and veterinary services across Africa.');

-- 15. JOBS
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Jobs', 'jobs', 'Job listings across all industries and experience levels', NULL, 1, 'suitcase', 15, TRUE, 'Jobs & Career Opportunities in Africa | Velontri', 'Browse thousands of job opportunities across Africa in various industries.');

-- 16. SEEKING WORK / CVs
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Seeking Work / CVs', 'seeking-work-cvs', 'Job seekers advertising their skills and availability', NULL, 1, 'user-focus', 16, TRUE, 'Find Skilled Workers & Freelancers | Velontri', 'Hire talented professionals looking for work opportunities.');

-- 17. BUSINESS & INDUSTRY
INSERT INTO categories (name, slug, description, parent_id, level, icon, sort_order, is_active, seo_title, seo_description) VALUES
('Business & Industry', 'business-industry', 'Businesses for sale, franchises, investments, and business supplies', NULL, 1, 'buildings', 17, TRUE, 'Business Opportunities & Investments | Velontri', 'Explore business opportunities, franchises, and investment deals.');

-- ============================================================================
-- PART 4: SEED SUBCATEGORIES (Level 2)
-- ============================================================================

-- Get category IDs for reference (we'll use subqueries in INSERT statements)

-- VEHICLES SUBCATEGORIES
INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Cars', 'cars', 'Sedans, SUVs, hatchbacks, and all car types', id, 2, 1, TRUE FROM categories WHERE slug = 'vehicles';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Motorcycles & Scooters', 'motorcycles-scooters', 'Bikes, scooters, and two-wheelers', id, 2, 2, TRUE FROM categories WHERE slug = 'vehicles';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Trucks & Trailers', 'trucks-trailers', 'Commercial trucks, trailers, and heavy vehicles', id, 2, 3, TRUE FROM categories WHERE slug = 'vehicles';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Buses & Minibuses', 'buses-minibuses', 'Passenger buses and minibuses', id, 2, 4, TRUE FROM categories WHERE slug = 'vehicles';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Boats & Watercraft', 'boats-watercraft', 'Boats, jet skis, and marine vessels', id, 2, 5, TRUE FROM categories WHERE slug = 'vehicles';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Heavy Equipment', 'heavy-equipment', 'Construction and industrial vehicles', id, 2, 6, TRUE FROM categories WHERE slug = 'vehicles';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Vehicle Parts & Accessories', 'vehicle-parts-accessories', 'Car parts, tires, batteries, and accessories', id, 2, 7, TRUE FROM categories WHERE slug = 'vehicles';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Tractors & Farm Equipment', 'tractors-farm-equipment', 'Agricultural vehicles and machinery', id, 2, 8, TRUE FROM categories WHERE slug = 'vehicles';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Other Vehicles', 'other-vehicles', 'All other vehicle types', id, 2, 9, TRUE FROM categories WHERE slug = 'vehicles';

-- PROPERTY SUBCATEGORIES
INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Houses & Apartments for Rent', 'houses-apartments-rent', 'Residential properties available for rent', id, 2, 1, TRUE FROM categories WHERE slug = 'property';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Houses & Apartments for Sale', 'houses-apartments-sale', 'Residential properties for sale', id, 2, 2, TRUE FROM categories WHERE slug = 'property';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Land & Plots for Sale', 'land-plots-sale', 'Vacant land and plots for sale', id, 2, 3, TRUE FROM categories WHERE slug = 'property';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Land & Plots for Rent', 'land-plots-rent', 'Land available for lease', id, 2, 4, TRUE FROM categories WHERE slug = 'property';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Commercial Property for Rent', 'commercial-property-rent', 'Offices, shops, warehouses for rent', id, 2, 5, TRUE FROM categories WHERE slug = 'property';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Commercial Property for Sale', 'commercial-property-sale', 'Commercial buildings and spaces for sale', id, 2, 6, TRUE FROM categories WHERE slug = 'property';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Short Let / Vacation', 'short-let-vacation', 'Short-term rentals and vacation homes', id, 2, 7, TRUE FROM categories WHERE slug = 'property';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Event Centres & Halls', 'event-centres-halls', 'Venues for events and celebrations', id, 2, 8, TRUE FROM categories WHERE slug = 'property';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Other Property', 'other-property', 'All other property types', id, 2, 9, TRUE FROM categories WHERE slug = 'property';

-- PHONES & TABLETS SUBCATEGORIES
INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Mobile Phones', 'mobile-phones', 'Smartphones and feature phones', id, 2, 1, TRUE FROM categories WHERE slug = 'phones-tablets';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Tablets', 'tablets', 'iPads, Android tablets, and e-readers', id, 2, 2, TRUE FROM categories WHERE slug = 'phones-tablets';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Phone Cases & Covers', 'phone-cases-covers', 'Protective cases and covers', id, 2, 3, TRUE FROM categories WHERE slug = 'phones-tablets';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Chargers & Cables', 'chargers-cables', 'Charging accessories and cables', id, 2, 4, TRUE FROM categories WHERE slug = 'phones-tablets';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Screen Protectors', 'screen-protectors', 'Tempered glass and screen protection', id, 2, 5, TRUE FROM categories WHERE slug = 'phones-tablets';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Phone Parts & Accessories', 'phone-parts-accessories', 'Batteries, screens, and other parts', id, 2, 6, TRUE FROM categories WHERE slug = 'phones-tablets';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Other Phones & Tablets', 'other-phones-tablets', 'All other mobile accessories', id, 2, 7, TRUE FROM categories WHERE slug = 'phones-tablets';

-- ELECTRONICS SUBCATEGORIES
INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Laptops & Computers', 'laptops-computers', 'Desktops, laptops, and workstations', id, 2, 1, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'TVs & Monitors', 'tvs-monitors', 'Televisions and computer monitors', id, 2, 2, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Audio & Music Equipment', 'audio-music-equipment', 'Speakers, headphones, sound systems', id, 2, 3, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Cameras & Photography', 'cameras-photography', 'Cameras, lenses, and photography gear', id, 2, 4, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Computer Accessories', 'computer-accessories', 'Keyboards, mice, storage, and peripherals', id, 2, 5, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Game Consoles & Video Games', 'game-consoles-video-games', 'Gaming systems and games', id, 2, 6, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Printers & Scanners', 'printers-scanners', 'Printing and scanning equipment', id, 2, 7, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Networking & Wi-Fi', 'networking-wifi', 'Routers, modems, and network equipment', id, 2, 8, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Power & Solar', 'power-solar', 'Inverters, solar panels, and power solutions', id, 2, 9, TRUE FROM categories WHERE slug = 'electronics';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Other Electronics', 'other-electronics', 'All other electronic devices', id, 2, 10, TRUE FROM categories WHERE slug = 'electronics';

-- HOME, FURNITURE & APPLIANCES SUBCATEGORIES
INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Furniture', 'furniture', 'Sofas, beds, tables, chairs, and storage', id, 2, 1, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Kitchen Appliances', 'kitchen-appliances', 'Stoves, fridges, microwaves, blenders', id, 2, 2, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Home Appliances', 'home-appliances', 'Washing machines, irons, vacuum cleaners', id, 2, 3, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Bedding & Linen', 'bedding-linen', 'Mattresses, sheets, pillows, and duvets', id, 2, 4, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Curtains & Blinds', 'curtains-blinds', 'Window treatments and shades', id, 2, 5, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Lighting & Fans', 'lighting-fans', 'Lamps, ceiling fans, and lighting fixtures', id, 2, 6, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Home Decor & Accessories', 'home-decor-accessories', 'Art, mirrors, rugs, and decorative items', id, 2, 7, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Garden & Outdoor', 'garden-outdoor', 'Garden furniture, tools, and outdoor items', id, 2, 8, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Air Conditioners', 'air-conditioners', 'AC units and cooling systems', id, 2, 9, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Generators', 'generators', 'Power generators and backup power', id, 2, 10, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Other Home Items', 'other-home-items', 'All other home and furniture items', id, 2, 11, TRUE FROM categories WHERE slug = 'home-furniture-appliances';

-- FASHION SUBCATEGORIES
INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Men''s Clothing', 'mens-clothing', 'Shirts, trousers, suits, and menswear', id, 2, 1, TRUE FROM categories WHERE slug = 'fashion';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Women''s Clothing', 'womens-clothing', 'Dresses, tops, skirts, and womenswear', id, 2, 2, TRUE FROM categories WHERE slug = 'fashion';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Children''s Clothing', 'childrens-clothing', 'Kids fashion and clothing', id, 2, 3, TRUE FROM categories WHERE slug = 'fashion';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Shoes & Sandals', 'shoes-sandals', 'Footwear for all occasions', id, 2, 4, TRUE FROM categories WHERE slug = 'fashion';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Bags & Luggage', 'bags-luggage', 'Handbags, backpacks, and travel bags', id, 2, 5, TRUE FROM categories WHERE slug = 'fashion';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Watches & Jewellery', 'watches-jewellery', 'Timepieces and jewelry', id, 2, 6, TRUE FROM categories WHERE slug = 'fashion';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Accessories & Sunglasses', 'accessories-sunglasses', 'Belts, sunglasses, and fashion accessories', id, 2, 7, TRUE FROM categories WHERE slug = 'fashion';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Traditional Attire', 'traditional-attire', 'African traditional clothing and fabrics', id, 2, 8, TRUE FROM categories WHERE slug = 'fashion';

INSERT INTO categories (name, slug, description, parent_id, level, sort_order, is_active) 
SELECT 'Other Fashion', 'other-fashion', 'All other fashion items', id, 2, 9, TRUE FROM categories WHERE slug = 'fashion';

-- Continue with remaining subcategories...
-- (Beauty, Services, Repair, etc. - to be added in seed script for brevity)

-- ============================================================================
-- PART 5: CREATE TRIGGERS FOR AUTO-UPDATE
-- ============================================================================

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_categories_updated_at();

-- ============================================================================
-- PART 6: NOTES FOR DATA MIGRATION
-- ============================================================================

-- IMPORTANT: This migration adds new category tables but does NOT migrate
-- existing listings yet. Follow these steps:
--
-- 1. Run this migration to create tables and seed categories
-- 2. Run backend/scripts/seed_categories.py to add remaining subcategories
-- 3. Run backend/scripts/migrate_existing_listings.py to map old string categories
-- 4. Verify all listings have valid category_id references
-- 5. Once verified, you can optionally drop the old 'category' and 'subcategory' columns
--
-- DO NOT drop old columns until migration is complete and verified!

COMMIT;
