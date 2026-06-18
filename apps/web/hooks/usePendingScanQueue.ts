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

        return () => {
            cleanup();
            window.removeEventListener("online", handleOnline);
        };
    }, [refresh, t]);

    return { pending, isSyncing, refresh };
}
