import rateLimit from "express-rate-limit";

export const uploadRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Max 5 uploads per minute per IP
    message: {
        error: "Too many upload requests. Please try again later.",
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
});
