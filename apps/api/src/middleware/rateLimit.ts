import rateLimit, { MemoryStore, Store, Options, IncrementResponse } from "express-rate-limit";
import { Request, Response } from "express";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";
import { formatPhoneNumber } from "../utils/phone";
// Dynamic wrappers createLimiter and createKeyLimiter are removed to enable CodeQL static analysis.
// ── Store factory ──────────────────────────────────────────────────────────────
//
// Uses a Redis-backed store when the client is connected so that counters are
// shared across every API replica (critical for horizontal scaling and Cloud Run).
// Falls back to the in-process MemoryStore when Redis is unavailable, so the
// service continues to function in local development without a Redis instance.
//
// Resolution is deliberately lazy: limiters are constructed at module load time,
// before `connectRedis()` runs in the server listen callback, so checking
// `redisClient.isOpen` up-front would always pick MemoryStore. Instead the real
// store is resolved on first use (the first request), by which time the Redis
// connection is established.

class LazyStore implements Store {
    private readonly keyPrefix: string;
    private store: Store | undefined;
    private initOptions: Options | undefined;

    constructor(prefix: string) {
        this.keyPrefix = prefix;
    }

    init(options: Options): void {
        this.initOptions = options;
    }

    private resolve(): Store {
        if (!this.store) {
            if (redisClient.isOpen) {
                this.store = new RedisStore({
                    // Adapts the node-redis v4 client to the interface expected by rate-limit-redis
                    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
                    prefix: `rl:${this.keyPrefix}:`,
                });
                logger.info(`[rateLimit] Redis store active for prefix '${this.keyPrefix}'`);
            } else {
                this.store = new MemoryStore();
                logger.warn(
                    `[rateLimit] Redis not connected — ${this.keyPrefix} limiter falling back to MemoryStore. ` +
                        "Rate limiting will NOT be shared across replicas."
                );
            }
            if (this.initOptions && this.store.init) {
                void this.store.init(this.initOptions);
            }
        }
        return this.store;
    }

    increment(key: string): Promise<IncrementResponse> | IncrementResponse {
        return this.resolve().increment(key);
    }

    decrement(key: string): Promise<void> | void {
        return this.resolve().decrement(key);
    }

    resetKey(key: string): Promise<void> | void {
        return this.resolve().resetKey(key);
    }

    resetAll(): Promise<void> | void {
        return this.resolve().resetAll?.();
    }
}

export function buildStore(prefix: string): Store {
    return new LazyStore(prefix);
}

// ── Limiters ───────────────────────────────────────────────────────────────────

/** Medicine verification endpoint — unauthenticated, moderately expensive. */
export const verifyLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "development" ? 500 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("verify"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many requests. Please try again later.",
        });
    },
});

/** Batch traceability lookup — throttle to prevent database scraping. */
export const batchLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("batch"),
    validate: false,
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
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many requests. Please try again later.",
        });
    },
});

// Report submission limiter — prevents mass fake-report flooding.
export const reportLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 10 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("report"),
    validate: false,
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
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many LASA check requests. Please try again later.",
        });
    },
});

// ── Scan query limiter ────────────────────────────────────────────────────────
export const scanQueryLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("scan"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many scan queries. Please try again later.",
        });
    },
});

// ── Medicine comparison limiter ─────────────────────────────────────────────
export const compareLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("compare"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many comparison requests. Please try again later.",
        });
    },
});

// ── Interaction check limiter ─────────────────────────────────────────────────
export const interactionCheckLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("interactions"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many interaction check requests. Please try again later.",
        });
    },
});

// ── Interaction IDs (GET) limiter ─────────────────────────────────────────────
export const interactionIdsLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("interactions_ids"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many interaction lookup requests. Please try again later.",
        });
    },
});

/** Scheme eligibility check limiter — prevent DB spam on state query. */
export const eligibilityLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("eligibility"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many eligibility checks. Please try again later.",
        });
    },
});

// ── Triage limiter ──────────────────────────────────────────────────────────
export const triageLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("triage"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many triage requests. Please try again later.",
        });
    },
});

