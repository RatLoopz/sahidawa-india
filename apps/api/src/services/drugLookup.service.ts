import { supabase } from "../db/client";
import {
    getCachedDrug,
    setCachedDrug,
    incrementHitCount,
    incrementMissCount,
} from "./cache.service";
import logger from "../utils/logger";

/**
 * Looks up a drug by its batch number.
 * It first checks the Redis cache. If missed, it queries the database and caches the result.
 */
export async function lookupDrugByBatch(batchNumber: string): Promise<any | null> {
    // 1. Try to fetch from Redis cache
    try {
        const cachedDrug = await getCachedDrug(batchNumber);
        if (cachedDrug) {
            logger.info(`Cache HIT for drug batch: ${batchNumber}`);
            return cachedDrug;
        }
    } catch (err) {
        logger.error(`Error checking cache for batch: ${batchNumber}`, err);
    }

    // 2. Cache miss, query PostgreSQL database
    logger.info(`Cache MISS for drug batch: ${batchNumber}. Querying database...`);
    await incrementMissCount();

    try {
        const { data, error } = await supabase
            .from("medicines")
            .select(
                "id, barcode_id, brand_name, generic_name, manufacturer, batch_number, manufacturing_date, expiry_date, cdsco_approval_status, is_counterfeit_alert, manufacturer_id"
            )
            .eq("batch_number", batchNumber)
            .limit(1)
            .maybeSingle();

        if (error) {
            logger.error({
                message: "Database lookup failed in drugLookup service",
                error,
                batchNumber: batchNumber.replace(/[\r\n]/g, ""),
            });
            throw error;
        }

        if (data) {
            // Increment the hit count for the drug ID so that its TTL tier increases and update the top drugs sorted set
            await incrementHitCount(data.id, data.brand_name || data.generic_name);
            // Save the drug to cache with a tiered TTL determined dynamically
            await setCachedDrug(batchNumber, data);
        }

        return data;
    } catch (err) {
        logger.error(
            `Unexpected error in lookupDrugByBatch for batch: ${batchNumber.replace(/[\r\n]/g, "")}`,
            err
        );
        throw err;
    }
}
