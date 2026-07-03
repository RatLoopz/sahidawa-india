import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { checkTokenRevocation } from "../middleware/tokenRevocationCheck";
import { revokeAllUserTokens } from "../utils/tokenRevocation";
import logger from "../utils/logger";

const router = Router();

interface SellerProfile {
    id: string;
    shop_name: string;
    description: string | null;
    is_verified: boolean;
    rating: number;
    total_reviews: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// Validation schemas
const updateSellerProfileSchema = z.object({
    shop_name: z.string().min(2).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
});

// ============================================================================
// GET /api/sellers/:sellerId
// Get seller profile (public endpoint)
// ============================================================================
router.get("/:sellerId", async (req: Request, res: Response) => {
    try {
        const { sellerId } = req.params;

        const { data: seller, error } = await supabase
            .from("sellers")
            .select("*")
            .eq("id", sellerId)
            .eq("is_active", true)
            .single();

        if (error || !seller) {
            return res.status(404).json({ error: "Seller not found" });
        }

        res.json(seller);
    } catch (err) {
        logger.error("Error fetching seller profile", { error: err });
        res.status(500).json({ error: "Failed to fetch seller profile" });
    }
});

// ============================================================================
// GET /api/sellers/me/profile
// Get authenticated user's seller profile
// ============================================================================
router.get(
    "/me/profile",
    requireAuth,
    checkTokenRevocation,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { data: seller, error } = await supabase
                .from("sellers")
                .select("*")
                .eq("id", userId)
                .single();

            if (error || !seller) {
                return res.status(404).json({ error: "Seller profile not found" });
            }

            res.json(seller);
        } catch (err) {
            logger.error("Error fetching user seller profile", { error: err });
            res.status(500).json({ error: "Failed to fetch profile" });
        }
    }
);

// ============================================================================
// PATCH /api/sellers/me/profile
// Update authenticated user's seller profile
// ============================================================================
router.patch(
    "/me/profile",
    requireAuth,
    checkTokenRevocation,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const validation = updateSellerProfileSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({ errors: validation.error.issues });
            }

            const updateData = validation.data;

            const { data: seller, error } = await supabase
                .from("sellers")
                .update(updateData)
                .eq("id", userId)
                .select()
                .single();

            if (error) {
                logger.error("Error updating seller profile", { error });
                throw error;
            }

            res.json(seller);
        } catch (err) {
            logger.error("Error in PATCH /api/sellers/me/profile", { error: err });
            res.status(500).json({ error: "Failed to update profile" });
        }
    }
);

// ============================================================================
// POST /api/sellers/me/deactivate
// Deactivate seller account and revoke all JWT sessions
// ============================================================================
router.post(
    "/me/deactivate",
    requireAuth,
    checkTokenRevocation,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Deactivate seller account
            const { data: seller, error: updateError } = await supabase
                .from("sellers")
                .update({ is_active: false })
                .eq("id", userId)
                .select()
                .single();

            if (updateError) {
                logger.error("Error deactivating seller account", { error: updateError, userId });
                throw updateError;
            }

            // Revoke all tokens for this user
            const tokenRevoked = await revokeAllUserTokens(userId, "account_deactivation");

            if (!tokenRevoked) {
                logger.warn("Failed to revoke all tokens during deactivation", { userId });
            }

            res.json({
                success: true,
                message:
                    "Your seller account has been deactivated. All active sessions have been invalidated.",
                seller,
            });
        } catch (err) {
            logger.error("Error in POST /api/sellers/me/deactivate", { error: err });
            res.status(500).json({ error: "Failed to deactivate account" });
        }
    }
);

// ============================================================================
// POST /api/sellers/me/reactivate
// Reactivate a deactivated seller account
// ============================================================================
router.post("/me/reactivate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { data: seller, error } = await supabase
            .from("sellers")
            .update({ is_active: true })
            .eq("id", userId)
            .select()
            .single();

        if (error) {
            logger.error("Error reactivating seller account", { error, userId });
            throw error;
        }

        res.json({
            success: true,
            message: "Your seller account has been reactivated.",
            seller,
        });
    } catch (err) {
        logger.error("Error in POST /api/sellers/me/reactivate", { error: err });
        res.status(500).json({ error: "Failed to reactivate account" });
    }
});

export default router;
