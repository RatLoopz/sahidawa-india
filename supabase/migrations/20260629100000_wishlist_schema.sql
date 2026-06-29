-- Create wishlists table for authenticated user product wishlists
CREATE TABLE IF NOT EXISTS wishlists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_user_product UNIQUE(user_id, product_id)
);

-- Create index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);

-- Create index for efficient product lookups
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON wishlists(product_id);

-- Enable RLS
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own wishlist
CREATE POLICY "Users view own wishlist"
ON wishlists FOR SELECT
USING (user_id = auth.uid());

-- RLS Policy: Users can only insert their own wishlist items
CREATE POLICY "Users insert own wishlist items"
ON wishlists FOR INSERT
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can only delete their own wishlist items
CREATE POLICY "Users delete own wishlist items"
ON wishlists FOR DELETE
USING (user_id = auth.uid());
