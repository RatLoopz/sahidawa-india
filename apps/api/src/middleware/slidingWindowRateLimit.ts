/**
 * Sliding Window Rate Limiter
 *
 * Uses Redis ZRANGEBYSCORE to maintain a true sliding window of request
 * timestamps per key.  Eliminates the burst-at-window-boundary exploit
 * that plagues fixed-window implementations.
 *
 * When Redis is unavailable the limiter degrades gracefully to an in-
 * process Map-based sliding window so the service keeps running (counters
 * are just not shared across replicas).
 */

import { Request, Response, NextFunction } from "express";
import { redisClient } from "../utils/redis";
import { getEndpointLimit, type EndpointLimit } from "../config/rateLimitConfig";
import { resolveTier, getTierMultiplier } from "../config/rateLimitTiers";
import { isBlocked } from "./aggregateRateLimit";
import logger from "../utils/logger";

// ── In-process fallback store (used when Redis is down) ──────────────────────
const localStore = new Map<string, number[]>();
const LOCAL_CLEANUP_INTERVAL_MS = 60_000;

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of localStore) {
        const valid = timestamps.filter((t) => t > now - 15 * 60 * 1000);
        if (valid.length === 0) localStore.delete(key);
        else localStore.set(key, valid);
    }
}, LOCAL_CLEANUP_INTERVAL_MS).unref();

// ── Lua script for atomic sliding-window check + record ──────────────────────
const LUA_SLIDING_WINDOW = `
local key       = KEYS[1]
local now       = tonumber(ARGV[1])
local windowMs  = tonumber(ARGV[2])
local maxReqs   = tonumber(ARGV[3])

-- remove expired entries
redis.call("ZREMRANGEBYSCORE", key, 0, now - windowMs)

-- count current window
local current   = redis.call("ZCARD", key)

if current < maxReqs then
    redis.call("ZADD", key, now, now .. "-" .. math.random(100000))
    redis.call("PEXPIRE", key, windowMs)
    return {0, maxReqs - current - 1, current + 1}
else
    -- return the oldest entry so the client knows when the window resets
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    local retryAfter = oldest[2] and (tonumber(oldest[2]) + windowMs - now) or windowMs
    return {1, retryAfter, current}
end
`;

// ── Progress penalty check (Redis) ───────────────────────────────────────────
const LUA_CHECK_BLOCK = `
local blockKey = KEYS[1]
local blocked  = redis.call("GET", blockKey)
if blocked then
    return {1, tonumber(redis.call("PTTL", blockKey))}
end
return {0, 0}
`;

export interface SlidingWindowOptions {
    /** Key in rateLimitConfig defaults, e.g. "verify", "batch" */
    endpoint: string;
    /** Optional custom key generator (defaults to IP) */
    keyGenerator?: (req: Request) => string;
    /** Skip rate limiting entirely (e.g. for tests) */
    skip?: (req: Request) => boolean;
}

/**
 * Create a sliding-window middleware for the given endpoint.
 */
