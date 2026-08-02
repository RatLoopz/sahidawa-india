import rateLimit from "express-rate-limit";
import { buildStore } from "./rateLimit";

/** Upload endpoint limiter — uses shared Redis-backed store for horizontal scaling.
 *  Prevents disk-exhaustion DoS by enforcing global upload limits across all replicas. */
export const uploadRateLimiter = rateLimit({
    skip: () => process.env.NODE_ENV === "test",
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Max 5 uploads per minute per IP
    message: {
        error: "Too many upload requests. Please try again later.",
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("upload"),
    validate: false,
});
