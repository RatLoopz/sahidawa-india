import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import logger from "../utils/logger";

const router = Router();

interface Review {
    id: string;
    product_id: string;
    buyer_id: string;
    seller_id: string;
    rating: number;
    title: string | null;
    comment: string | null;
    is_verified_purchase: boolean;
    created_at: string;
    updated_at: string;
}

// Validation schema
const createReviewSchema = z.object({
    product_id: z.string().uuid("Invalid product ID"),
    rating: z.number().int().min(1).max(5),
    title: z.string().max(255).optional().nullable(),
    comment: z.string().max(5000).optional().nullable(),
});

const updateReviewSchema = z.object({
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().max(255).optional().nullable(),
    comment: z.string().max(5000).optional().nullable(),
});

/**
 * Verify that user has a completed order for the product before allowing review
 */
async function verifyPurchaseForReview(
    userId: string,
    productId: string
): Promise<{ hasPurchased: boolean; sellerId?: string }> {
    try {
        const { data: order, error } = await supabase
            .from("orders")
            .select("seller_id")
            .eq("buyer_id", userId)
            .eq("product_id", productId)
            .eq("status", "completed")
            .limit(1)
            .single();

        if (error && error.code === "PGRST116") {
            return { hasPurchased: false };
        }
        if (error) throw error;

        return { hasPurchased: !!order, sellerId: order?.seller_id };
    } catch (err) {
        logger.error("Error verifying purchase for review", { error: err, userId, productId });
        return { hasPurchased: false };
    }
}

/**
 * Check if user already has a review for this product (duplicate prevention)
 */
async function getUserReviewForProduct(userId: string, productId: string): Promise<Review | null> {
    try {
        const { data: review, error } = await supabase
            .from("reviews")
            .select("*")
            .eq("buyer_id", userId)
            .eq("product_id", productId)
            .limit(1)
            .single();

        if (error && error.code === "PGRST116") {
            return null;
        }
        if (error) throw error;

        return review;
    } catch (err) {
        logger.error("Error checking for existing review", { error: err, userId, productId });
        return null;
    }
}

// ============================================================================
// GET /api/products/:productId/reviews
// Fetch all reviews for a product
// ============================================================================
router.get("/products/:productId/reviews", async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const { skip = 0, limit = 20 } = req.query;

        const { data: reviews, error } = await supabase
            .from("reviews")
            .select("*")
            .eq("product_id", productId)
            .order("created_at", { ascending: false })
            .range(Number(skip), Number(skip) + Number(limit) - 1);

        if (error) {
            logger.error("Error fetching reviews", { error });
            throw error;
        }

        res.json({ reviews: reviews || [], total: reviews?.length || 0 });
    } catch (err) {
        logger.error("Error in GET /api/products/:productId/reviews", { error: err });
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

// ============================================================================
// GET /api/products/:productId/reviews/summary
// Fetch review summary for a product (average rating, count, etc.)
// ============================================================================
router.get("/products/:productId/reviews/summary", async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;

        const { data: reviews, error } = await supabase
            .from("reviews")
            .select("rating")
            .eq("product_id", productId);

        if (error) {
            logger.error("Error fetching review summary", { error });
            throw error;
        }

        const reviewList = reviews || [];
        const totalReviews = reviewList.length;
        const averageRating =
            totalReviews > 0
                ? (reviewList.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(2)
                : 0;

        const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviewList.forEach((r) => {
            ratingDistribution[r.rating as keyof typeof ratingDistribution]++;
        });

        res.json({
            productId,
            totalReviews,
            averageRating: parseFloat(averageRating as string),
            ratingDistribution,
        });
    } catch (err) {
        logger.error("Error in GET /api/products/:productId/reviews/summary", { error: err });
        res.status(500).json({ error: "Failed to fetch review summary" });
    }
});

