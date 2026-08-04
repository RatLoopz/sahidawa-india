import { useState, useEffect, useCallback } from "react";
import { useOfflineStatus } from "./useOfflineStatus";

export const MUTATION_SYNC_TAG = "sahidawa-sync-mutations";

export interface RejectedSyncEntry {
    id: number;
    status: number;
    url: string;
    method: string;
    authFailure?: boolean;
    error?: string;
}

export const useSyncQueue = () => {
    const { isOffline } = useOfflineStatus();
    const [pendingCount, setPendingCount] = useState(0);
    const [rejected, setRejected] = useState<RejectedSyncEntry[]>([]);

    const checkQueue = useCallback(() => {
        if (typeof window === "undefined") return;

        const req = indexedDB.open("sahidawa-sync-db", 2);
        req.onsuccess = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("requests")) {
                setPendingCount(0);
                db.close();
                return;
            }
            try {
                const tx = db.transaction("requests", "readonly");
                const store = tx.objectStore("requests");
                const countReq = store.count();
                countReq.onsuccess = () => {
                    setPendingCount(countReq.result);
                };
                tx.oncomplete = () => db.close();
            } catch (err) {
                console.error("useSyncQueue: failed to read indexedDB requests count", err);
                db.close();
            }
        };
    }, []);

    /**
     * Re-trigger the background sync so queued actions — including ones the
     * server rejected earlier — are attempted again with fresh credentials.
     */
    const retry = useCallback(() => {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
        navigator.serviceWorker.ready
            .then((registration) => {
                const sync = (
                    registration as unknown as {
                        sync?: { register: (tag: string) => Promise<void> };
                    }
                ).sync;
                if (sync) {
                    return sync.register(MUTATION_SYNC_TAG);
                }
            })
            .then(() => {
                setRejected([]);
                checkQueue();
            })
            .catch(() => {
                // Background Sync unavailable — the next online event will retry.
            });
    }, [checkQueue]);

    /** Permanently remove a rejected action from the queue so it is not retried. */
    const discard = useCallback(
        (id: number) => {
            if (typeof window === "undefined") return;
            const req = indexedDB.open("sahidawa-sync-db", 2);
            req.onsuccess = (e: any) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("requests")) {
                    db.close();
                    return;
                }
                const tx = db.transaction("requests", "readwrite");
                tx.objectStore("requests").delete(id);
                tx.oncomplete = () => {
                    db.close();
                    setRejected((prev) => prev.filter((entry) => entry.id !== id));
                    checkQueue();
                };
            };
        },
        [checkQueue]
    );

    useEffect(() => {
        checkQueue();

        const handleMessage = (event: MessageEvent) => {
            if (!event.data) return;
            if (event.data.type === "SYNC_QUEUE_FLUSHED") {
                checkQueue();
            }
            if (event.data.type === "SYNC_QUEUE_REJECTED") {
                setRejected(event.data.entries ?? []);
                checkQueue();
            }
        };

        navigator.serviceWorker?.addEventListener("message", handleMessage);

        const interval = setInterval(() => {
            checkQueue();
        }, 5000);

        return () => {
            navigator.serviceWorker?.removeEventListener("message", handleMessage);
            clearInterval(interval);
        };
    }, [checkQueue]);

    useEffect(() => {
        if (!isOffline && pendingCount > 0) {
            const timer = setTimeout(() => {
                checkQueue();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOffline, pendingCount, checkQueue]);

    return { pendingCount, isOffline, rejected, retry, discard };
};
