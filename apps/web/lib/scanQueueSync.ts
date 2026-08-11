import { verifyMedicine, ApiHttpError } from "@/lib/api";
import { getSyncQueue, removeFromSyncQueue } from "@/lib/db/syncQueue";
import { recordSyncScanHistory } from "@/lib/scanHistoryUtils";
import { toast } from "sonner";

function extractHttpStatus(error: unknown): number | undefined {
    if (error instanceof ApiHttpError) {
        return error.status;
    }
    if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
    ) {
        return (error as { status: number }).status;
    }
    return undefined;
}

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

export function isRetryableSyncFailure(error: unknown): boolean {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && !navigator.onLine) {
        return true;
    }
    if (isNetworkFailure(error)) {
        return true;
    }
    const status = extractHttpStatus(error);
    if (status !== undefined) {
        if (status === 408 || status === 429 || (status >= 500 && status <= 599)) {
            return true;
        }
    }
    return false;
}

export function isKnownPermanentFailure(error: unknown): boolean {
    const status = extractHttpStatus(error);
    if (status !== undefined) {
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            return true;
        }
    }
    return false;
}

export async function syncPendingScans(onSynced?: (count: number) => void): Promise<number> {
    if (typeof window === "undefined" || !navigator.onLine) return 0;

    // Guard against overlapping flushes (e.g. the window's "online" event and the
    // service worker's FLUSH_SYNC_QUEUE message firing at the same time). Two
    // concurrent loops would verify and remove entries twice and race on the
    // history rows. Only one sync may run at a time. The lock is claimed BEFORE
    // any await so two calls racing on the same tick can't both acquire it.
    if (syncInProgress) return 0;
    syncInProgress = true;

    let synced = 0;

    try {
        const queue = await getSyncQueue();
        if (queue.length === 0) return 0;

        // getSyncQueue() returns items sorted oldest-first by timestamp, so queued
        // scans are processed deterministically in the order they were scanned.
        for (const item of queue) {
            try {
                const result = await verifyMedicine(item.barcode, undefined, item.apiUrl);
                // Update the linked PENDING history row in place, preserving the
                // original scan timestamp, so an older scan can never overwrite a
                // newer verification and each medicine keeps its correct result.
                await recordSyncScanHistory(item.id, item.timestamp, result, item.barcode);
                await removeFromSyncQueue(item.id);
                synced++;

                // Notify user of result
                const medicineName =
                    (result.verified && result.medicine.brand_name) || item.barcode;
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
                if (
                    typeof window !== "undefined" &&
                    "Notification" in window &&
                    Notification.permission === "granted" &&
                    document.hidden
                ) {
                    new Notification(
                        isCounterfeit ? "⚠️ Counterfeit Alert!" : "✅ SahiDawa Verification",
                        {
                            body,
                            icon: "/icons/icon-192.png",
                        }
                    );
                }
            } catch (error) {
                if (isRetryableSyncFailure(error)) {
                    break;
                }
                if (isKnownPermanentFailure(error)) {
                    await removeFromSyncQueue(item.id);
                    continue;
                }
                console.error(`[scanQueueSync] Unknown error syncing scan item ${item.id}:`, error);
                break;
            }
        }
    } finally {
        // Always release the lock so subsequent online events can retry.
        syncInProgress = false;
    }

    if (synced > 0 && onSynced) onSynced(synced);
    return synced;
}

let syncInProgress = false;
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
