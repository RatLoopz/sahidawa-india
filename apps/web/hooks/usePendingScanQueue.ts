"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getSyncQueue, type QueuedScan } from "@/lib/db/syncQueue";
import { initScanQueueSync } from "@/lib/scanQueueSync";

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
            if (event.data && (event.data.type === "SYNC_QUEUE_UPDATED" || event.data.type === "FLUSH_SYNC_QUEUE")) {
                void refresh();
                setIsSyncing(false);
                if (event.data.type === "SYNC_QUEUE_UPDATED" && event.data.count > 0) {
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
