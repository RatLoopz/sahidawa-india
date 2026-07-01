"use client";

import { useEffect, useState } from "react";
import { getSyncDB } from "@/lib/offline/db";

type Status = "synced" | "pending" | "syncing" | "failed";

export function ScanSyncStatus({ idempotencyKey }: { idempotencyKey: string }) {
    const [status, setStatus] = useState<Status>("pending");

    useEffect(() => {
        let mounted = true;
        async function poll() {
            try {
                const db = await getSyncDB();
                const entry = await db.get("pendingScans", idempotencyKey);
                if (!mounted) return;

                if (!entry) {
                    setStatus("synced");
                    return;
                }

                const hasFailed = Object.values(entry.parts).includes("failed");
                setStatus(hasFailed ? "failed" : "pending");
            } catch (err) {
                if (mounted) setStatus("failed");
            }
        }

        const interval = setInterval(poll, 2000);
        poll(); // Initial check

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [idempotencyKey]);

    const styles = {
        synced: "bg-green-100 text-green-800 border-green-200",
        pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
        syncing: "bg-blue-100 text-blue-800 border-blue-200",
        failed: "bg-red-100 text-red-800 border-red-200",
    };

    const label = {
        synced: "✅ Synced",
        pending: "⏳ Waiting to sync",
        syncing: "🔄 Syncing…",
        failed: "⚠️ Sync failed — will retry",
    }[status];

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
        >
            {label}
        </span>
    );
}
