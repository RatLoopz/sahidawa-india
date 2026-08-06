import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { limiter } from "../middleware/rateLimit";
import logger from "../utils/logger";

const ashaRouter = Router();

// GET /api/v1/asha/dashboard/stats
ashaRouter.get(
    "/dashboard/stats",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.id;

            // Get or create user profile
            let { data: userProfile, error: fetchError } = await supabase
                .from("users")
                .select("*")
                .eq("id", userId)
                .maybeSingle();

            if (fetchError) {
                logger.error(`Error fetching user profile: ${fetchError.message}`);
                return res.status(500).json({ error: "Failed to fetch profile stats" });
            }

            if (!userProfile) {
                const { data: newProfile, error: insertError } = await supabase
                    .from("users")
                    .insert({
                        id: userId,
                        role: "asha_worker",
                        points: 0,
                        badges: [],
                    })
                    .select()
                    .single();

                if (insertError) {
                    logger.error(`Error creating user profile: ${insertError.message}`);
                    return res.status(500).json({ error: "Failed to create profile" });
                }
                userProfile = newProfile;
            }

            return res.json({
                points: userProfile.points,
                badges: userProfile.badges || [],
                role: userProfile.role,
            });
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/v1/asha/award-points
// FIX: Only supervisors/admins can award points. Users cannot self-mint points.
const awardPointsSchema = z.object({
    recipient_id: z.string().uuid("Invalid recipient ID format"),
    points: z.number().int().positive().max(100),
    reason: z.string().min(1).max(255),
});

ashaRouter.post(
    "/award-points",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const awarderId = req.user!.id;
            const awarderRole = req.user!.role;

            // SECURITY: Only supervisors and admins can award points
            if (awarderRole !== "supervisor" && awarderRole !== "admin") {
                return res
                    .status(403)
                    .json({ error: "Forbidden: Only supervisors and admins can award points" });
            }

            const parsed = awardPointsSchema.safeParse(req.body);
            if (!parsed.success) {
                return res
                    .status(400)
                    .json({ error: "Invalid points data", details: parsed.error.issues });
            }

            const { recipient_id, points, reason } = parsed.data;

            // Fetch recipient's current points
            const { data: recipientProfile, error: fetchError } = await supabase
                .from("users")
                .select("points, badges, role")
                .eq("id", recipient_id)
                .maybeSingle();

            if (fetchError || !recipientProfile) {
                return res.status(404).json({ error: "Recipient not found" });
            }

            // Only award points to ASHA workers
            if (recipientProfile.role !== "asha_worker") {
                return res.status(400).json({ error: "Can only award points to ASHA workers" });
            }

            const newPoints = recipientProfile.points + points;
            let newBadges = [...(recipientProfile.badges || [])];

            // Badge logic based on points
            if (newPoints >= 100 && !newBadges.includes("Village Guardian")) {
                newBadges.push("Village Guardian");
            }
            if (newPoints >= 500 && !newBadges.includes("Health Champion")) {
                newBadges.push("Health Champion");
            }

            const { data: updatedProfile, error: updateError } = await supabase
                .from("users")
                .update({
                    points: newPoints,
                    badges: newBadges,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", recipient_id)
                .select()
                .single();

            if (updateError) {
                logger.error(`Error updating points: ${updateError.message}`);
                return res.status(500).json({ error: "Failed to award points" });
            }

            // Return updated stats and newly unlocked badges if any
            const newUnlockedBadges = newBadges.filter(
                (b) => !(recipientProfile.badges || []).includes(b)
            );

            return res.json({
                success: true,
                message: `Awarded ${points} points to ${recipient_id} for ${reason}`,
                recipient_id,
                points: updatedProfile.points,
                badges: updatedProfile.badges,
                unlockedBadges: newUnlockedBadges,
            });
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/v1/asha/leaderboard
ashaRouter.get(
    "/leaderboard",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { data: leaderboard, error } = await supabase
                .from("users")
                .select("id, full_name, points, badges, avatar_url, role")
                .eq("role", "asha_worker")
                .order("points", { ascending: false })
                .limit(10);

            if (error) {
                logger.error(`Error fetching leaderboard: ${error.message}`);
                return res.status(500).json({ error: "Failed to fetch leaderboard" });
            }

            return res.json({ leaderboard });
        } catch (err) {
            next(err);
        }
    }
);

export default ashaRouter;
