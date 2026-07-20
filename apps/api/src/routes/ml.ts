import { Router, Response } from "express";
import { z } from "zod";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import {
    getMlServiceUrl,
    getMlAuthHeaders,
    MISSING_ML_SERVICE_URL_MESSAGE,
} from "../config/mlService";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import logger from "../utils/logger";
import { limiter } from "../middleware/rateLimit";
import { redisClient } from "../utils/redis";

const router = Router();

const analyzeRequestSchema = z.object({
    imageUrl: z.string().url().startsWith("https://", "imageUrl must be an HTTPS URL"),
});

const analyzeResponseSchema = z.object({
    isFake: z.boolean(),
    confidence: z.number().min(0).max(1),
    verdict: z.enum(["likely_genuine", "suspicious", "likely_fake"]),
    details: z.string(),
});

const PRIVATE_IP_RE =
    /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|::1|::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0)$/;

const LINK_LOCAL_HOSTNAMES = [".local", ".internal", ".nip.io", ".localtest.me"];

const PRIVATE_HOSTNAME_RE =
    /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|::1|::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0)$/;

const ML_ANALYSIS_CACHE_TTL_SECONDS = 3600; // 1 hour
const ML_ANALYSIS_TIMEOUT_MS = 8000;

function buildCacheKey(imageUrl: string): string {
    const hash = createHash("sha256").update(imageUrl).digest("hex");
    return `ml:analyze:${hash}`;
}

function isPrivateIp(ip: string): boolean {
    return PRIVATE_IP_RE.test(ip);
}

async function isPrivateHostname(urlStr: string): Promise<boolean> {
    try {
        const hostname = new URL(urlStr).hostname;
        if (PRIVATE_HOSTNAME_RE.test(hostname)) return true;
        if (LINK_LOCAL_HOSTNAMES.some((s) => hostname.endsWith(s))) return true;

        const addresses = await dns.resolve4(hostname);
        return addresses.some((addr) => isPrivateIp(addr));
    } catch {
        return true;
    }
}

router.post("/analyze", limiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues,
        });
        return;
    }

    if (await isPrivateHostname(parsed.data.imageUrl)) {
        logger.warn("SSRF attempt blocked", {
            imageUrl: parsed.data.imageUrl,
            caller: req.user?.email ?? req.user?.id,
        });
        res.status(400).json({
            error: "Invalid request body",
            details: [{ message: "imageUrl must point to a public HTTPS resource" }],
        });
        return;
    }

    const cacheKey = buildCacheKey(parsed.data.imageUrl);

    // Check Redis cache before hitting the ML service
    if (redisClient.isOpen) {
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                logger.info("Cache hit for ML analysis", { cacheKey });
                res.status(200).json(JSON.parse(cached));
                return;
            }
        } catch (err) {
            logger.warn("Redis cache read failed, falling through to ML service", { err });
        }
    }

    const mlServiceUrl = getMlServiceUrl();
    if (!mlServiceUrl) {
        logger.error(MISSING_ML_SERVICE_URL_MESSAGE, { route: "/api/ml/analyze" });
        res.status(500).json({
            error: "Image analysis service is not configured.",
            code: "ML_SERVICE_URL_MISSING",
        });
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_ANALYSIS_TIMEOUT_MS);

    try {
        const mlResponse = await fetch(`${mlServiceUrl}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getMlAuthHeaders() },
            body: JSON.stringify(parsed.data),
            signal: controller.signal,
        });

        const body = (await mlResponse.json().catch(() => ({}))) as unknown;

        if (!mlResponse.ok) {
            res.status(mlResponse.status).json({
                error: "Image analysis failed",
                details:
                    typeof body === "object" && body !== null && "detail" in body
                        ? (body as { detail?: unknown }).detail
                        : undefined,
            });
            return;
        }

        const analysis = analyzeResponseSchema.safeParse(body);
        if (!analysis.success) {
            res.status(502).json({ error: "Image analysis service returned an invalid response" });
            return;
        }

        // Store result in Redis with 1-hour TTL
        if (redisClient.isOpen) {
            try {
                await redisClient.set(cacheKey, JSON.stringify(analysis.data), {
                    EX: ML_ANALYSIS_CACHE_TTL_SECONDS,
                });
                logger.info("ML analysis result cached", { cacheKey });
            } catch (err) {
                logger.warn("Redis cache write failed", { err });
            }
        }

        res.status(200).json(analysis.data);
    } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        res.status(isAbort ? 504 : 502).json({
            error: isAbort ? "Image analysis timed out" : "Image analysis service is unavailable",
        });
    } finally {
        clearTimeout(timeout);
    }
});

/**
 * Mint a short-lived ticket so an authenticated user's browser can open the
 * ML streaming WebSocket. Browsers cannot set headers on a WebSocket
 * handshake, and the shared ML_API_KEY must never reach the page, so the
 * browser gets a signed credential that expires in a minute and works once.
 *
 * Format must stay in sync with apps/ml/utils/ws_ticket.py.
 */
router.post("/stream-ticket", limiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const apiKey = process.env.ML_API_KEY?.trim();
    if (!apiKey) {
        logger.error("ML_API_KEY is not set; cannot mint ML stream tickets.");
        res.status(503).json({
            error: "ML streaming is not configured",
            code: "ML_API_KEY_MISSING",
        });
        return;
    }

    const mlServiceUrl = getMlServiceUrl();
    if (!mlServiceUrl) {
        logger.error(MISSING_ML_SERVICE_URL_MESSAGE, { route: "/api/ml/stream-ticket" });
        res.status(503).json({
            error: MISSING_ML_SERVICE_URL_MESSAGE,
            code: "ML_SERVICE_URL_MISSING",
        });
        return;
    }

    const ttlSeconds = 60;
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const nonce = randomBytes(16).toString("hex");
    const payload = `v1.${expiry}.${nonce}`;
    const signature = createHmac("sha256", apiKey).update(payload).digest("hex");

    logger.info("Issued ML stream ticket", { userId: req.user?.id });

    res.json({
        ticket: `${payload}.${signature}`,
        expiresAt: expiry,
        streamUrl: `${mlServiceUrl.replace(/^http/, "ws")}/asr/stream`,
    });
});

export default router;
