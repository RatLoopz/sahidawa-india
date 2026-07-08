import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import axios from "axios";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger"; // Destructured template fixed based on your previous logs
import { requireAuth } from "../middleware/auth"; // Fixed paths matching your exact structure
import { limiter } from "../middleware/rateLimit"; // Fixed middleware import token maps

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const router = Router();

const compareRequestSchema = z.object({
    medicine_a: z.string().min(1, "Medicine A is required"),
    medicine_b: z.string().min(1, "Medicine B is required"),
});

function getCacheKey(medA: string, medB: string): string {
    const sorted = [medA.trim().toLowerCase(), medB.trim().toLowerCase()].sort();
    const hash = crypto.createHash("sha256").update(sorted.join("||")).digest("hex");
    return `cmp_result:${hash}`;
}

router.post(
    "/",
    requireAuth,
    limiter,
    async (req: any, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = compareRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
                return;
            }

            const { medicine_a, medicine_b } = parsed.data;
            const cacheKey = getCacheKey(medicine_a, medicine_b);

            // 1. Check Redis Cache for pre-computed similarity
            if (redisClient) {
                const cachedResult = await redisClient.get(cacheKey);
                if (cachedResult) {
                    logger.info(
                        `Cache hit for medicine comparison: ${medicine_a} vs ${medicine_b}`
                    );
                    res.status(200).json(JSON.parse(cachedResult));
                    return;
                }
            }

            // 2. Cache Miss: Forward request to Python ML service with timeout protection
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

            try {
                const mlResponse = await axios.post(
                    `${ML_SERVICE_URL}/verify/compare`,
                    { medicine_a, medicine_b },
                    { signal: controller.signal }
                );
                clearTimeout(timeoutId);

                const resultData = mlResponse.data;

                // 3. Save result to Redis with 24 hours TTL (86400 seconds)
                if (redisClient) {
                    await redisClient.set(cacheKey, JSON.stringify(resultData), {
                        EX: 86400,
                    });
                }

                res.status(200).json(resultData);
            } catch (mlError: any) {
                clearTimeout(timeoutId);
                logger.error(`Failed to connect or fetch from ML Service: ${mlError.message}`);
                res.status(502).json({ error: "ML service comparison failed or timed out." });
            }
        } catch (error) {
            next(error);
        }
    }
);

export default router;