export function slidingWindowRateLimit(options: SlidingWindowOptions) {
    const { endpoint, keyGenerator, skip } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Allow test env bypass
        if (process.env.NODE_ENV === "test" || skip?.(req)) {
            return next();
        }

        const config = getEndpointLimit(endpoint);
        if (!config) {
            logger.warn(`[slidingWindow] No config for endpoint "${endpoint}"`);
            return next();
        }

        const tier = resolveTier((req as any).user);
        const multiplier = getTierMultiplier(tier);
        const maxReqs = Math.floor(config.maxRequests * multiplier);

        const ip = (keyGenerator ? keyGenerator(req) : req.ip) ?? "unknown";
        const key = `sw:${config.prefix}:${ip}`;

        // 1. Check if IP is blocked due to progressive penalties
        if (redisClient.isOpen) {
            const blockKey = `rl:block:${ip}`;
            try {
                const result = (await redisClient.eval(LUA_CHECK_BLOCK, {
                    keys: [blockKey],
                    arguments: [],
                })) as number[];
                if (result[0] === 1) {
                    const retryMs = result[1];
                    const retrySec = Math.ceil(retryMs / 1000);
                    res.setHeader("Retry-After", String(retrySec));
                    res.setHeader("X-RateLimit-RetryAfter", String(retrySec));
                    res.status(429).json({
                        error: "Too many requests. You are temporarily blocked due to repeated violations.",
                        retryAfter: retrySec,
                    });
                    return;
                }
            } catch {
                // Redis error — skip block check, continue to sliding window
            }
        }

        // 2. Sliding window check
        let allowed: boolean;
        let retryAfter: number;
        let currentCount: number;

        if (redisClient.isOpen) {
            try {
                const result = (await redisClient.eval(LUA_SLIDING_WINDOW, {
                    keys: [key],
                    arguments: [
                        String(Date.now()),
                        String(config.windowMs),
                        String(maxReqs),
                    ],
                })) as number[];
                allowed = result[0] === 0;
                retryAfter = result[1];
                currentCount = result[2];
            } catch (err) {
                logger.error("[slidingWindow] Redis eval failed, allowing request", { error: String(err) });
                return next();
            }
        } else {
            // Fallback: in-process sliding window
            const now = Date.now();
            const timestamps = localStore.get(key) ?? [];
            const valid = timestamps.filter((t) => t > now - config.windowMs);
            currentCount = valid.length;
            if (currentCount < maxReqs) {
                valid.push(now);
                localStore.set(key, valid);
                allowed = true;
                retryAfter = 0;
            } else {
                allowed = false;
                retryAfter = valid[0] + config.windowMs - now;
            }
        }

        // 3. Set standard rate-limit headers
        const remaining = Math.max(0, maxReqs - currentCount);
        const resetTime = Math.ceil((Date.now() + (retryAfter || config.windowMs)) / 1000);

        res.setHeader("RateLimit-Limit", String(maxReqs));
        res.setHeader("RateLimit-Remaining", String(remaining));
        res.setHeader("RateLimit-Reset", String(resetTime));
        res.setHeader("X-RateLimit-Policy", `${maxReqs};w=${Math.floor(config.windowMs / 1000)}`);

        if (!allowed) {
            const retrySec = Math.ceil(retryAfter / 1000);
            res.setHeader("Retry-After", String(retrySec));
            res.setHeader("X-RateLimit-RetryAfter", String(retrySec));

            // Track violation for progressive penalties
            await recordViolation(ip, tier);

            res.status(429).json({
                error: config.label
                    ? `${config.label} rate limit exceeded. Please try again later.`
                    : "Too many requests. Please try again later.",
                retryAfter: retrySec,
            });
            return;
        }

        return next();
    };
}

// ── Violation tracking + progressive penalties ────────────────────────────────
import { PENALTY_THRESHOLDS } from "../config/rateLimitConfig";

async function recordViolation(ip: string, tier: string): Promise<void> {
    if (!redisClient.isOpen) return;

    const key = `rl:violations:${ip}`;
    try {
        const count = await redisClient.incr(key);
        await redisClient.expire(key, 3600); // expire after 1 hour of quiet

        // Find matching penalty tier (escalating)
        for (const threshold of [...PENALTY_THRESHOLDS].reverse()) {
            if (count >= threshold.violations) {
                const blockKey = `rl:block:${ip}`;
                const blockMs = threshold.blockMinutes * 60 * 1000;
                await redisClient.setEx(blockKey, Math.ceil(blockMs / 1000), "1");
                logger.warn("[slidingWindow] IP blocked", {
                    ip,
                    tier,
                    violations: count,
                    blockMinutes: threshold.blockMinutes,
                });
                break;
            }
        }
    } catch (err) {
        logger.error("[slidingWindow] Failed to record violation", { error: String(err) });
    }
}
