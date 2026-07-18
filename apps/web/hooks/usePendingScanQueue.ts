"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getSyncQueue, type QueuedScan } from "@/lib/db/syncQueue";
import { initScanQueueSync, syncPendingScans } from "@/lib/scanQueueSync";

export function usePendingScanQueue() {
    const t = useTranslations("ScanQueue");
    const [pending, setPending] = useState<QueuedScan[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const refresh = useCallback(async () => {
        setPending(await getSyncQueue());
    }, []);

    useEffect(() => {
        void refresh();

        const cleanup = initScanQueueSync(
            (count) => {
                toast.success(t("synced", { count }));
            },
            () => {
                setIsSyncing(false);
                void refresh();
            }
        );

        const handleOnline = () => setIsSyncing(true);
        window.addEventListener("online", handleOnline);

        const handleMessage = (event: MessageEvent) => {
            if (!event.data) return;

            if (event.data.type === "FLUSH_SYNC_QUEUE") {
                // The service worker's actual Background Sync event fired.
                // Previously this only called refresh() (re-reading
                // IndexedDB for display) without ever running the real
                // verification sync, so Background Sync never did any
                // actual work unless the window's own 'online' listener
                // happened to fire too. Run the real sync now.
                setIsSyncing(true);
                void syncPendingScans((count) => {
                    if (count > 0) toast.success(t("synced", { count }));
                }).finally(() => {
                    setIsSyncing(false);
                    void refresh();
                });
                return;
            }

            if (event.data.type === "SYNC_QUEUE_UPDATED") {
                void refresh();
                setIsSyncing(false);
                if (event.data.count > 0) {
                    toast.success(t("synced", { count: event.data.count }));
                }
            }
        };

        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("message", handleMessage);
        }

        return () => {
            cleanup();
            window.removeEventListener("online", handleOnline);
            if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
                navigator.serviceWorker.removeEventListener("message", handleMessage);
            }
        };
    }, [refresh, t]);

    return { pending, isSyncing, refresh };
}
