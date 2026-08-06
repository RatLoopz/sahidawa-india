import { Router, Response, NextFunction } from "express";
import { supabase } from "../db/client";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
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

// POST /api/v1/asha/award-points was removed: clients must not mint their own
// points. Awards happen only from verified server-side events (scan/report).
ashaRouter.post("/award-points", requireAuth, (_req, res: Response) => {
    return res.status(410).json({
        error: "Client point minting is disabled",
        message:
            "Points are awarded by verified server-side events only, not by client request.",
    });
});

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