// ============================================================================
// POST /api/reviews
// Create a review (prevents duplicate reviews per buyer per product)
// ============================================================================
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const validation = createReviewSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.issues });
        }

        const { product_id, rating, title, comment } = validation.data;

        // Verify user has purchased this product
        const { hasPurchased, sellerId } = await verifyPurchaseForReview(userId, product_id);
        if (!hasPurchased) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You can only review products you have purchased",
            });
        }

        // Check for duplicate review (unique constraint on product_id + buyer_id)
        const existingReview = await getUserReviewForProduct(userId, product_id);
        if (existingReview) {
            return res.status(409).json({
                error: "Conflict",
                message: "You have already reviewed this product. Use PATCH to update your review.",
                existingReviewId: existingReview.id,
            });
        }

        const { data: review, error } = await supabase
            .from("reviews")
            .insert([
                {
                    product_id,
                    buyer_id: userId,
                    seller_id: sellerId,
                    rating,
                    title: title || null,
                    comment: comment || null,
                    is_verified_purchase: true,
                },
            ])
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                // Unique constraint violation
                return res.status(409).json({
                    error: "Conflict",
                    message: "You have already reviewed this product",
                });
            }
            logger.error("Error creating review", { error });
            throw error;
        }

        res.status(201).json(review);
    } catch (err) {
        logger.error("Error in POST /api/reviews", { error: err });
        res.status(500).json({ error: "Failed to create review" });
    }
});

// ============================================================================
// GET /api/reviews/:reviewId
// Fetch a single review
// ============================================================================
router.get("/:reviewId", async (req: Request, res: Response) => {
    try {
        const { reviewId } = req.params;

        const { data: review, error } = await supabase
            .from("reviews")
            .select("*")
            .eq("id", reviewId)
            .single();

        if (error || !review) {
            return res.status(404).json({ error: "Review not found" });
        }

        res.json(review);
    } catch (err) {
        logger.error("Error fetching review", { error: err });
        res.status(500).json({ error: "Failed to fetch review" });
    }
});

// ============================================================================
// PATCH /api/reviews/:reviewId
// Update a review (only author can update)
// ============================================================================
router.patch("/:reviewId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const validation = updateReviewSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.issues });
        }

        // Verify ownership
        const { data: review, error: fetchError } = await supabase
            .from("reviews")
            .select("buyer_id")
            .eq("id", reviewId)
            .single();

        if (fetchError || !review) {
            return res.status(404).json({ error: "Review not found" });
        }

        if (review.buyer_id !== userId) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You can only edit your own reviews",
            });
        }

        const updateData = validation.data;

        const { data: updatedReview, error } = await supabase
            .from("reviews")
            .update(updateData)
            .eq("id", reviewId)
            .select()
            .single();

        if (error) {
            logger.error("Error updating review", { error });
            throw error;
        }

        res.json(updatedReview);
    } catch (err) {
        logger.error("Error in PATCH /api/reviews/:reviewId", { error: err });
        res.status(500).json({ error: "Failed to update review" });
    }
});

// ============================================================================
// DELETE /api/reviews/:reviewId
// Delete a review (only author can delete)
// ============================================================================
router.delete("/:reviewId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Verify ownership
        const { data: review, error: fetchError } = await supabase
            .from("reviews")
            .select("buyer_id")
            .eq("id", reviewId)
            .single();

        if (fetchError || !review) {
            return res.status(404).json({ error: "Review not found" });
        }

        if (review.buyer_id !== userId) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You can only delete your own reviews",
            });
        }

        const { error } = await supabase.from("reviews").delete().eq("id", reviewId);

        if (error) {
            logger.error("Error deleting review", { error });
            throw error;
        }

        res.json({ success: true, message: "Review deleted" });
    } catch (err) {
        logger.error("Error in DELETE /api/reviews/:reviewId", { error: err });
        res.status(500).json({ error: "Failed to delete review" });
    }
});

// ============================================================================
// GET /api/reviews/my-reviews
// Get reviews authored by authenticated user
// ============================================================================
router.get("/my/reviews", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { skip = 0, limit = 20 } = req.query;

        const { data: reviews, error } = await supabase
            .from("reviews")
            .select("*")
            .eq("buyer_id", userId)
            .order("created_at", { ascending: false })
            .range(Number(skip), Number(skip) + Number(limit) - 1);

        if (error) {
            logger.error("Error fetching user reviews", { error });
            throw error;
        }

        res.json({ reviews: reviews || [], total: reviews?.length || 0 });
    } catch (err) {
        logger.error("Error in GET /api/reviews/my/reviews", { error: err });
        res.status(500).json({ error: "Failed to fetch your reviews" });
    }
});

export default router;
