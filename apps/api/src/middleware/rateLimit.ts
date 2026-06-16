import rateLimit from "express-rate-limit";

export const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: process.env.NODE_ENV === "development" ? 500 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many requests. Please try again later.",
        });
    },
});

// ── Batch traceability limiter ─────────────────────────────────────────────
export const batchLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return (
            req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
            req.socket.remoteAddress ||
            "unknown"
        );
    },
    handler: (_req, res) => {
        res.status(429).json({
            error: "Rate limit exceeded. Maximum 100 batch lookups per hour.",
        });
    },
});

export const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
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
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return (
            req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
            req.socket.remoteAddress ||
            "unknown"
        );
    },
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many reports submitted. Please try again later.",
        });
    },
});
export const lasaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many LASA check requests. Please try again later.",
        });
    },
});

// ── Scan query limiter ───────────────────────────────────────────────────────
// /scan/match calls search_medicines_text RPC (trigram full-text search).
// /scan/verify-brand does ILIKE over the medicines table.
// Both are unauthenticated and moderately expensive — throttle to prevent
// medicine-database scraping and Supabase connection pool exhaustion.
export const scanQueryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many scan queries. Please try again later.",
        });
    },
});
