import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { limiter } from "../middleware/rateLimit";
import { uuidSchema } from "../utils/validation";

const router = Router();

const MAX_WISHLIST_BATCH_PRODUCT_IDS = 100;

const wishlistItemSchema = z.object({
    product_id: uuidSchema,
});

const wishlistBatchProductIdsSchema = z
    .array(uuidSchema)
    .nonempty("At least one product ID required")
    .max(MAX_WISHLIST_BATCH_PRODUCT_IDS, "Maximum 100 product IDs allowed");

const guestWishlistSchema = z.object({
    product_ids: wishlistBatchProductIdsSchema,
});

interface WishlistItem {
    id: string;
    user_id: string;
    product_id: string;
    created_at: string;
}

class WishlistMergeUnavailableError extends Error {
    constructor() {
        super("Wishlist sync is temporarily unavailable. Please try again.");
        this.name = "WishlistMergeUnavailableError";
    }
}

export async function mergeGuestWishlist(
    userId: string,
    guestProductIds: string[]
): Promise<string[]> {
    if (!guestProductIds || guestProductIds.length === 0) {
        return [];
    }

    try {
        const { data: existingWishlist, error: fetchError } = await supabase
            .from("wishlists")
            .select("product_id")
            .eq("user_id", userId);

        if (fetchError) {
            logger.error("Failed to fetch existing wishlist", { error: fetchError });
            throw new WishlistMergeUnavailableError();
        }

        const existingProductIds = new Set(
            (existingWishlist || []).map(
                (item: Pick<WishlistItem, "product_id">) => item.product_id
            )
        );
        const newProductIds = guestProductIds.filter((id) => !existingProductIds.has(id));
        if (newProductIds.length === 0) {
            return [];
        }
        const { data: existingMedicines, error: medicineLookupError } = await supabase
            .from("medicines")
            .select("id")
            .in("id", newProductIds);

        if (medicineLookupError) {
            logger.error("Failed to validate guest wishlist medicines", {
                error: medicineLookupError,
            });
            throw new WishlistMergeUnavailableError();
        }

        const verifiedProductIds = new Set(
            (existingMedicines || []).map((m: { id: string }) => m.id)
        );
        const filteredProductIds = newProductIds.filter((id) => verifiedProductIds.has(id));

        if (filteredProductIds.length === 0) {
            return [];
        }

        const insertData = filteredProductIds.map((product_id) => ({
            user_id: userId,
            product_id,
        }));

        const { data: inserted, error: insertError } = await supabase
            .from("wishlists")
            .insert(insertData)
            .select("product_id");

        if (insertError) {
            logger.error("Failed to merge guest wishlist", { error: insertError });
            throw new WishlistMergeUnavailableError();
        }

        return (inserted || []).map((item: Pick<WishlistItem, "product_id">) => item.product_id);
    } catch (err) {
        if (err instanceof WishlistMergeUnavailableError) throw err;
        logger.error("Unexpected error merging guest wishlist", { error: err });
        throw new WishlistMergeUnavailableError();
    }
}

/**
 * POST /api/wishlist
 * Add a product to the authenticated user's wishlist.
 * Returns 409 if the item is already wishlisted.
 */
router.post(
    "/",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const parsed = wishlistItemSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid request",
                details: parsed.error.issues,
            });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        try {
            const { product_id } = parsed.data;

            const { data: existing, error: checkError } = await supabase
                .from("wishlists")
                .select("id")
                .eq("user_id", req.user.id)
                .eq("product_id", product_id)
                .maybeSingle();

            if (checkError) {
                next(checkError);
                return;
            }

            if (existing) {
                res.status(409).json({ error: "Product already in wishlist" });
                return;
            }

            const { data: wishlistItem, error: insertError } = await supabase
                .from("wishlists")
                .insert({
                    user_id: req.user.id,
                    product_id,
                })
                .select()
                .single();

            if (insertError) {
                next(insertError);
                return;
            }

            res.status(201).json({ success: true, item: wishlistItem });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * DELETE /api/wishlist/:productId
 * Remove a product from the authenticated user's wishlist.
 */
router.delete(
    "/:productId",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const parsedProductId = uuidSchema.safeParse(req.params.productId);
        if (!parsedProductId.success) {
            res.status(400).json({ error: "Invalid UUID format" });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        try {
            const { productId } = req.params;

            const { error: deleteError } = await supabase
                .from("wishlists")
                .delete()
                .eq("user_id", req.user.id)
                .eq("product_id", productId);

            if (deleteError) {
                next(deleteError);
                return;
            }

            res.json({ success: true, message: "Removed from wishlist" });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/wishlist
 * Fetch all products in the authenticated user's wishlist.
 */
router.get(
    "/",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        try {
            const { data: wishlistItems, error: fetchError } = await supabase
                .from("wishlists")
                .select("id, product_id, created_at")
                .eq("user_id", req.user.id)
                .order("created_at", { ascending: false });

            if (fetchError) {
                next(fetchError);
                return;
            }

            res.json({
                success: true,
                count: (wishlistItems || []).length,
                items: wishlistItems || [],
            });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * POST /api/wishlist/merge-guest
 * Merge guest wishlist (localStorage) into authenticated user's wishlist.
 * Called on login to integrate guest items without duplicates.
 */
router.post(
    "/merge-guest",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const parsed = guestWishlistSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid request",
                details: parsed.error.issues,
            });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        try {
            const { product_ids } = parsed.data;
            const mergedIds = await mergeGuestWishlist(req.user.id, product_ids);

            res.json({
                success: true,
                merged_count: mergedIds.length,
                merged_items: mergedIds,
            });
        } catch (err) {
            if (err instanceof WishlistMergeUnavailableError) {
                res.status(503).json({
                    success: false,
                    error: err.message,
                    code: "WISHLIST_MERGE_UNAVAILABLE",
                });
                return;
            }
            next(err);
        }
    }
);

/**
 * POST /api/wishlist/check
 * Check if products are in the user's wishlist.
 * Used to display heart icon state on product cards.
 */
router.post(
    "/check",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const parsed = z.object({ product_ids: wishlistBatchProductIdsSchema }).safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid request",
                details: parsed.error.issues,
            });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        try {
            const { product_ids } = parsed.data;

            const { data: wishlistItems, error: fetchError } = await supabase
                .from("wishlists")
                .select("product_id")
                .eq("user_id", req.user.id)
                .in("product_id", product_ids);

            if (fetchError) {
                next(fetchError);
                return;
            }

            const wishlistedIds = new Set(
                (wishlistItems || []).map(
                    (item: Pick<WishlistItem, "product_id">) => item.product_id
                )
            );
            const wishlistStatus = product_ids.reduce(
                (acc: Record<string, boolean>, id: string) => {
                    acc[id] = wishlistedIds.has(id);
                    return acc;
                },
                {}
            );

            res.json({ success: true, wishlists: wishlistStatus });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
