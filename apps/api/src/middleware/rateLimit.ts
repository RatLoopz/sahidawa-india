import rateLimit, { Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";

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
export const verifyLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "development" ? 500 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("verify"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many requests. Please try again later.",
        });
    },
});

/** Batch traceability lookup — throttle to prevent database scraping. */
export const batchLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("batch"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Rate limit exceeded. Maximum 100 batch lookups per hour.",
        });
    },
});

/** General-purpose API limiter. */
export const limiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("general"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many requests. Please try again later.",
        });
    },
});

// Report submission limiter — prevents mass fake-report flooding.
// Each IP can submit at most 3 counterfeit reports per 10 minutes.
// This is intentionally stricter than the general API limiter because
// report abuse directly undermines heatmap integrity and district alerts.
export const reportLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("report"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many reports submitted. Please try again later.",
        });
    },
});

/** LASA (Look-Alike Sound-Alike) drug check limiter. */
export const lasaLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("lasa"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many LASA check requests. Please try again later.",
        });
    },
});

// ── Scan query limiter ────────────────────────────────────────────────────────
// /scan/match calls search_medicines_text RPC (trigram full-text search).
// /scan/verify-brand does ILIKE over the medicines table.
// Both are unauthenticated and moderately expensive — throttle to prevent
// medicine-database scraping and Supabase connection pool exhaustion.
export const scanQueryLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("scan"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many scan queries. Please try again later.",
        });
    },
});

// ── Interaction check limiter ─────────────────────────────────────────────────
// POST /interactions/check accepts up to 20 medicines, generating up to 190
// DB queries per request. Throttle to prevent DoS via batch interaction checks.
export const interactionCheckLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("interactions"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many interaction check requests. Please try again later.",
        });
    },
});

/** Scheme eligibility check limiter — prevent DB spam on state query. */
export const eligibilityLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("eligibility"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many eligibility checks. Please try again later.",
        });
    },
});
// ── Triage limiter ──────────────────────────────────────────────────────────
// POST /triage/medicine-query and /triage/recommend perform expensive pgvector
// semantic search + optional Gemini embedding calls + PostGIS RPC.
// Throttle to prevent DoS via repeated semantic search queries.
export const triageLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000, // 1 minute
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("triage"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many triage requests. Please try again later.",
        });
    },
});

// ── Analytics limiter ──────────────────────────────────────────────────────────
export const analyticsLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("analytics"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many analytics requests. Please try again later.",
        });
    },
});
