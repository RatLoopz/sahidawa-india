"use client";

import { useCallback } from "react";
import { addToSyncQueue } from "@/lib/db/syncQueue";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function useOfflineScanner() {
    const t = useTranslations("ScanQueue");

    const processScan = useCallback(
        async (barcode: string, locale: string, verifyAction: (b: string) => Promise<any>) => {
            // 1. If explicitly offline, queue it immediately
            if (typeof navigator !== "undefined" && !navigator.onLine) {
                await addToSyncQueue(barcode, locale);
                toast.info(t("queued"));
                return { status: "queued", message: t("queued") };
            }

            try {
                // 2. Try online verification
                const result = await verifyAction(barcode);
                return { status: "verified", data: result };
            } catch (err) {
                // 3. If request fails due to network (flaky connection), queue it
                await addToSyncQueue(barcode, locale);
                toast.warning(t("queued"));
                return {
                    status: "queued",
                    message: t("queued"),
                    isFlaky: true,
                };
            }
        },
        [t]
    );

    return { processScan };
}
