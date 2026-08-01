/**
 * Aggregate Rate Limiter
 *
 * Tracks total requests per IP across ALL endpoints within a sliding
 * window.  Acts as a global safety net — even if individual endpoint
 * limits haven't been hit, a flood of requests across many endpoints
 * will still be caught.
 *
 * Also manages progressive penalty blocks (escalating bans for repeat
 * offenders) used by the sliding-window limiter.
 */

import { Request, Response, NextFunction } from "express";
import { redisClient } from "../utils/redis";
import { GLOBAL_AGGREGATE } from "../config/rateLimitConfig";
import logger from "../utils/logger";

// ── Lua: atomic increment + check ────────────────────────────────────────────
const LUA_AGGREGATE_CHECK = `
local key     = KEYS[1]
local now     = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxReqs = tonumber(ARGV[3])

redis.call("ZREMRANGEBYSCORE", key, 0, now - windowMs)
local current = redis.call("ZCARD", key)

if current < maxReqs then
    redis.call("ZADD", key, now, now .. "-" .. math.random(100000))
    redis.call("PEXPIRE", key, windowMs)
    return {0, maxReqs - current - 1, current + 1}
else
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    local retryAfter = oldest[2] and (tonumber(oldest[2]) + windowMs - now) or windowMs
    return {1, retryAfter, current}
end
`;

// ── In-process fallback ──────────────────────────────────────────────────────
const localStore = new Map<string, number[]>();

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of localStore) {
        const valid = timestamps.filter((t) => t > now - GLOBAL_AGGREGATE.windowMs);
        if (valid.length === 0) localStore.delete(key);
        else localStore.set(key, valid);
    }
}, 60_000).unref();

/**
 * Express middleware enforcing the global aggregate rate limit.
 */
export async function aggregateRateLimit(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    if (process.env.NODE_ENV === "test") return next();

    const ip = req.ip ?? "unknown";
    const key = `${GLOBAL_AGGREGATE.prefix}:${ip}`;
    const { windowMs, maxRequests } = GLOBAL_AGGREGATE;

    let allowed: boolean;
    let retryAfter: number;
    let currentCount: number;

    if (redisClient.isOpen) {
        try {
            const result = (await redisClient.eval(LUA_AGGREGATE_CHECK, {
                keys: [key],
                arguments: [String(Date.now()), String(windowMs), String(maxRequests)],
            })) as number[];
            allowed = result[0] === 0;
            retryAfter = result[1];
            currentCount = result[2];
        } catch (err) {
            logger.error("[aggregateRateLimit] Redis eval failed, allowing request", {
                error: String(err),
            });
            return next();
        }
    } else {
        const now = Date.now();
        const timestamps = localStore.get(key) ?? [];
        const valid = timestamps.filter((t) => t > now - windowMs);
        currentCount = valid.length;
        if (currentCount < maxRequests) {
            valid.push(now);
            localStore.set(key, valid);
            allowed = true;
            retryAfter = 0;
        } else {
            allowed = false;
            retryAfter = valid[0] + windowMs - now;
        }
    }

    // Standard headers
    const remaining = Math.max(0, maxRequests - currentCount);
    const resetTime = Math.ceil((Date.now() + (retryAfter || windowMs)) / 1000);
    res.setHeader("X-Aggregate-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-Aggregate-RateLimit-Remaining", String(remaining));
    res.setHeader("X-Aggregate-RateLimit-Reset", String(resetTime));

    if (!allowed) {
        const retrySec = Math.ceil(retryAfter / 1000);
        res.setHeader("Retry-After", String(retrySec));
        logger.warn("[aggregateRateLimit] Global aggregate limit exceeded", { ip, currentCount });
        res.status(429).json({
            error: "Global rate limit exceeded. Please slow down.",
            retryAfter: retrySec,
        });
        return;
    }

    return next();
}

// ── Progressive penalty helpers (exported for use by slidingWindowRateLimit) ──

/**
 * Check whether a given IP is currently blocked due to progressive
 * penalties.  Returns the remaining block time in milliseconds, or 0
 * if not blocked.
 */
export async function isBlocked(ip: string): Promise<number> {
    if (!redisClient.isOpen) return 0;
    try {
        const blockKey = `rl:block:${ip}`;
        const ttl = await redisClient.pttl(blockKey);
        return ttl > 0 ? ttl : 0;
    } catch {
        return 0;
    }
}

/**
 * Record a violation for the given IP and apply progressive block if
 * the threshold is reached.
 */
export async function recordViolation(ip: string): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        const key = `rl:violations:${ip}`;
        const count = await redisClient.incr(key);
        await redisClient.expire(key, 3600);

        if (count >= 20) {
            await redisClient.setEx(`rl:block:${ip}`, 6 * 3600, "1"); // 6 hours
            logger.warn("[aggregateRateLimit] IP blocked 6h", { ip, violations: count });
        } else if (count >= 10) {
            await redisClient.setEx(`rl:block:${ip}`, 3600, "1"); // 1 hour
            logger.warn("[aggregateRateLimit] IP blocked 1h", { ip, violations: count });
        } else if (count >= 5) {
            await redisClient.setEx(`rl:block:${ip}`, 300, "1"); // 5 minutes
            logger.warn("[aggregateRateLimit] IP blocked 5m", { ip, violations: count });
        }
    } catch (err) {
        logger.error("[aggregateRateLimit] Failed to record violation", { error: String(err) });
    }
}
