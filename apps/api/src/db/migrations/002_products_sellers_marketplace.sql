-- Migration: Products & Sellers Marketplace Tables
-- Date: 2026-06-28
-- Description: Add products table with seller ownership and authorization

-- ============================================================================
-- 1. SELLERS PROFILE TABLE (Extends auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sellers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    rating NUMERIC(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. PRODUCTS TABLE (Marketplace Products)
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    image_url TEXT,
    blur_hash VARCHAR(255), -- For lazy loading placeholders
    category VARCHAR(100),
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT products_price_positive CHECK (price > 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Sellers: Can read own profile
DROP POLICY IF EXISTS "Sellers read own profile" ON sellers;
CREATE POLICY "Sellers read own profile" ON sellers
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- Sellers: Can update own profile
DROP POLICY IF EXISTS "Sellers update own profile" ON sellers;
CREATE POLICY "Sellers update own profile" ON sellers
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Products: Authenticated users can read active products
DROP POLICY IF EXISTS "Anyone can view published products" ON products;
CREATE POLICY "Anyone can view published products" ON products
    FOR SELECT TO authenticated
    USING (is_active = TRUE);

-- Products: Sellers can read their own products (published or not)
DROP POLICY IF EXISTS "Sellers read own products" ON products;
CREATE POLICY "Sellers read own products" ON products
    FOR SELECT TO authenticated
    USING (seller_id = auth.uid());

-- Products: Sellers can only insert their own products
DROP POLICY IF EXISTS "Sellers insert own products" ON products;
CREATE POLICY "Sellers insert own products" ON products
    FOR INSERT TO authenticated
    WITH CHECK (seller_id = auth.uid());

-- Products: Sellers can only update their own products [CRITICAL FIX FOR ISSUE #2737]
DROP POLICY IF EXISTS "Sellers update own products" ON products;
CREATE POLICY "Sellers update own products" ON products
    FOR UPDATE TO authenticated
    USING (seller_id = auth.uid())
    WITH CHECK (seller_id = auth.uid());

-- Products: Sellers can only delete their own products [CRITICAL FIX FOR ISSUE #2737]
DROP POLICY IF EXISTS "Sellers delete own products" ON products;
CREATE POLICY "Sellers delete own products" ON products
    FOR DELETE TO authenticated
    USING (seller_id = auth.uid());

-- Admin bypass: Service role has full access
DROP POLICY IF EXISTS "Admin full access to products" ON products;
CREATE POLICY "Admin full access to products" ON products
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- 5. TIMESTAMPS AUTO-UPDATE TRIGGER
-- ============================================================================
DROP TRIGGER IF EXISTS update_sellers_timestamp ON sellers;
CREATE TRIGGER update_sellers_timestamp BEFORE UPDATE ON sellers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_products_timestamp ON products;
CREATE TRIGGER update_products_timestamp BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 6. VERIFICATION QUERIES
-- ============================================================================
-- Check that policies are in place:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'products' ORDER BY policyname;
--
-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('products', 'sellers');
