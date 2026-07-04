import { supabase } from "../db/client";
import {
    getCachedDrug,
    setCachedDrug,
    incrementHitCount,
    incrementMissCount,
} from "./cache.service";
import logger from "../utils/logger";

/**
 * Thrown when both Redis and Supabase are unreachable during a drug lookup.
 * Route handlers should catch this and return 503.
 */
export class ServiceUnavailableError extends Error {
    public readonly code: string;

    constructor(message = "Service temporarily unavailable. Please try again later.") {
        super(message);
        this.name = "ServiceUnavailableError";
        this.code = "errors.serviceUnavailable";
    }
}

export interface DrugLookupIdentifier {
    brand_name?: string;
    barcode_id?: string;
}

/**
 * Looks up a drug by its batch number and an identifier (barcode or brand name).
 * Checks Redis cache first. On cache miss, queries Supabase and caches the result.
 *
 * Throws ServiceUnavailableError if both Redis and Supabase are unreachable,
 * so callers can return a clean 503 instead of crashing.
 */
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
                await incrementHitCount(
                    batchOnlyDrug.id,
                    batchOnlyDrug.brand_name || batchOnlyDrug.generic_name
                );
                return batchOnlyDrug;
            }
        }
    } catch (err) {
        logger.error(`Error checking batch-only cache for batch: ${batchNumber}`, err);
        // Non-fatal — fall through to composite key check
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
        // Non-fatal — fall through to DB lookup
    }

    // 3. Cache miss — query Supabase
    logger.info(`Cache MISS for drug batch: ${compositeKey}. Querying database...`);
    await incrementMissCount();

    let dbError: unknown = null;

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
            dbError = error;
            logger.error({
                message: "Database lookup failed in drugLookup service",
                error,
                batchNumber: batchNumber.replace(/[\r\n]/g, ""),
            });
            // Will be handled below
        } else {
            if (data) {
                await incrementHitCount(data.id, data.brand_name || data.generic_name);
                // Cache under both keys so batch-only and composite lookups both hit
                await setCachedDrug(batchNumber, data);
                await setCachedDrug(compositeKey, data);
            }
            return data;
        }
    } catch (err) {
        dbError = err;
        logger.error(
            `Unexpected error in lookupDrugByBatch for batch: ${batchNumber.replace(/[\r\n]/g, "")}`,
            err
        );
    }

    // 4. Both Redis and Supabase failed — throw ServiceUnavailableError
    // so the route handler can return a clean 503 instead of a raw 500
    throw new ServiceUnavailableError();
}
