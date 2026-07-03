import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { isTokenRevoked } from "../utils/tokenRevocation";
import { AuthenticatedRequest } from "./auth";

/**
 * Middleware to check if user's token has been revoked
 * Should be used after requireAuth to ensure user is authenticated
 */
export async function checkTokenRevocation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Extract token expiry from decoded JWT (exp claim)
        const tokenExp = (req.user as any)?.exp;

        // Check if token is revoked
        const revoked = await isTokenRevoked(userId, undefined, tokenExp);
        if (revoked) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Token has been revoked. Please log in again.",
                code: "TOKEN_REVOKED",
            });
        }

        next();
    } catch (err) {
        logger.error("Error in checkTokenRevocation middleware", { error: err });
        res.status(500).json({ error: "Internal server error" });
    }
}
