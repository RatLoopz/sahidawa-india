# PR #2486 — fix(security): replace in-memory rate limiter store with distributed …

> **Merged:** 2026-06-24 | **Author:** @PremSahith | **Area:** DevOps | **Impact Score:** 11 | **Closes:** #2485

## What Changed

We have replaced the default in-memory store for all `express-rate-limit` instances within `apps/api/src/middleware/rateLimit.ts` with a distributed Redis-backed store. This change involved installing the `rate-limit-redis` package and introducing a `buildStore()` factory function that gracefully falls back to the in-memory store if our Redis client is not connected.

## The Problem Being Solved

Previously, all rate limiters in our `apps/api` service utilized `express-rate-limit`'s default `MemoryStore`. This store keeps rate limit counters in the Node.js process heap. In a horizontally scaled deployment, such as multiple Docker containers or Cloud Run instances, each API replica would maintain its own independent counter. This created a critical security vulnerability where an attacker could bypass all rate limits by simply distributing their requests across the different API replicas, effectively rendering our rate limiting ineffective in a production environment.

## Files Modified

- `apps/api/package.json`
- `apps/api/src/middleware/rateLimit.ts`
- `package-lock.json`

## Implementation Details

The core of this change resides in `apps/api/src/middleware/rateLimit.ts`.

1.  **Dependency Addition:** We added `rate-limit-redis` (version `^5.0.0`) as a dependency to `apps/api/package.json`. This package provides a `RedisStore` implementation compatible with `express-rate-limit`.
2.  **`buildStore` Factory Function:** A new function, `buildStore(prefix: string): Store | undefined`, was introduced.
    *   This function checks the connection status of our global `redisClient` (imported from `../utils/redis`) using `redisClient.isOpen`.
    *   If `redisClient.isOpen` is `true`, it instantiates and returns a new `RedisStore`.
        *   Crucially, the `sendCommand` option for `RedisStore` is set to `(...args: string[]) => redisClient.sendCommand(args)`. This adapts the `node-redis` v4 client's `sendCommand` method signature to the interface expected by `rate-limit-redis`, ensuring compatibility.
        *   A unique `prefix` (e.g., `rl:verify:`) is passed to `RedisStore` to ensure that different rate limiters use distinct key namespaces in Redis, preventing collisions.
    *   If `redisClient.isOpen` is `false` (e.g., during local development without a running Redis instance), the function logs a warning using our `logger` (imported from `../utils/logger`) indicating a fallback to `MemoryStore`. It then returns `undefined`, which instructs `express-rate-limit` to use its default in-memory store.
3.  **Limiter Updates:** All existing `express-rate-limit` instances in `apps/api/src/middleware/rateLimit.ts` were updated to use this new `buildStore` factory:
    *   `verifyLimiter` now uses `store: buildStore("verify")`.
    *   `batchLimiter` now uses `store: buildStore("batch")`.
    *   `limiter` (general-purpose) now uses `store: buildStore("general")`.
    *   `reportLimiter` now uses `store: buildStore("report")`.
    *   `lasaLimiter` now uses `store: buildStore("lasa")`.
    *   `scanQueryLimiter` now uses `store: buildStore("scan")`.
    *   `interactionCheckLimiter` now uses `store: buildStore("interactions")`.
    Each limiter is given a distinct prefix to ensure its counters are isolated in Redis.

## Technical Decisions

1.  **Choice of `rate-limit-redis`:** We chose `rate-limit-redis` because it is a widely adopted and well-maintained library specifically designed to integrate `express-rate-limit` with Redis. It provides a robust and performant solution for distributed rate limiting.
2.  **Leveraging Existing `redisClient`:** Instead of creating new Redis connections, we opted to reuse our existing `redisClient` instance from `../utils/redis`. This minimizes resource consumption and simplifies Redis connection management across the application.
3.  **`sendCommand` Adapter for `node-redis` v4:** The `rate-limit-redis` library was designed with older `node-redis` client versions in mind. Our system uses `node-redis` v4, which has a different method signature for sending commands. The `sendCommand: (...args: string[]) => redisClient.sendCommand(args)` adapter was a critical decision to bridge this compatibility gap without downgrading our Redis client or forking `rate-limit-redis`.
4.  **Graceful Fallback with `buildStore`:** The `buildStore` factory function with its conditional logic and warning message was a deliberate design choice to enhance developer experience. It allows contributors to run the API locally without needing a Redis instance, while ensuring that in production, where Redis is available, distributed rate limiting is active. This prevents local development hurdles from blocking progress.
5.  **Unique Redis Key Prefixes:** Assigning unique prefixes (e.g., `rl:verify:`, `rl:batch:`) to each `RedisStore` instance was essential to prevent different rate limiters from interfering with each other's counters in the shared Redis instance. This ensures the independence and correctness of each rate limiting policy.

