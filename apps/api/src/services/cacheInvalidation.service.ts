import { redisClient } from "../utils/redis";
import logger from "../utils/logger";

/**
 * Tag-based cache invalidation service.
 *
 * Uses Redis SCAN to find and invalidate cache keys matching patterns.
 * Supports table-level and prefix-based invalidation.
 *
 * Usage:
 *   await CacheInvalidation.invalidateByPrefix('medicine:');
 *   await CacheInvalidation.invalidateByPrefix('brand_cache:');
 */
export const CacheInvalidation = {
    /**
     * Invalidate all cache keys matching a prefix pattern.
     * Uses SCAN to avoid blocking the Redis event loop.
     *
     * @param prefix - The key prefix to match (e.g., 'medicine:', 'brand_cache:')
     * @param batchSize - Number of keys to process per SCAN iteration (default: 100)
     */
    async invalidateByPrefix(prefix: string, batchSize = 100): Promise<number> {
        if (!redisClient.isOpen) {
            logger.warn("Redis not connected — skipping cache invalidation", { prefix });
            return 0;
        }

        let totalDeleted = 0;
        let cursor = 0;

        try {
            do {
                const [newCursor, keys] = await redisClient.scan(cursor, {
                    MATCH: `${prefix}*`,
                    COUNT: batchSize,
                });
                cursor = newCursor;

                if (keys.length > 0) {
                    // Delete in chunks to avoid blocking the event loop
                    for (let i = 0; i < keys.length; i += 100) {
                        const chunk = keys.slice(i, i + 100);
                        await redisClient.del(chunk);
                        totalDeleted += chunk.length;
                    }
                }
            } while (cursor !== 0);

            if (totalDeleted > 0) {
                logger.info(
                    `Cache invalidation complete: deleted ${totalDeleted} keys matching "${prefix}*"`
                );
            }
        } catch (err) {
            logger.error("Cache invalidation failed", {
                prefix,
                error: String(err),
            });
        }

        return totalDeleted;
    },

    /**
     * Invalidate cache for a specific medicine by ID or name.
     * Clears all related cache entries: medicine details, search results, alternatives.
     */
    async invalidateMedicine(medicineId?: string, brandName?: string): Promise<void> {
        const prefixes = ["medicine:", "brand_cache:", "match_cache:", "ocr_extract:"];
        let totalDeleted = 0;

        for (const prefix of prefixes) {
            totalDeleted += await this.invalidateByPrefix(prefix);
        }

        // If a specific medicine ID is provided, also clear interaction caches
        if (medicineId) {
            totalDeleted += await this.invalidateByPrefix(`interactions:${medicineId}`);
        }

        if (brandName) {
            const normalized = brandName.trim().toLowerCase();
            totalDeleted += await this.invalidateByPrefix(`brand_cache:${normalized}`);
            totalDeleted += await this.invalidateByPrefix(`match_cache:${normalized}`);
        }

        if (totalDeleted > 0) {
            logger.info(`Medicine cache invalidated: ${totalDeleted} keys cleared`, {
                medicineId,
                brandName,
            });
        }
    },

    /**
     * Invalidate all pharmacy-related cache entries.
     */
    async invalidatePharmacies(): Promise<number> {
        return this.invalidateByPrefix("pharmacy:");
    },

    /**
     * Invalidate all alert-related cache entries.
     */
    async invalidateAlerts(): Promise<number> {
        return this.invalidateByPrefix("alerts:");
    },

    /**
     * Invalidate all cache entries matching a specific table name.
     * Useful when a table is updated and all related caches need clearing.
     */
    async invalidateTable(tableName: string): Promise<number> {
        const prefixMap: Record<string, string[]> = {
            medicines: ["medicine:", "brand_cache:", "match_cache:", "ocr_extract:"],
            pharmacies: ["pharmacy:"],
            drug_alerts: ["alerts:"],
            counterfeit_reports: ["reports:"],
            notification_subscribers: ["subscriber:"],
        };

        const prefixes = prefixMap[tableName] || [`${tableName}:`];
        let totalDeleted = 0;

        for (const prefix of prefixes) {
            totalDeleted += await this.invalidateByPrefix(prefix);
        }

        return totalDeleted;
    },

    /**
     * Flush all cache entries (use with caution — typically only in development).
     */
    async flushAll(): Promise<void> {
        if (!redisClient.isOpen) {
            logger.warn("Redis not connected — skipping flush");
            return;
        }

        try {
            await redisClient.flushAll();
            logger.warn("Redis cache flushed completely");
        } catch (err) {
            logger.error("Redis flush failed", { error: String(err) });
        }
    },
};
