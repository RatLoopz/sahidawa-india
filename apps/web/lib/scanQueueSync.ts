import { verifyMedicine } from "@/lib/api";
import { getSyncQueue, removeFromSyncQueue } from "@/lib/db/syncQueue";
import { recordScanHistory } from "@/lib/scanHistoryUtils";
import { toast } from "sonner";

export function isNetworkFailure(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
        message.includes("offline") ||
        message.includes("network") ||
        message.includes("failed to fetch") ||
        message.includes("aborted") ||
        message.includes("timeout")
    );
}

export async function syncPendingScans(onSynced?: (count: number) => void): Promise<number> {
    if (typeof window === "undefined" || !navigator.onLine) return 0;

    const queue = await getSyncQueue();
    if (queue.length === 0) return 0;

    let synced = 0;

    for (const item of queue) {
        try {
            const result = await verifyMedicine(item.barcode);
            await recordScanHistory(result, item.barcode);
            await removeFromSyncQueue(item.id);
            synced++;

            // Notify user of result
            const medicineName = (result.verified && result.medicine.brand_name) || item.barcode;
            let title = "Medicine Verification";
            let body = "";
            let isCounterfeit = false;

            if (result.verified) {
                isCounterfeit = result.medicine.is_counterfeit_alert;
                if (isCounterfeit) {
                    body = `Counterfeit Alert: "${medicineName}" (Batch: ${result.medicine.batch_number}) is flagged as counterfeit!`;
                    toast.error(body, { duration: 6000 });
                } else {
                    body = `Verified: "${medicineName}" (Batch: ${result.medicine.batch_number}) is genuine.`;
                    toast.success(body);
                }
            } else {
                body = `Verification failed: Batch "${item.barcode}" could not be verified.`;
                toast.error(body);
            }

            // Web Notification if tab is hidden
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && document.hidden) {
                new Notification(isCounterfeit ? "⚠️ Counterfeit Alert!" : "✅ SahiDawa Verification", {
                    body,
                    icon: "/icons/icon-192.png",
                });
            }
        } catch (error) {
            if (!navigator.onLine || isNetworkFailure(error)) {
                break;
            }
            await removeFromSyncQueue(item.id);
        }
    }

    if (synced > 0 && onSynced) onSynced(synced);
    return synced;
}

let cleanupFn: (() => void) | null = null;

export function initScanQueueSync(onSynced?: (count: number) => void, onQueueChange?: () => void) {
    if (typeof window === "undefined") return () => {};
    if (cleanupFn) cleanupFn();

    const runSync = async () => {
        const synced = await syncPendingScans(onSynced);
        if (synced > 0 || onQueueChange) onQueueChange?.();
    };

    const handler = () => void runSync();
    window.addEventListener("online", handler);
    void runSync();

    cleanupFn = () => {
        window.removeEventListener("online", handler);
        cleanupFn = null;
    };
    return cleanupFn;
}
