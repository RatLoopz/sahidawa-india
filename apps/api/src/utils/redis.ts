import { createClient } from "redis";
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

export const redisClient =
    redisUrl && isValidUrl(redisUrl) ? createClient({ url: redisUrl }) : createClient();

redisClient.on("error", (err) => {
    logger.error("Redis Client Error", err);
});

redisClient.on("connect", () => {
    logger.info("Redis Client Connected successfully");
});

export async function connectRedis(): Promise<void> {
    if (!redisUrl) {
        logger.warn("REDIS_URL is not set. Redis caching will be unavailable.");
        return;
    }
    if (!redisClient.isOpen) {
        try {
            await redisClient.connect();
        } catch (err) {
            logger.error("Failed to connect to Redis", err);
        }
    }
}
