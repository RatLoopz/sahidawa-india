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

    const compositeKey = `${batchNumber}|${identifier.barcode_id || ""}|${identifier.brand_name || ""}`;

    // 1. Try batch-only cache key first (matches warmCache() format)
    try {
        const batchOnlyDrug = await getCachedDrug(batchNumber);
        if (batchOnlyDrug) {
            const matchesIdentifier =
                (!identifier.barcode_id || batchOnlyDrug.barcode_id === identifier.barcode_id) &&
                (!identifier.brand_name || batchOnlyDrug.brand_name === identifier.brand_name);
            if (matchesIdentifier) {
                logger.info(`Cache HIT (batch-only key) for drug batch: ${batchNumber}`);
                await incrementHitCount(batchOnlyDrug.id, batchOnlyDrug.brand_name || batchOnlyDrug.generic_name);
                return batchOnlyDrug;
            }
        }
    } catch (err) {
        logger.error(`Error checking batch-only cache for batch: ${batchNumber}`, err);
    }

    // 2. Try composite cache key
    try {
        const cachedDrug = await getCachedDrug(compositeKey);
        if (cachedDrug) {
            logger.info(`Cache HIT (composite key) for drug batch: ${compositeKey}`);
            return cachedDrug;
        }
    } catch (err) {
        logger.error(`Error checking composite cache for batch: ${compositeKey}`, err);
    }

    // 3. Cache miss, query PostgreSQL database
    logger.info(`Cache MISS for drug batch: ${compositeKey}. Querying database...`);
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
            await incrementHitCount(data.id, data.brand_name || data.generic_name);
            // Save under both keys so batch-only lookups (warmCache) and composite lookups both hit
            await setCachedDrug(batchNumber, data);
            await setCachedDrug(compositeKey, data);
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
