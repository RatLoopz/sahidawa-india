import { VerifyResult } from "@/lib/api";
import { saveScanHistory } from "@/lib/db/scanHistory";
import { syncScanHistoryWithCloud } from "@/lib/scanHistoryCloudSync";

export function getScanHistoryStatus(result: VerifyResult): string {
    if (!result.verified) return "SUSPICIOUS";
    return result.medicine.is_counterfeit_alert ? "FAKE" : "VERIFIED";
}

export function getScanHistoryMedicineName(
    result: VerifyResult,
    fallbackBrandName?: string
): string {
    if (result.verified) {
        return result.medicine.brand_name || fallbackBrandName || "Unknown medicine";
    }
    return fallbackBrandName || "Unknown medicine";
}

export async function recordScanHistory(result: VerifyResult, fallbackBrandName?: string) {
    await saveScanHistory({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        medicineName: getScanHistoryMedicineName(result, fallbackBrandName),
        status: getScanHistoryStatus(result),
    });

    void syncScanHistoryWithCloud().catch(() => {
        // Cloud sync is best-effort and must not block scan results.
    });
}

/**
 * Records the verification result of an offline-queued scan that has just been
 * synced, updating the linked PENDING history row in place.
 *
 * Uses the queue item's own id and original scan timestamp so the row keeps its
 * chronological position. This prevents an older offline scan that happens to
 * sync later from being stamped with the sync time and showing up as the newest
 * verification (which would overwrite a newer result in history).
 */
export async function recordSyncScanHistory(
    id: string,
    timestamp: number,
    result: VerifyResult,
    fallbackBrandName?: string
) {
    await saveScanHistory({
        id,
        timestamp,
        medicineName: getScanHistoryMedicineName(result, fallbackBrandName),
        status: getScanHistoryStatus(result),
    });

    void syncScanHistoryWithCloud().catch(() => {
        // Cloud sync is best-effort and must not block scan results.
    });
}
