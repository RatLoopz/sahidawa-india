import { redisClient } from "./redis";
import logger from "./logger";

export interface DistributedLock {
    key: string;
    ttlMs: number;
    value: string;
}

export function createLock(key: string, ttlMs: number): DistributedLock {
    return { key, ttlMs, value: `${process.env.HOSTNAME ?? "api"}:${process.pid}` };
}

export async function acquireLock(lock: DistributedLock, context: string): Promise<boolean> {
    if (!redisClient.isOpen) {
        logger.warn(`Redis not connected; skipping distributed lock for ${context}.`);
        return true;
    }
    try {
        const result = await redisClient.set(lock.key, lock.value, { NX: true, PX: lock.ttlMs });
        return result === "OK";
    } catch (err) {
        logger.error({ message: `Failed to acquire lock for ${context}`, error: err });
        return false;
    }
}

export async function releaseLock(lock: DistributedLock, context: string): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;
        await redisClient.eval(script, { keys: [lock.key], arguments: [lock.value] });
    } catch (err) {
        logger.error({ message: `Failed to release lock for ${context}`, error: err });
    }
}
