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

            // Determine API verification URL
            const mlUrl = process.env.NEXT_PUBLIC_ML_URL;
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
            const apiUrl = mlUrl
                ? `${mlUrl.replace(/\/+$/, "")}/verify/batch`
                : `${apiBase.replace(/\/+$/, "")}/api/verify`;

            // Collect device metadata
            const deviceMetadata = {
                userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "unknown",
                platform:
                    typeof window !== "undefined"
                        ? (window.navigator as any).userAgentData?.platform ||
                          window.navigator.platform
                        : "unknown",
                language: typeof window !== "undefined" ? window.navigator.language : "unknown",
            };

            const item = await addToSyncQueue(normalized, locale, apiUrl, deviceMetadata);
            // Use the queue item's id and timestamp for the PENDING history row so
            // that when the scan is synced later, the result updates THIS row in
            // place (transitioning PENDING -> VERIFIED/FAKE) instead of appending a
            // duplicate with the sync-time timestamp. This keeps the correct result
            // for each medicine and preserves the original scan time so an older
            // scan can never overwrite a newer verification in history.
            await saveScanHistory({
                id: item.id,
                timestamp: item.timestamp,
                medicineName: normalized,
                status: "PENDING",
            });

            // Request Notification permissions if needed
            if (
                typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "default"
            ) {
                void Notification.requestPermission();
            }

            // Register Background Sync if supported
            if (
                typeof navigator !== "undefined" &&
                "serviceWorker" in navigator &&
                "SyncManager" in window
            ) {
                try {
                    const reg = await navigator.serviceWorker.ready;
                    await (reg as any).sync.register("sahidawa-sync-scans");
                } catch (err) {
                    console.warn("Background Sync registration failed:", err);
                }
            }

            toast.info(t("queued"));
            return true;
        },
        [locale, t]
    );

    return { queueBarcode };
}
