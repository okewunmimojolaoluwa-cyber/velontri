-- ══════════════════════════════════════════════════════════════
-- Velontri Database Performance Optimization
-- Run this SQL script to create all necessary indexes
-- ══════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ══════════════════════════════════════════════════════════════
-- LISTINGS TABLE - Most critical for homepage performance
-- ══════════════════════════════════════════════════════════════

-- Core browse query (status + created_at for latest listings)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_status_created 
ON listings (status, created_at DESC);

-- Category filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_category_status 
ON listings (category, status, created_at DESC);

-- Listing type filtering (vehicles, property, etc.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_type_status 
ON listings (listing_type, status, created_at DESC);

-- Location search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_city 
ON listings (city);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_country 
ON listings (country);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_location_status 
ON listings (city, country, status);

-- Price filtering and sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_price 
ON listings (price);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_currency_price 
ON listings (currency, price);

-- Seller listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_seller_status 
ON listings (seller_id, status, created_at DESC);

-- Full-text search (GiST index for better ILIKE performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_title_gin 
ON listings USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_description_gin 
ON listings USING GIN (description gin_trgm_ops);

-- ══════════════════════════════════════════════════════════════
-- LISTING_MEDIA TABLE - For image loading
-- ══════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_media_listing_type 
ON listing_media (listing_id, media_type, sort_order);

-- ══════════════════════════════════════════════════════════════
-- USERS TABLE - For seller verification checks
-- ══════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_verification_status 
ON users (seller_verification_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_verification 
ON users (id, seller_verification_status);

-- ══════════════════════════════════════════════════════════════
-- STORES TABLE - For store listings
-- ══════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_user_status 
ON stores (user_id, status);

-- ══════════════════════════════════════════════════════════════
-- REVIEWS TABLE - For ratings
-- ══════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_listing 
ON reviews (listing_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_seller 
ON reviews (seller_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- ORDERS TABLE - For transaction history
-- ══════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_buyer_created 
ON orders (buyer_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_seller_created 
ON orders (seller_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status 
ON orders (status, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- UPDATE STATISTICS
-- ══════════════════════════════════════════════════════════════

ANALYZE listings;
ANALYZE listing_media;
ANALYZE users;
ANALYZE reviews;
ANALYZE orders;
ANALYZE stores;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════

SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('listings', 'listing_media', 'users', 'stores', 'reviews', 'orders')
ORDER BY tablename, indexname;

-- ══════════════════════════════════════════════════════════════
-- DONE!
-- ══════════════════════════════════════════════════════════════
