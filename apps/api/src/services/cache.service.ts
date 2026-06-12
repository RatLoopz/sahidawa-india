import { supabase } from "../db/client";
import { hotDrugs } from "../db/seeds/hot_drugs_seed";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";

// TTL Tiers in seconds
export const TTL_TIERS = {
    HOT: 86400, // 24 hours
    WARM: 21600, // 6 hours
    COLD: 3600, // 1 hour
};

// Hit Thresholds
export const HIT_THRESHOLDS = {
    HOT: 50,
    WARM: 10,
};

// Key prefixes
export const KEY_PREFIXES = {
    DRUG_CACHE: "drug:batch:",
    DRUG_HITS: "hits:drug:",
};

/**
 * Warms the Redis cache by loading all medicines from database matching the hot drugs seed.
 */
export async function warmCache(): Promise<void> {
    if (!redisClient.isOpen) {
        logger.warn("Redis is not connected. Skipping cache warming.");
        return;
    }
    logger.info("Starting Redis cache warming...");
    try {
        const genericNames = hotDrugs.map((d) => d.genericName);
        const brandNames = hotDrugs.flatMap((d) => d.brandNames);

        const { data: genericMeds, error: error1 } = await supabase
            .from("medicines")
            .select(
                "id, barcode_id, brand_name, generic_name, manufacturer, batch_number, manufacturing_date, expiry_date, cdsco_approval_status, is_counterfeit_alert, manufacturer_id"
            )
            .in("generic_name", genericNames);

        const { data: brandMeds, error: error2 } = await supabase
            .from("medicines")
            .select(
                "id, barcode_id, brand_name, generic_name, manufacturer, batch_number, manufacturing_date, expiry_date, cdsco_approval_status, is_counterfeit_alert, manufacturer_id"
            )
            .in("brand_name", brandNames);

        const error = error1 || error2;

        let medicines: any[] = [];
        if (!error) {
            const allMeds = [...(genericMeds || []), ...(brandMeds || [])];
            const uniqueMeds = new Map();
            allMeds.forEach((m) => uniqueMeds.set(m.id, m));
            medicines = Array.from(uniqueMeds.values());
        }

        if (error) {
            logger.error("Failed to fetch medicines for cache warming", error);
            return;
        }

        if (!medicines || medicines.length === 0) {
            logger.info("No medicines found in database matching the hot seed list.");
            return;
        }

        logger.info(`Found ${medicines.length} medicine records to warm cache.`);

        let warmedCount = 0;
        for (const med of medicines) {
            if (med.batch_number) {
                const cacheKey = `${KEY_PREFIXES.DRUG_CACHE}${med.batch_number}`;
                await redisClient.set(cacheKey, JSON.stringify(med), {
                    EX: TTL_TIERS.HOT,
                });

                // Pre-seed hit counts for warmed drugs to hot threshold
                const hitKey = `${KEY_PREFIXES.DRUG_HITS}${med.id}`;
                const currentHits = await redisClient.get(hitKey);
                if (!currentHits) {
                    await redisClient.set(hitKey, String(HIT_THRESHOLDS.HOT));
                }
                warmedCount++;
            }
        }
        logger.info(`Successfully warmed ${warmedCount} drug cache entries.`);
    } catch (err) {
        logger.error("Error during cache warming", err);
    }
}

/**
 * Determines the TTL tier for a drug based on its lookup hit counts.
 */
export async function getTTLForDrug(drugId: string): Promise<number> {
    if (!redisClient.isOpen) {
        return TTL_TIERS.COLD;
    }
    try {
        const hitKey = `${KEY_PREFIXES.DRUG_HITS}${drugId}`;
        const hitsStr = await redisClient.get(hitKey);
        const hits = hitsStr ? parseInt(hitsStr, 10) : 0;

        if (hits >= HIT_THRESHOLDS.HOT) {
            return TTL_TIERS.HOT;
        }
        if (hits >= HIT_THRESHOLDS.WARM) {
            return TTL_TIERS.WARM;
        }
        return TTL_TIERS.COLD;
    } catch (err) {
        logger.error(`Error getting TTL for drug ${drugId}`, err);
        return TTL_TIERS.COLD;
    }
}

/**
 * Returns the corresponding TTL tier label ('hot' | 'warm' | 'cold') for a given TTL value.
 */
export function getTierFromTTL(ttl: number): "hot" | "warm" | "cold" {
    if (ttl >= TTL_TIERS.HOT) return "hot";
    if (ttl >= TTL_TIERS.WARM) return "warm";
    return "cold";
}

/**
 * Returns the TTL tier label ('hot' | 'warm' | 'cold') based on hit counts.
 */
export async function getTierForDrug(drugId: string): Promise<"hot" | "warm" | "cold"> {
    const ttl = await getTTLForDrug(drugId);
    return getTierFromTTL(ttl);
}

/**
 * Retrieves a drug from cache by batch number and increments its lookup hits counter.
 */
export async function getCachedDrug(batchNumber: string): Promise<any | null> {
    if (!redisClient.isOpen) return null;
    try {
        const cacheKey = `${KEY_PREFIXES.DRUG_CACHE}${batchNumber}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            const med = JSON.parse(cached);
            await incrementHitCount(med.id);
            return med;
        }
    } catch (err) {
        logger.error(`Error reading cache for batch ${batchNumber.replace(/[\r\n]/g, "")}`, err);
    }
    return null;
}

/**
 * Sets a drug in the cache with the appropriate tiered TTL based on its lookup hit counts.
 */
export async function setCachedDrug(batchNumber: string, medicine: any): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        const cacheKey = `${KEY_PREFIXES.DRUG_CACHE}${batchNumber}`;
        const ttl = await getTTLForDrug(medicine.id);
        await redisClient.set(cacheKey, JSON.stringify(medicine), {
            EX: ttl,
        });
    } catch (err) {
        logger.error(`Error setting cache for batch ${batchNumber.replace(/[\r\n]/g, "")}`, err);
    }
}

/**
 * Increments the hit counter for a drug in Redis.
 */
export async function incrementHitCount(drugId: string): Promise<number> {
    if (!redisClient.isOpen) return 0;
    try {
        const hitKey = `${KEY_PREFIXES.DRUG_HITS}${drugId}`;
        const count = await redisClient.incr(hitKey);
        return count;
    } catch (err) {
        logger.error(`Error incrementing hit count for drug ${drugId}`, err);
        return 0;
    }
}

/**
 * Invalidates cache entries for specified drug IDs (resolves to batch numbers and deletes).
 */
export async function invalidateDrugCache(drugIds: string[]): Promise<void> {
    if (!redisClient.isOpen || drugIds.length === 0) return;
    try {
        const cleanIds = drugIds.map((id) => id.replace("drug:", ""));
        const { data, error } = await supabase
            .from("medicines")
            .select("batch_number")
            .in("id", cleanIds);

        if (error) {
            logger.error("Failed to fetch batch numbers for invalidation", error);
            return;
        }

        if (data && data.length > 0) {
            const keysToDelete = data
                .map((row) => row.batch_number)
                .filter(Boolean)
                .map((batch) => `${KEY_PREFIXES.DRUG_CACHE}${batch}`);

            if (keysToDelete.length > 0) {
                await redisClient.del(keysToDelete);
                logger.info(
                    `Invalidated cache keys: ${keysToDelete.join(", ").replace(/[\r\n]/g, "")}`
                );
            }
        }
    } catch (err) {
        logger.error("Error invalidating cache", err);
    }
}