// ── Analytics limiter ──────────────────────────────────────────────────────────
export const analyticsLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("analytics"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many analytics requests. Please try again later.",
        });
    },
});

/**
 * Builds the bucket key for authentication limiters.
 *
 * Exported so the key derivation can be unit-tested on its own - a mismatch
 * here silently degrades the limiter to per-IP instead of failing loudly.
 *
 * Both target values are normalised before they reach the key. Two spellings of
 * one number ("9876543210" and "+91 98765 43210") or one ABHA address
 * ("Ravi@sbx" and "ravi@sbx") would otherwise land in separate buckets and hand
 * the caller a multiple of the cap.
 */
export const authTargetKeyGenerator = (req: Request): string => {
    // Look for common identity keys in the request body
    const abhaAddress = req.body?.abhaAddress;
    if (typeof abhaAddress === "string" && abhaAddress.trim()) {
        // ABHA addresses are case-insensitive (ABDM lowercases them on issue).
        return `abha:${abhaAddress.trim().toLowerCase()}`;
    }

    // The notification routes send `phone`; `phone_number` is kept for any
    // caller still using the field this limiter originally shipped with.
    const phone = req.body?.phone ?? req.body?.phone_number;
    if (typeof phone === "string") {
        const formatted = formatPhoneNumber(phone);
        // An unparseable number is rejected by the route before any OTP goes
        // out, so there is no target to throttle - and keying on the raw value
        // would let junk input mint a fresh bucket on every request.
        if (formatted) return `phone:${formatted}`;
    }

    // Fallback to IP if no explicit target is found
    return (req.ip || "unknown").replace(/:/g, "_");
};

/** Authentication endpoints — strict limit to prevent credential brute-forcing and OTP bombing. */
export const authLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: authTargetKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("auth"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many authentication attempts. Please try again later.",
        });
    },
});



/** Target-based limiter to prevent OTP bombing against a specific user/target irrespective of IP */
export const authTargetLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Max 5 requests per 10 minutes per target
    keyGenerator: authTargetKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("auth_target"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many requests for this target. Please try again later.",
        });
    },
});

// ── Notification registration limiter ──────────────────────────────────────────
export const notificationRegisterLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: authTargetKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    store: buildStore("notification_register"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many registration attempts",
        });
    },
});

/** Medicine tracking endpoints — throttle to prevent runaway clients from spamming database lookups/inserts. */
export const trackingLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    store: buildStore("tracking"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many tracking requests. Please try again later.",
        });
    },
});

export const webhookLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    store: buildStore("webhook"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many webhook requests. Please try again later.",
        });
    },
});

/** Barcode lookup limiter — prevents abuse of barcode scanning for data enumeration.
 *  Barcode lookups are unauthenticated and moderately expensive (full-text search or exact match).
 *  Each IP can perform at most 15 barcode lookups per 15 minutes to prevent database enumeration attacks
 *  and ensure fair access for legitimate pharmacy/clinic use cases. */
export const barcodeLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "development" ? 200 : 15,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    store: buildStore("barcode"),
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many barcode lookups. Please try again later.",
        });
    },
});

// Medicine schedule limiter
export const scheduleLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("schedules"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many schedule requests. Please try again later.",
        });
    },
});

// Alerts read limiter
// GET /api/v1/alerts is unauthenticated and runs paginated DB queries with
// ILIKE filters. Throttle to prevent enumeration and connection pool exhaustion.
export const alertsReadLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("alerts_read"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many alerts requests. Please try again later.",
        });
    },
});

// ── API key management limiter ──────────────────────────────────────────────
// /api/keys list/revoke/delete/rotate are sensitive, low-frequency operations.
// A stricter cap curbs revoke/delete probing against guessed ids and throttles
// rotate, which runs a pbkdf2 hash per call.
export const apiKeyLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("api_keys"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many API key requests. Please try again later.",
        });
    },
});

// ── Health Check Limiter ──────────────────────────────────────────────────────
export const healthLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Very lenient limit for orchestrator health checks
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("health"),
    validate: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many health check requests.",
        });
    },
});
