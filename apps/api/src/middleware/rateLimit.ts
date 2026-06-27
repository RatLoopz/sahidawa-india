import rateLimit, { Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";
interface LimiterOptions {
    windowMs: number;
    max: number;
    message: string;
    prefix?: string;
}

const createLimiter = (options: LimiterOptions) => {
    return rateLimit({
        skip: () => process.env.NODE_ENV === "test",
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        store: buildStore(options.prefix || "general"),
        handler: (_req, res) => {
            res.status(429).json({
                error: options.message,
            });
        },
    });
};
// ── Store factory ──────────────────────────────────────────────────────────────
//
// Uses a Redis-backed store when the client is connected so that counters are
// shared across every API replica (critical for horizontal scaling and Cloud Run).
// Falls back to the in-process MemoryStore when Redis is unavailable, so the
// service continues to function in local development without a Redis instance.

function buildStore(prefix: string): Store | undefined {
    if (redisClient.isOpen) {
        return new RedisStore({
            // Adapts the node-redis v4 client to the interface expected by rate-limit-redis
            sendCommand: (...args: string[]) => redisClient.sendCommand(args),
            prefix: `rl:${prefix}:`,
        });
    }
    logger.warn(
        `[rateLimit] Redis not connected — ${prefix} limiter falling back to MemoryStore. ` +
            "Rate limiting will NOT be shared across replicas."
    );
    return undefined; // undefined → express-rate-limit uses its default MemoryStore
}

// ── Limiters ───────────────────────────────────────────────────────────────────

/** Medicine verification endpoint — unauthenticated, moderately expensive. */
export const verifyLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "development" ? 500 : 20,
    message: "Too many requests. Please try again later.",
    prefix: "verify",
});

/** Batch traceability lookup — throttle to prevent database scraping. */
export const batchLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: "Rate limit exceeded. Maximum 100 batch lookups per hour.",
    prefix: "batch",
});
/** General-purpose API limiter. */
export const limiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests. Please try again later.",
    prefix: "general",
});
// Report submission limiter — prevents mass fake-report flooding.
// Each IP can submit at most 3 counterfeit reports per 10 minutes.
// This is intentionally stricter than the general API limiter because
// report abuse directly undermines heatmap integrity and district alerts.
export const reportLimiter = createLimiter({
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: "Too many reports submitted. Please try again later.",
    prefix: "report",
});
/** LASA (Look-Alike Sound-Alike) drug check limiter. */
export const lasaLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many LASA check requests. Please try again later.",
    prefix: "lasa",
});
// ── Scan query limiter ────────────────────────────────────────────────────────
// /scan/match calls search_medicines_text RPC (trigram full-text search).
// /scan/verify-brand does ILIKE over the medicines table.
// Both are unauthenticated and moderately expensive — throttle to prevent
// medicine-database scraping and Supabase connection pool exhaustion.
export const scanQueryLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many scan queries. Please try again later.",
    prefix: "scan",
});
// ── Interaction check limiter ─────────────────────────────────────────────────
// POST /interactions/check accepts up to 20 medicines, generating up to 190
// DB queries per request. Throttle to prevent DoS via batch interaction checks.
export const interactionCheckLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: "Too many interaction check requests. Please try again later.",
    prefix: "interactions",
});
/** Scheme eligibility check limiter — prevent DB spam on state query. */
export const eligibilityLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many eligibility checks. Please try again later.",
    prefix: "eligibility",
});
// ── Triage limiter ──────────────────────────────────────────────────────────
// POST /triage/medicine-query and /triage/recommend perform expensive pgvector
// semantic search + optional Gemini embedding calls + PostGIS RPC.
// Throttle to prevent DoS via repeated semantic search queries.
export const triageLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 15,
    message: "Too many triage requests. Please try again later.",
    prefix: "triage",
});
// ── Analytics limiter ──────────────────────────────────────────────────────────
export const analyticsLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many analytics requests. Please try again later.",
    prefix: "analytics",
});
/** Medicine tracking endpoints — throttle to prevent runaway clients from spamming database lookups/inserts. */
export const trackingLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("tracking"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many tracking requests. Please try again later.",
        });
    },
});
