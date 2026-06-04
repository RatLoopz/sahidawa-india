import rateLimit from "express-rate-limit";

export const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 20,
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
    max: 100, // 100 requests per hour per IP
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

// LASA check limiter
// find_lasa_conflicts performs string-distance comparisons across the full
// medicines table, making each request more expensive than a simple key lookup.
// Without throttling a single IP can exhaust the Supabase connection pool
// with a rapid stream of POST /api/v1/lasa/check requests.
// 30 requests per 15 minutes matches the verifyLimiter budget (20/15 min)
// while allowing a few extra attempts for legitimate batch UI workflows.
export const lasaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({
            error: "Too many LASA check requests. Please try again later.",
        });
    },
});
