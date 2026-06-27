import { supabase } from "../db/client";
import {
    getCachedDrug,
    setCachedDrug,
    incrementHitCount,
    incrementMissCount,
} from "./cache.service";
import logger from "../utils/logger";

/**
 * Looks up a drug by its batch number and an identifier (barcode or brand name).
 * It first checks the Redis cache. If missed, it queries the database and caches the result.
 */
export interface DrugLookupIdentifier {
    brand_name?: string;
    barcode_id?: string;
}

export async function lookupDrugByBatch(
    batchNumber: string,
    identifier: DrugLookupIdentifier
): Promise<any | null> {
    if (!identifier.brand_name && !identifier.barcode_id) {
        throw new Error("Either brand_name or barcode_id must be provided alongside batch_number");
    }

    const cacheKey = `${batchNumber}|${identifier.barcode_id || ""}|${identifier.brand_name || ""}`;

    // 1. Try to fetch from Redis cache
    try {
        const cachedDrug = await getCachedDrug(cacheKey);
        if (cachedDrug) {
            logger.info(`Cache HIT for drug batch: ${cacheKey}`);
            return cachedDrug;
        }
    } catch (err) {
        logger.error(`Error checking cache for batch: ${cacheKey}`, err);
    }

    // 2. Cache miss, query PostgreSQL database
    logger.info(`Cache MISS for drug batch: ${cacheKey}. Querying database...`);
    await incrementMissCount();

    try {
        let query = supabase
            .from("medicines")
            .select(
                "id, barcode_id, brand_name, generic_name, manufacturer, batch_number, manufacturing_date, expiry_date, cdsco_approval_status, is_counterfeit_alert, is_cdsco_verified, cdsco_match_score, matched_cdsco_product, matched_cdsco_manufacturer, product_match_score, manufacturer_match_score, manufacturer_id"
            )
            .eq("batch_number", batchNumber);

        if (identifier.barcode_id) {
            query = query.eq("barcode_id", identifier.barcode_id);
        } else if (identifier.brand_name) {
            query = query.eq("brand_name", identifier.brand_name);
        }

        const { data, error } = await query.limit(1).maybeSingle();

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
            await setCachedDrug(cacheKey, data);
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
