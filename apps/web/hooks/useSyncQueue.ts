import { useState, useEffect } from "react";
import { useOfflineStatus } from "./useOfflineStatus";

export const useSyncQueue = () => {
    const { isOffline } = useOfflineStatus();
    const [pendingCount, setPendingCount] = useState(0);

    const checkQueue = () => {
        if (typeof window === "undefined") return;

        const req = indexedDB.open("sahidawa-sync-db", 1);
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
    };

    useEffect(() => {
        checkQueue();

        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === "SYNC_QUEUE_FLUSHED") {
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
    }, []);

    useEffect(() => {
        if (!isOffline && pendingCount > 0) {
            const timer = setTimeout(() => {
                checkQueue();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOffline, pendingCount]);

    return { pendingCount, isOffline };
};
