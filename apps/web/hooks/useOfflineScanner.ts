"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { addToSyncQueue } from "@/lib/db/syncQueue";
import { saveScanHistory } from "@/lib/db/scanHistory";

export function useOfflineScanner() {
    const locale = useLocale();
    const t = useTranslations("ScanQueue");

    const queueBarcode = useCallback(
        async (barcode: string) => {
            const normalized = barcode.trim();
            if (!normalized) return false;

            await addToSyncQueue(normalized, locale);
            await saveScanHistory({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                medicineName: normalized,
                status: "PENDING",
            });
            toast.info(t("queued"));
            return true;
        },
        [locale, t]
    );

    return { queueBarcode };
}
