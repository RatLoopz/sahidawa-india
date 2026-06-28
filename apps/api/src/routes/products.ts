/**
 * Products API Routes
 * Implements marketplace product management with ownership authorization
 * Fixes issue #2737: Missing ownership check on product update/delete endpoints
 */

import express, { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { validateProductUpdate, validateProductCreate } from '../validators/products';

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side, has full access
);

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Verify that the authenticated user is the product owner before allowing modifications.
 * This implements the critical security check for issue #2737.
 */
async function verifyProductOwnership(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { productId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Fetch the product to check ownership
        const { data: product, error } = await supabase
            .from('products')
            .select('id, seller_id')
            .eq('id', productId)
            .single();

        if (error || !product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Verify ownership: seller_id must match authenticated user
        if (product.seller_id !== userId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'You do not own this product and cannot modify it'
            });
        }

        // Attach product to request for use in handlers
        (req as any).product = product;
        next();
    } catch (err) {
        console.error('Error verifying product ownership:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/products
 * Fetch all active products (public endpoint)
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { category, skip = 0, limit = 20 } = req.query;

        let query = supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .range(Number(skip), Number(skip) + Number(limit) - 1);

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json({ products: data || [], total: data?.length || 0 });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

/**
 * GET /api/products/:productId
 * Fetch a single product (public if active)
 */
router.get('/:productId', async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;

        const { data: product, error } = await supabase
            .from('products')
            .select('*, sellers(shop_name, rating, is_verified)')
            .eq('id', productId)
            .single();

        if (error || !product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Only serve active products to public users
        if (!product.is_active && req.user?.id !== product.seller_id) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ product });
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

/**
 * POST /api/products
 * Create a new product (seller only)
 */
router.post(
    '/',
    requireAuth,
    validateProductCreate,
    async (req: Request, res: Response) => {
        try {
            const { title, description, price, category, stock, image_url, blur_hash } = req.body;
            const seller_id = req.user!.id;

            const { data: product, error } = await supabase
                .from('products')
                .insert([
                    {
                        id: uuidv4(),
                        seller_id,
                        title,
                        description,
                        price,
                        category,
                        stock,
                        image_url,
                        blur_hash,
                        is_active: true
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({ product });
        } catch (err) {
            console.error('Error creating product:', err);
            res.status(500).json({ error: 'Failed to create product' });
        }
    }
);

/**
 * PATCH /api/products/:productId
 * Update a product (seller only, with ownership check)
 * CRITICAL FIX FOR ISSUE #2737: Verifies seller owns the product before allowing updates
 */
router.patch(
    '/:productId',
    requireAuth,
    verifyProductOwnership,
    validateProductUpdate,
    async (req: Request, res: Response) => {
        try {
            const { productId } = req.params;
            const updates = req.body;

            // Prevent changing seller_id (ownership cannot be transferred via API)
            if ('seller_id' in updates) {
                delete updates.seller_id;
            }

            const { data: product, error } = await supabase
                .from('products')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId)
                .select()
                .single();

            if (error) throw error;

            res.json({
                message: 'Product updated successfully',
                product
            });
        } catch (err) {
            console.error('Error updating product:', err);
            res.status(500).json({ error: 'Failed to update product' });
        }
    }
);

/**
 * DELETE /api/products/:productId
 * Delete a product (seller only, with ownership check)
 * CRITICAL FIX FOR ISSUE #2737: Verifies seller owns the product before allowing deletion
 */
router.delete(
    '/:productId',
    requireAuth,
    verifyProductOwnership,
    async (req: Request, res: Response) => {
        try {
            const { productId } = req.params;

            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

            if (error) throw error;

            res.json({ message: 'Product deleted successfully' });
        } catch (err) {
            console.error('Error deleting product:', err);
            res.status(500).json({ error: 'Failed to delete product' });
        }
    }
);

/**
 * GET /api/seller/products
 * Fetch all products for the authenticated seller (including inactive)
 */
router.get(
    '/seller/all',
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const seller_id = req.user!.id;
            const { skip = 0, limit = 50 } = req.query;

            const { data: products, error } = await supabase
                .from('products')
                .select('*')
                .eq('seller_id', seller_id)
                .order('created_at', { ascending: false })
                .range(Number(skip), Number(skip) + Number(limit) - 1);

            if (error) throw error;

            res.json({ products: products || [], total: products?.length || 0 });
        } catch (err) {
            console.error('Error fetching seller products:', err);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    }
);

export default router;
