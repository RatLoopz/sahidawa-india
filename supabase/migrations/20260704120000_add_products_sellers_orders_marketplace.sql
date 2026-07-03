-- Migration: Products, Sellers, and Orders Marketplace
-- Date: 2026-07-04
-- Description: Add marketplace infrastructure with purchase-verified image URL access

-- ============================================================================
-- 1. SELLERS TABLE (Extends auth.users for seller profiles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sellers (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_name varchar(255) NOT NULL,
    description text,
    is_verified boolean DEFAULT FALSE,
    rating numeric(3, 2) DEFAULT 0,
    total_reviews integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- 2. PRODUCTS TABLE (Marketplace products with image separation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    description text,
    price numeric(12, 2) NOT NULL,
    thumbnail_url text, -- Public thumbnail accessible to all authenticated users
    full_image_url text, -- Full-resolution CDN URL (medical documentation, etc.)
    blur_hash varchar(255), -- For lazy loading placeholders
    category varchar(100),
    stock integer DEFAULT 0,
    is_active boolean DEFAULT TRUE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT products_price_positive CHECK (price > 0)
);

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ============================================================================
-- 3. ORDERS TABLE (Track purchases for image access verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 1,
    price_per_unit numeric(12, 2) NOT NULL,
    total_price numeric(12, 2) NOT NULL,
    status varchar(50) NOT NULL DEFAULT 'pending', -- pending, completed, cancelled
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT orders_quantity_positive CHECK (quantity > 0),
    CONSTRAINT orders_price_positive CHECK (price_per_unit > 0 AND total_price > 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
-- Composite index for fast purchase verification queries
CREATE INDEX IF NOT EXISTS idx_orders_buyer_product ON orders(buyer_id, product_id, status);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES - SELLERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Sellers read own profile" ON sellers;
CREATE POLICY "Sellers read own profile" ON sellers
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Sellers update own profile" ON sellers;
CREATE POLICY "Sellers update own profile" ON sellers
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public sellers anon read" ON sellers;
CREATE POLICY "Public sellers anon read" ON sellers
    FOR SELECT TO anon
    USING (is_verified = TRUE);

-- ============================================================================
-- 6. ROW LEVEL SECURITY POLICIES - PRODUCTS TABLE
-- ============================================================================
-- All authenticated users can view active products
DROP POLICY IF EXISTS "Anyone can view published products" ON products;
CREATE POLICY "Anyone can view published products" ON products
    FOR SELECT TO authenticated
    USING (is_active = TRUE);

-- Sellers can view their own products (published or not)
DROP POLICY IF EXISTS "Sellers read own products" ON products;
CREATE POLICY "Sellers read own products" ON products
    FOR SELECT TO authenticated
    USING (seller_id = auth.uid());

-- Sellers can insert only their own products
DROP POLICY IF EXISTS "Sellers insert own products" ON products;
CREATE POLICY "Sellers insert own products" ON products
    FOR INSERT TO authenticated
    WITH CHECK (seller_id = auth.uid());

-- Sellers can only update their own products
DROP POLICY IF EXISTS "Sellers update own products" ON products;
CREATE POLICY "Sellers update own products" ON products
    FOR UPDATE TO authenticated
    USING (seller_id = auth.uid())
    WITH CHECK (seller_id = auth.uid());

-- Sellers can only delete their own products
DROP POLICY IF EXISTS "Sellers delete own products" ON products;
CREATE POLICY "Sellers delete own products" ON products
    FOR DELETE TO authenticated
    USING (seller_id = auth.uid());

-- ============================================================================
-- 7. ROW LEVEL SECURITY POLICIES - ORDERS TABLE
-- ============================================================================
-- Buyers can view their own orders
DROP POLICY IF EXISTS "Buyers read own orders" ON orders;
CREATE POLICY "Buyers read own orders" ON orders
    FOR SELECT TO authenticated
    USING (buyer_id = auth.uid());

-- Sellers can view orders for their products
DROP POLICY IF EXISTS "Sellers read own product orders" ON orders;
CREATE POLICY "Sellers read own product orders" ON orders
    FOR SELECT TO authenticated
    USING (seller_id = auth.uid());

-- Buyers can insert orders
DROP POLICY IF EXISTS "Buyers create orders" ON orders;
CREATE POLICY "Buyers create orders" ON orders
    FOR INSERT TO authenticated
    WITH CHECK (buyer_id = auth.uid());

-- ============================================================================
-- 8. ADMIN BYPASS (Service role)
-- ============================================================================
DROP POLICY IF EXISTS "Admin full access to sellers" ON sellers;
CREATE POLICY "Admin full access to sellers" ON sellers
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Admin full access to products" ON products;
CREATE POLICY "Admin full access to products" ON products
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Admin full access to orders" ON orders;
CREATE POLICY "Admin full access to orders" ON orders
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
