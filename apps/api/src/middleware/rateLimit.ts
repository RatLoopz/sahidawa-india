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