## How To Re-Implement (Contributor Reference)

To re-implement this distributed rate limiting feature, a contributor would follow these steps:

1.  **Install Dependency:** Add `rate-limit-redis` to `apps/api/package.json` and run `npm install` to update `package-lock.json`.
    ```json
    // apps/api/package.json
    "dependencies": {
        // ... other dependencies
        "rate-limit-redis": "^5.0.0",
        "redis": "^6.0.0", // Ensure node-redis v4+ is present
        // ...
    }
    ```
2.  **Ensure Redis Client Availability:** Verify that an active `node-redis` v4 client instance, like our `redisClient` from `apps/api/src/utils/redis.ts`, is imported and available. This client must be connected for the `RedisStore` to function.
3.  **Create Store Factory:** Define a factory function, for example, `buildRateLimitStore`, in `apps/api/src/middleware/rateLimit.ts`:
    ```typescript
    import { Store } from "express-rate-limit";
    import { RedisStore } from "rate-limit-redis";
    import { redisClient } from "../utils/redis";
    import logger from "../utils/logger";

    function buildRateLimitStore(prefix: string): Store | undefined {
        if (redisClient.isOpen) {
            return new RedisStore({
                // Adapt node-redis v4 client's sendCommand method
                sendCommand: (...args: string[]) => redisClient.sendCommand(args),
                prefix: `rl:${prefix}:`, // Unique prefix for Redis keys
            });
        }
        logger.warn(
            `[rateLimit] Redis not connected — ${prefix} limiter falling back to MemoryStore. ` +
                "Rate limiting will NOT be shared across replicas."
        );
        return undefined; // `express-rate-limit` defaults to MemoryStore if `store` is undefined
    }
    ```
4.  **Apply to Rate Limiters:** For each `express-rate-limit` instance, add or update the `store` option to call the `buildRateLimitStore` factory with a descriptive, unique prefix:
    ```typescript
    import rateLimit from "express-rate-limit";
    // ... other imports including buildRateLimitStore

    export const myNewLimiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        store: buildRateLimitStore("myNewFeature"), // Apply the distributed store
        handler: (_req, res) => {
            res.status(429).json({
                error: "Too many requests for my new feature. Please try again later.",
            });
        },
    });
    ```
This pattern ensures that rate limits are consistently applied across all API instances when Redis is available, while providing a functional fallback for development environments.

## Impact on System Architecture

This change significantly impacts our system's architecture in several key areas:

1.  **Enhanced Scalability:** The `apps/api` service can now be horizontally scaled (e.g., deploying multiple instances on Cloud Run or Kubernetes) without compromising the effectiveness of our rate limiting. All replicas will share a single, consistent view of request counts via Redis, ensuring that global rate limits are enforced correctly.
2.  **Improved Security:** This resolves a critical security vulnerability related to rate limit bypass in distributed environments. It provides a more robust defense against Denial-of-Service (DoS) attacks and prevents abuse of unauthenticated or resource-intensive endpoints.
3.  **Increased Operational Resilience:** The `buildStore` factory's fallback mechanism ensures that the API remains functional even if our Redis service is temporarily unavailable. While rate limiting would revert to an in-memory, per-replica state in such a scenario, the service itself would not crash, maintaining basic availability.
4.  **Stronger Redis Dependency:** For effective rate limiting in production, the `apps/api` service now has a stronger, explicit dependency on a healthy and accessible Redis instance. This reinforces Redis as a critical component of our infrastructure for distributed state management.
5.  **Foundation for Future Features:** This establishes a pattern for using distributed stores with `express-rate-limit`, which can be extended to other middleware or services requiring shared state for security or performance.

## Testing & Verification

Our verification process for this change included:

1.  **TypeScript Compilation:** We confirmed that `npm run build -w apps/api` executed successfully with zero TypeScript errors, ensuring type safety and correct integration of the new `rate-limit-redis` package.
2.  **Redis Client Adaptation:** We verified that `rate-limit-redis` correctly adapted to our existing `node-redis` v4 client by using the `sendCommand` wrapper. This was crucial for ensuring that commands were correctly sent to Redis.
3.  **Unique Key Namespaces:** We confirmed that each limiter utilized a unique Redis key namespace (e.g., `rl:verify:`, `rl:report:`) as specified by the `prefix` option in `RedisStore`. This prevents key collisions and ensures independent operation of each rate limiting policy.
4.  Not documented in this PR: Specific functional tests demonstrating the blocking behavior of the rate limiters under high load in a distributed environment were not explicitly detailed in the proof of work. However, the underlying `express-rate-limit` and `rate-limit-redis` libraries are well-tested for their core functionality.