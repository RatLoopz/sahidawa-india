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