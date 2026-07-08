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
                platform: typeof window !== "undefined" ? (window.navigator as any).userAgentData?.platform || window.navigator.platform : "unknown",
                language: typeof window !== "undefined" ? window.navigator.language : "unknown",
            };

            await addToSyncQueue(normalized, locale, apiUrl, deviceMetadata);
            await saveScanHistory({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                medicineName: normalized,
                status: "PENDING",
            });

            // Request Notification permissions if needed
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                void Notification.requestPermission();
            }

            // Register Background Sync if supported
            if (typeof navigator !== "undefined" && "serviceWorker" in navigator && "SyncManager" in window) {
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
