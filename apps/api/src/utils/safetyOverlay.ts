import logger from "./logger";

/**
 * Safety-critical medicine fields that must never be served stale. These drive
 * the "safe" vs "recalled"/"counterfeit" verdict shown to users on the
 * verification endpoints.
 */
export const SAFETY_OVERLAY_FIELDS = [
    "cdsco_approval_status",
    "is_counterfeit_alert",
    "is_cdsco_verified",
    "cdsco_match_score",
    "matched_cdsco_product",
    "matched_cdsco_manufacturer",
    "product_match_score",
    "manufacturer_match_score",
] as const;

/**
 * Overlays the latest safety-critical fields from the database onto a medicine
 * record that may have come from a cache snapshot.
 *
 * Lookup results (batch or brand) can be served from Redis with a TTL up to 24h,
 * and cache invalidation depends on external webhooks that can be missed. Reading
 * these fields live guarantees the verification endpoints always reflect the
 * latest safety state (new recalls, counterfeit flags, CDSCO changes) instead of
 * serving a stale "safe" result indefinitely. Falls back to the cached values if
 * the live read fails so the endpoint degrades gracefully.
 */
export async function refreshLiveSafety(client: any, data: any): Promise<void> {
    if (!data?.id) return;

    const { data: live, error } = await client
        .from("medicines")
        .select(SAFETY_OVERLAY_FIELDS.join(", "))
        .eq("id", data.id)
        .maybeSingle();

    if (error) {
        logger.error("Failed to refresh live safety status", {
            error,
            medicineId: data.id,
        });
        return;
    }

    if (live) {
        Object.assign(data, live);
    }
}
