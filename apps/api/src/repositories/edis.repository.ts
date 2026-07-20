import { redisClient } from "../utils/redis";
import logger from "../utils/logger";

export const redisRepository = {
    async get(key: string) {
        try {
            if (redisClient.isOpen) return await redisClient.get(key);
        } catch (err) {
            logger.warn(`Redis read error: ${err}`);
        }
        return null;
    },
    async set(key: string, value: string, ttlSeconds: number) {
        try {
            if (redisClient.isOpen) await redisClient.set(key, value, { EX: ttlSeconds });
        } catch (err) {
            logger.warn(`Redis write error: ${err}`);
        }
    },
};
