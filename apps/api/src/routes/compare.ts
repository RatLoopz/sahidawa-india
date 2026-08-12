import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import axios from "axios";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger"; // Destructured template fixed based on your previous logs
import { requireAuth } from "../middleware/auth"; // Fixed paths matching your exact structure
import { compareLimiter } from "../middleware/rateLimit";
import { getMlAuthHeaders } from "../config/mlService";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const router = Router();

const compareRequestSchema = z.object({
    medicine_a: z.string().min(1, "Medicine A is required").max(200, "Medicine A is too long"),
    medicine_b: z.string().min(1, "Medicine B is required").max(200, "Medicine B is too long"),
});

function getCacheKey(medA: string, medB: string): string {
    const sorted = [medA.trim().toLowerCase(), medB.trim().toLowerCase()].sort();
    const hash = crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
    return `cmp_result:${hash}`;
}

router.post(
    "/",
    compareLimiter,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = compareRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
                return;
            }

            const { medicine_a, medicine_b } = parsed.data;
            const cacheKey = getCacheKey(medicine_a, medicine_b);

            // 1. Check Redis Cache for pre-computed similarity (skip when Redis unavailable)
            if (redisClient.isOpen) {
                try {
                    const cachedResult = await redisClient.get(cacheKey);
                    if (cachedResult) {
                        logger.info(
                            `Cache hit for medicine comparison: ${medicine_a} vs ${medicine_b}`
                        );
                        res.status(200).json(JSON.parse(cachedResult));
                        return;
                    }
                } catch (cacheErr) {
                    logger.warn(
                        `Redis cache read error in compare route: ${cacheErr instanceof Error ? cacheErr.message : cacheErr}`
                    );
                }
            }

            // 2. Cache Miss: Forward request to Python ML service with timeout protection
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

            try {
                const mlResponse = await axios.post(
                    `${ML_SERVICE_URL}/verify/compare`,
                    { medicine_a, medicine_b },
                    { signal: controller.signal, headers: getMlAuthHeaders() }
                );
                clearTimeout(timeoutId);

                const resultData = mlResponse.data;

                // 3. Save result to Redis with 24 hours TTL (86400 seconds)
                if (redisClient.isOpen) {
                    try {
                        await redisClient.set(cacheKey, JSON.stringify(resultData), {
                            EX: 86400,
                        });
                    } catch (cacheErr) {
                        logger.warn(
                            `Redis cache write error in compare route: ${cacheErr instanceof Error ? cacheErr.message : cacheErr}`
                        );
                    }
                }

                res.status(200).json(resultData);
            } catch (mlError: unknown) {
                clearTimeout(timeoutId);
                logger.error("ML service failed, falling back to basic matching", { error: mlError instanceof Error ? mlError.message : String(mlError) });
                res.status(502).json({ error: "ML service comparison failed or timed out." });
            }
        } catch (error) {
            next(error);
        }
    }
);

export default router;
