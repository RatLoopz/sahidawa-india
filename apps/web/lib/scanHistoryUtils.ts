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
