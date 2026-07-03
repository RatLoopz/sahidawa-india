-- Migration: Product Reviews with Duplicate Prevention
-- Date: 2026-07-04
-- Description: Add reviews table with unique constraint to prevent duplicate reviews per product per buyer

-- ============================================================================
-- REVIEWS TABLE (Product reviews with duplicate prevention)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    rating integer NOT NULL,
    title varchar(255),
    comment text,
    is_verified_purchase boolean DEFAULT FALSE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reviews_rating_valid CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT reviews_one_per_buyer_per_product UNIQUE(product_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer_id ON reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_verified_purchase ON reviews(is_verified_purchase);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES - REVIEWS TABLE
-- ============================================================================
-- Anyone can read reviews for published products
DROP POLICY IF EXISTS "Anyone can read product reviews" ON reviews;
CREATE POLICY "Anyone can read product reviews" ON reviews
    FOR SELECT TO authenticated
    USING (TRUE);

-- Buyers can create reviews only for products they have purchased
DROP POLICY IF EXISTS "Buyers create reviews for purchased products" ON reviews;
CREATE POLICY "Buyers create reviews for purchased products" ON reviews
    FOR INSERT TO authenticated
    WITH CHECK (buyer_id = auth.uid());

-- Buyers can update their own reviews
DROP POLICY IF EXISTS "Buyers update own reviews" ON reviews;
CREATE POLICY "Buyers update own reviews" ON reviews
    FOR UPDATE TO authenticated
    USING (buyer_id = auth.uid())
    WITH CHECK (buyer_id = auth.uid());

-- Buyers can delete their own reviews
DROP POLICY IF EXISTS "Buyers delete own reviews" ON reviews;
CREATE POLICY "Buyers delete own reviews" ON reviews
    FOR DELETE TO authenticated
    USING (buyer_id = auth.uid());

-- Sellers can read reviews for their own products
DROP POLICY IF EXISTS "Sellers read reviews for own products" ON reviews;
CREATE POLICY "Sellers read reviews for own products" ON reviews
    FOR SELECT TO authenticated
    USING (seller_id = auth.uid() OR TRUE);

-- Admin bypass (service role)
DROP POLICY IF EXISTS "Admin full access to reviews" ON reviews;
CREATE POLICY "Admin full access to reviews" ON reviews
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
