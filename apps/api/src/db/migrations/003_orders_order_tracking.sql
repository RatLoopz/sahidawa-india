-- Migration: Orders & Order Tracking Tables
-- Date: 2026-06-28
-- Description: Add orders table with status tracking for marketplace order management

-- ============================================================================
-- 1. ORDERS TABLE (Main orders)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_display_id VARCHAR(50) UNIQUE NOT NULL DEFAULT 'ORD-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
    total_amount NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'placed'
        CHECK (status IN ('placed', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    tracking_number VARCHAR(100),
    courier_name VARCHAR(100),
    status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT orders_amount_positive CHECK (total_amount > 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ============================================================================
-- 2. ORDER ITEMS TABLE (Individual items in an order)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_price_positive CHECK (unit_price > 0),
    CONSTRAINT order_items_total_positive CHECK (total_price > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- ============================================================================
-- 3. ORDER STATUS HISTORY TABLE (Audit trail for order status changes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL
        CHECK (new_status IN ('placed', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_status_transition CHECK (
        (old_status IS NULL) OR (old_status != new_status)
    )
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at DESC);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES FOR ORDERS
-- ============================================================================

-- Buyers: Can view their own orders
DROP POLICY IF EXISTS "Buyers view own orders" ON orders;
CREATE POLICY "Buyers view own orders" ON orders
    FOR SELECT TO authenticated
    USING (buyer_id = auth.uid());

-- Sellers: Can view orders they received
DROP POLICY IF EXISTS "Sellers view own orders" ON orders;
CREATE POLICY "Sellers view own orders" ON orders
    FOR SELECT TO authenticated
    USING (seller_id = auth.uid());

-- Sellers: Can update their own orders (status, tracking)
DROP POLICY IF EXISTS "Sellers update own orders" ON orders;
CREATE POLICY "Sellers update own orders" ON orders
    FOR UPDATE TO authenticated
    USING (seller_id = auth.uid())
    WITH CHECK (seller_id = auth.uid());

-- Admin bypass
DROP POLICY IF EXISTS "Admin full access to orders" ON orders;
CREATE POLICY "Admin full access to orders" ON orders
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- 6. ROW LEVEL SECURITY POLICIES FOR ORDER ITEMS
-- ============================================================================

-- Buyers: Can view items in their orders
DROP POLICY IF EXISTS "Buyers view order items" ON order_items;
CREATE POLICY "Buyers view order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders WHERE buyer_id = auth.uid()
        )
    );

-- Sellers: Can view items in their orders
DROP POLICY IF EXISTS "Sellers view order items" ON order_items;
CREATE POLICY "Sellers view order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders WHERE seller_id = auth.uid()
        )
    );

-- Admin bypass
DROP POLICY IF EXISTS "Admin full access to order items" ON order_items;
CREATE POLICY "Admin full access to order items" ON order_items
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- 7. ROW LEVEL SECURITY POLICIES FOR ORDER STATUS HISTORY
-- ============================================================================

-- Everyone: Can view status history for orders they're involved in
DROP POLICY IF EXISTS "Users view order status history" ON order_status_history;
CREATE POLICY "Users view order status history" ON order_status_history
    FOR SELECT TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders
            WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
        )
    );

-- Admin bypass
DROP POLICY IF EXISTS "Admin full access to order status history" ON order_status_history;
CREATE POLICY "Admin full access to order status history" ON order_status_history
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- 8. TIMESTAMPS AUTO-UPDATE TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_orders_timestamp ON orders;
CREATE TRIGGER update_orders_timestamp BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_order_items_timestamp ON order_items;
CREATE TRIGGER update_order_items_timestamp BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 9. FORWARD-ONLY STATUS TRANSITIONS (prevent backward transitions)
-- ============================================================================
DROP FUNCTION IF EXISTS validate_order_status_transition();
CREATE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Define allowed transitions
    -- placed → confirmed, cancelled
    -- confirmed → shipped, cancelled
    -- shipped → delivered, cancelled
    -- delivered → (no transitions)
    -- cancelled → (no transitions)

    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    -- Check if transition is allowed
    CASE
        WHEN OLD.status = 'placed' THEN
            IF NEW.status NOT IN ('confirmed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
            END IF;
        WHEN OLD.status = 'confirmed' THEN
            IF NEW.status NOT IN ('shipped', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
            END IF;
        WHEN OLD.status = 'shipped' THEN
            IF NEW.status NOT IN ('delivered', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
            END IF;
        WHEN OLD.status IN ('delivered', 'cancelled') THEN
            RAISE EXCEPTION 'Cannot transition from final status %', OLD.status;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_order_status_transition ON orders;
CREATE TRIGGER check_order_status_transition BEFORE UPDATE ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_order_status_transition();

-- ============================================================================
-- 10. AUTO-LOG STATUS CHANGES (to order_status_history)
-- ============================================================================
DROP FUNCTION IF EXISTS log_order_status_change();
CREATE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (
            order_id,
            old_status,
            new_status,
            changed_by,
            changed_at
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            auth.uid(),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_status_change ON orders;
CREATE TRIGGER log_status_change AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change();

-- ============================================================================
-- 11. VERIFICATION QUERIES
-- ============================================================================
-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('orders', 'order_items', 'order_status_history');
--
-- Verify status transition function:
-- SELECT * FROM pg_proc WHERE proname = 'validate_order_status_transition';
--
-- Verify status logging trigger:
-- SELECT * FROM pg_trigger WHERE tgname = 'log_status_change';
