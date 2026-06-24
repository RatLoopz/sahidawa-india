import rateLimit, { type Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";

// ── Redis store factory ────────────────────────────────────────────────────
// Returns a RedisStore when Redis is available, or undefined (which causes
// express-rate-limit to fall back to its default in-memory store).
// The prefix isolates rate-limit keys from drug cache keys (drug:batch:*)
// and hit-counter keys (hits:drug:*) in the shared Redis keyspace.
function createRedisStore(prefix: string): Store | undefined {
    const redisAvailable = !!process.env.REDIS_URL && redisClient.isOpen;
    if (!redisAvailable) return undefined;

    return new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix,
    });
}

// ── Generic distributed limiter factory ───────────────────────────────────
// Wraps express-rate-limit with:
//   • A Redis-backed store when REDIS_URL is set (distributed, shared across
//     all horizontally-scaled API instances).
//   • Graceful in-memory fallback when Redis is unavailable, so the server
//     always boots and functions in local dev without a Redis dependency.
//   • Standardised JSON error response including a `retryAfter` field so
//     clients know exactly when they can retry.
//   • Per-limit structured logging whenever a limit is actually triggered.
function createDistributedLimiter({
    name,
    windowMs,
    max,
    keyGenerator,
    errorMessage,
    redisPrefix,
}: {
    name: string;
    windowMs: number;
    max: number;
    keyGenerator?: (req: import("express").Request) => string;
    errorMessage: string;
    redisPrefix: string;
}) {
    const store = createRedisStore(redisPrefix);

    if (store) {
        logger.info(`[rateLimit] ${name}: using Redis distributed store (prefix: ${redisPrefix}).`);
    } else {
        logger.warn(
            `[rateLimit] ${name}: REDIS_URL not set or Redis not connected — ` +
                `falling back to in-memory store.`
        );
    }

    const defaultKeyGenerator = (req: import("express").Request): string =>
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true, // Return rate-limit info in `RateLimit-*` headers (RFC 6585)
        legacyHeaders: false, // Disable `X-RateLimit-*` headers
        ...(store && { store }),
        keyGenerator: keyGenerator ?? defaultKeyGenerator,
        handler: (req, res) => {
            const key = (keyGenerator ?? defaultKeyGenerator)(req);
            const retryAfter = Math.ceil(windowMs / 1000);

            logger.warn(
                `[rateLimit] ${name}: limit hit — key="${key}" max=${max} windowMs=${windowMs}`
            );

            res.status(429).json({
                error: errorMessage,
                retryAfter,
            });
        },
    });
}

// ── Verify limiter ─────────────────────────────────────────────────────────
// /api/v1/verify — individual medicine barcode verification
export const verifyLimiter = createDistributedLimiter({
    name: "verifyLimiter",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "development" ? 500 : 20,
    errorMessage: "Too many requests. Please try again later.",
    redisPrefix: "rl:verify:",
});

// ── Batch limiter ──────────────────────────────────────────────────────────
// /api/v1/verify/batch — batch traceability lookups
export const batchLimiter = createDistributedLimiter({
    name: "batchLimiter",
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    errorMessage: "Rate limit exceeded. Maximum 100 batch lookups per hour.",
    redisPrefix: "rl:batch:",
});

// ── General API limiter ────────────────────────────────────────────────────
// Applied globally as a baseline catch-all across all routes
export const limiter = createDistributedLimiter({
    name: "limiter",
    windowMs: 15 * 60 * 1000,
    max: 100,
    errorMessage: "Too many requests. Please try again later.",
    redisPrefix: "rl:general:",
});

// ── Report limiter ─────────────────────────────────────────────────────────
// POST /api/v1/reports — counterfeit medicine reports
// Intentionally strict: abuse directly corrupts heatmap integrity and
// district alerts. Max 3 reports per IP per 10 minutes.
export const reportLimiter = createDistributedLimiter({
    name: "reportLimiter",
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3,
    errorMessage: "Too many reports submitted. Please try again later.",
    redisPrefix: "rl:report:",
});

// ── LASA limiter ───────────────────────────────────────────────────────────
// /api/v1/lasa — Look-Alike Sound-Alike medicine checks
export const lasaLimiter = createDistributedLimiter({
    name: "lasaLimiter",
    windowMs: 15 * 60 * 1000,
    max: 30,
    errorMessage: "Too many LASA check requests. Please try again later.",
    redisPrefix: "rl:lasa:",
});

// ── Scan query limiter ─────────────────────────────────────────────────────
// /scan/match — trigram full-text search (expensive Supabase RPC)
// /scan/verify-brand — ILIKE over medicines table
// Unauthenticated and moderately expensive: throttle to prevent
// medicine-database scraping and Supabase connection pool exhaustion.
export const scanQueryLimiter = createDistributedLimiter({
    name: "scanQueryLimiter",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    errorMessage: "Too many scan queries. Please try again later.",
    redisPrefix: "rl:scan:",
});

// ── Interaction check limiter ──────────────────────────────────────────────
// POST /interactions/check — accepts up to 20 medicines and executes up to
// 190 Supabase DB queries per batch. This is the most DB-intensive endpoint
// in the entire API. Distributed rate limiting is critical here because
// in-memory limits are bypassed when the API scales horizontally:
//
//   Instance A [10 req] → ✅ (in-memory counter = 10)
//   Instance B [10 req] → ✅ (in-memory counter = 10) ← BYPASS
//
// With Redis, all instances share a single counter:
//
//   Instance A [8 req] + Instance B [3 req] → ❌ 429 on the 11th request
//
export const interactionCheckLimiter = createDistributedLimiter({
    name: "interactionCheckLimiter",
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    errorMessage: "Too many interaction check requests. Please try again later.",
    redisPrefix: "rl:interaction:",
});
