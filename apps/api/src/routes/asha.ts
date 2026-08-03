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
const awardPointsSchema = z.object({
    points: z.number().int().positive().max(100),
    reason: z.string().min(1).max(255),
});

ashaRouter.post(
    "/award-points",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.id;

            const parsed = awardPointsSchema.safeParse(req.body);
            if (!parsed.success) {
                return res
                    .status(400)
                    .json({ error: "Invalid points data", details: parsed.error.issues });
            }

            const { points, reason } = parsed.data;

            // Fetch current points
            const { data: userProfile, error: fetchError } = await supabase
                .from("users")
                .select("points, badges")
                .eq("id", userId)
                .maybeSingle();

            if (fetchError || !userProfile) {
                return res.status(500).json({ error: "Failed to fetch profile" });
            }

            const newPoints = userProfile.points + points;
            let newBadges = [...(userProfile.badges || [])];

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
                .eq("id", userId)
                .select()
                .single();

            if (updateError) {
                logger.error(`Error updating points: ${updateError.message}`);
                return res.status(500).json({ error: "Failed to award points" });
            }

            // Return updated stats and newly unlocked badges if any
            const newUnlockedBadges = newBadges.filter(
                (b) => !(userProfile.badges || []).includes(b)
            );

            return res.json({
                success: true,
                message: `Awarded ${points} points for ${reason}`,
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
