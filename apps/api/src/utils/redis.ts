import Redis from "ioredis";
import logger from "./logger";

const redisUrl = process.env.REDIS_URL;

function isValidUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

// ioredis is used as the single Redis client library for both general operations
// and BullMQ. lazyConnect ensures the client does not connect until explicitly
// requested, matching the node-redis v4 lifecycle that existed before.
const client =
    redisUrl && isValidUrl(redisUrl)
        ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null })
        : new Redis({ lazyConnect: true, maxRetriesPerRequest: null });

client.on("error", (err) => {
    logger.error("Redis Client Error", err);
});

client.on("connect", () => {
    logger.info("Redis Client Connected successfully");
});

/**
 * Wrapper around the ioredis client that exposes the node-redis v4 API surface
 * used throughout the codebase. This eliminates the need to modify every file
 * that imports redisClient while consolidating on a single Redis library.
 */
export const redisClient = {
    // ── Status ─────────────────────────────────────────────────────────────────
    get isOpen() {
        return client.status === "ready";
    },

    // ── Connection lifecycle ───────────────────────────────────────────────────
    connect: () => client.connect(),
    quit: () => client.quit(),
    disconnect: () => client.disconnect(),

    // ── Basic string commands ──────────────────────────────────────────────────
    ping: () => client.ping(),
    get: (key: string) => client.get(key),
    del: (...args: (string | string[])[]) => {
        const keys = args.flat();
        return client.del(...keys);
    },
    incr: (key: string) => client.incr(key),
    expire: (key: string, seconds: number) => client.expire(key, seconds),
    getDel: (key: string) => client.getdel(key),
    ttl: (key: string) => client.ttl(key),
    pTTL: (key: string) => client.pttl(key),
    setEx: (key: string, seconds: number, value: string) => client.setex(key, seconds, value),

    /**
     * set with node-redis v4-style options object.
     * Supports: `{ EX: n }`, `{ NX: true }`, `{ PX: n }`, `{ NX: true, PX: n }`.
     */
    set: (
        key: string,
        value: string,
        options?: { EX?: number; NX?: boolean; PX?: number }
    ): Promise<"OK" | null> => {
        if (!options) return client.set(key, value);
        if (options.NX && options.PX !== undefined)
            return client.set(key, value, "PX", options.PX, "NX");
        if (options.NX) return client.set(key, value, "NX");
        if (options.EX !== undefined) return client.set(key, value, "EX", options.EX);
        if (options.PX !== undefined) return client.set(key, value, "PX", options.PX);
        return client.set(key, value);
    },

    /**
     * eval with node-redis v4-style options object.
     * Converts `{ keys: [...], arguments: [...] }` to ioredis's positional format.
     */
    eval: (
        script: string,
        options: { keys?: string[]; arguments?: (string | number)[] }
    ): Promise<unknown> => {
        const keys = options.keys ?? [];
        const args = options.arguments ?? [];
        return client.eval(script, keys.length, ...keys, ...args);
    },

    // ── Pub/Sub ────────────────────────────────────────────────────────────────
    publish: (channel: string, message: string) => client.publish(channel, message),

    // ── Sorted set commands ────────────────────────────────────────────────────
    zIncrBy: (key: string, increment: number, member: string) =>
        client.zincrby(key, increment, member),

    /**
     * Returns sorted set members with their scores as an array of
     * `{ value, score }` objects (matching node-redis v4's return format).
     * Supports `{ REV: true }` for reverse ordering (ZREVRANGE).
     */
    zRangeWithScores: async (
        key: string,
        min: number,
        max: number,
        options?: { REV?: boolean }
    ) => {
        const result = options?.REV
            ? await client.zrevrange(key, min, max, "WITHSCORES")
            : await client.zrange(key, min, max, "WITHSCORES");
        const pairs: Array<{ value: string; score: number }> = [];
        for (let i = 0; i < result.length; i += 2) {
            pairs.push({ value: result[i], score: Number(result[i + 1]) });
        }
        return pairs;
    },

    // ── Scan iterator ──────────────────────────────────────────────────────────
    /**
     * Async generator that yields individual keys matching the pattern,
     * compatible with node-redis v4's scanIterator API.
     * Supports both lowercase (`match`, `count`) and uppercase (`MATCH`, `COUNT`)
     * option keys to match existing codebase conventions.
     */
    scanIterator: async function* (options?: {
        match?: string;
        count?: number;
        MATCH?: string;
        COUNT?: number;
    }) {
        const match = options?.match ?? options?.MATCH;
        const count = options?.count ?? options?.COUNT;
        let cursor = 0;
        do {
            const scanArgs: (string | number)[] = [String(cursor)];
            if (match !== undefined) scanArgs.push("MATCH", match);
            if (count !== undefined) scanArgs.push("COUNT", count);
            const result = (await client.call("SCAN", ...scanArgs)) as [string, string[]];
            cursor = Number(result[0]);
            for (const key of result[1]) {
                yield key;
            }
        } while (cursor !== 0);
    },

    /**
     * Raw scan command returning `{ cursor, keys }` for code that uses
     * scan directly rather than through scanIterator.
     */
    scan: async (
        cursor: string | number,
        options?: { MATCH?: string; COUNT?: number; match?: string; count?: number }
    ) => {
        const match = options?.match ?? options?.MATCH;
        const count = options?.count ?? options?.COUNT;
        const scanArgs: (string | number)[] = [String(cursor)];
        if (match !== undefined) scanArgs.push("MATCH", match);
        if (count !== undefined) scanArgs.push("COUNT", count);
        const result = (await client.call("SCAN", ...scanArgs)) as [string, string[]];
        return { cursor: Number(result[0]), keys: result[1] };
    },

    // ── Raw command interface (for rate-limit-redis) ───────────────────────────
    sendCommand: (args: string[]) =>
        client.call(args[0], ...args.slice(1)) as Promise<
            boolean | number | string | (boolean | number | string)[]
        >,

    // ── Server commands ────────────────────────────────────────────────────────
    flushAll: () => client.flushall(),

    // ── Event emitter delegation ───────────────────────────────────────────────
    on: client.on.bind(client),
};

export async function connectRedis(): Promise<void> {
    if (!redisUrl) {
        logger.warn("REDIS_URL is not set. Redis caching will be unavailable.");
        return;
    }
    if (!redisClient.isOpen) {
        try {
            await client.connect();
        } catch (err) {
            logger.error("Failed to connect to Redis", err);
        }
    }
}
