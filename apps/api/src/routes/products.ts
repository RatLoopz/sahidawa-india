import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import logger from "../utils/logger";

const router = Router();

interface ProductListing {
    id: string;
    seller_id: string;
    title: string;
    description: string;
    price: number;
    thumbnail_url: string | null;
    full_image_url: string | null;
    blur_hash: string | null;
    category: string | null;
    stock: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface ProductResponse extends ProductListing {
    full_image_url: string | null;
}

// Schemas for validation
const createProductSchema = z.object({
    title: z.string().min(3).max(255),
    description: z.string().min(10),
    price: z.number().positive(),
    thumbnail_url: z.string().url().nullable(),
    full_image_url: z.string().url().nullable(),
    blur_hash: z.string().max(255).nullable(),
    category: z.string().max(100).nullable(),
    stock: z.number().int().nonnegative(),
});

const updateProductSchema = createProductSchema.partial();

/**
 * Helper function to verify if a user has a completed order for a product
 */
async function userHasCompletedOrder(userId: string, productId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from("orders")
            .select("id")
            .eq("buyer_id", userId)
            .eq("product_id", productId)
            .eq("status", "completed")
            .limit(1)
            .single();

        if (error && error.code === "PGRST116") {
            // No matching order found
            return false;
        }
        if (error) throw error;
        return !!data;
    } catch (err) {
        logger.error("Error checking purchase status", { error: err, userId, productId });
        return false;
    }
}

/**
 * Serialize product response: only include full_image_url if user has purchased
 */
async function serializeProductForUser(
    product: ProductListing,
    userId: string | null
): Promise<ProductResponse> {
    const serialized: ProductResponse = {
        ...product,
        full_image_url: null,
    };

    if (userId) {
        const hasPurchased = await userHasCompletedOrder(userId, product.id);
        if (hasPurchased) {
            serialized.full_image_url = product.full_image_url;
        }
    }

    return serialized;
}

/**
 * Verify that authenticated user is the product owner
 */
async function verifyProductOwnership(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const { productId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const { data: product, error } = await supabase
            .from("products")
            .select("id, seller_id")
            .eq("id", productId)
            .single();

        if (error || !product) {
            return res.status(404).json({ error: "Product not found" });
        }

        if (product.seller_id !== userId) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not own this product",
            });
        }

        (req as any).product = product;
        next();
    } catch (err) {
        logger.error("Error verifying product ownership", { error: err });
        res.status(500).json({ error: "Internal server error" });
    }
}

// ============================================================================
// GET /api/products
// Fetch all active products with purchase-verified image URLs
// ============================================================================
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { category, skip = 0, limit = 20 } = req.query;
        const userId = req.user?.id || null;

        let query = supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .range(Number(skip), Number(skip) + Number(limit) - 1);

        if (category) {
            query = query.eq("category", category);
        }

        const { data: products, error } = await query;

        if (error) {
            logger.error("Error fetching products", { error });
            throw error;
        }

        // Serialize each product: remove full_image_url unless user has purchased
        const serialized = await Promise.all(
            (products || []).map((p) => serializeProductForUser(p, userId))
        );

        res.json({ products: serialized, total: serialized.length });
    } catch (err) {
        logger.error("Error in GET /api/products", { error: err });
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// ============================================================================
// GET /api/products/:productId
// Fetch a single product with purchase-verified image URL
// ============================================================================
router.get("/:productId", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { productId } = req.params;
        const userId = req.user?.id || null;

        const { data: product, error } = await supabase
            .from("products")
            .select("*")
            .eq("id", productId)
            .eq("is_active", true)
            .single();

        if (error || !product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Serialize product: only include full_image_url if user has purchased
        const serialized = await serializeProductForUser(product, userId);

        res.json(serialized);
    } catch (err) {
        logger.error("Error fetching product", { error: err });
        res.status(500).json({ error: "Failed to fetch product" });
    }
});

// ============================================================================
// POST /api/products
// Create a new product (authenticated sellers only)
// ============================================================================
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const validation = createProductSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.issues });
        }

        const {
            title,
            description,
            price,
            thumbnail_url,
            full_image_url,
            blur_hash,
            category,
            stock,
        } = validation.data;

        const { data: product, error } = await supabase
            .from("products")
            .insert([
                {
                    seller_id: userId,
                    title,
                    description,
                    price,
                    thumbnail_url,
                    full_image_url,
                    blur_hash,
                    category,
                    stock,
                },
            ])
            .select()
            .single();

        if (error) {
            logger.error("Error creating product", { error });
            throw error;
        }

        // Return product without full_image_url (creator sees both in dashboard)
        res.status(201).json(product);
    } catch (err) {
        logger.error("Error in POST /api/products", { error: err });
        res.status(500).json({ error: "Failed to create product" });
    }
});

// ============================================================================
// PATCH /api/products/:productId
// Update product (sellers only, ownership verified)
// ============================================================================
router.patch(
    "/:productId",
    requireAuth,
    verifyProductOwnership,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { productId } = req.params;

            const validation = updateProductSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({ errors: validation.error.issues });
            }

            const updateData = validation.data;

            const { data: product, error } = await supabase
                .from("products")
                .update(updateData)
                .eq("id", productId)
                .select()
                .single();

            if (error) {
                logger.error("Error updating product", { error });
                throw error;
            }

            res.json(product);
        } catch (err) {
            logger.error("Error in PATCH /api/products/:productId", { error: err });
            res.status(500).json({ error: "Failed to update product" });
        }
    }
);

// ============================================================================
// DELETE /api/products/:productId
// Delete product (sellers only, ownership verified)
// ============================================================================
router.delete(
    "/:productId",
    requireAuth,
    verifyProductOwnership,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { productId } = req.params;

            const { error } = await supabase.from("products").delete().eq("id", productId);

            if (error) {
                logger.error("Error deleting product", { error });
                throw error;
            }

            res.json({ success: true, message: "Product deleted" });
        } catch (err) {
            logger.error("Error in DELETE /api/products/:productId", { error: err });
            res.status(500).json({ error: "Failed to delete product" });
        }
    }
);

export default router;
