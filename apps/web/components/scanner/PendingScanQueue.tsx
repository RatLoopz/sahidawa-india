"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QueuedScan } from "@/lib/db/syncQueue";

export function PendingScanQueue({
    pending,
    isSyncing,
}: {
    pending: QueuedScan[];
    isSyncing?: boolean;
}) {
    const t = useTranslations("ScanQueue");

    if (pending.length === 0) return null;

    return (
        <section
            aria-label={t("title")}
            className="mx-auto w-full max-w-sm rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-(--color-text-primary)"
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        {t("title")}
                    </h2>
                    <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                        {t("subtitle")}
                    </p>
                </div>
                {isSyncing && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                        {t("syncing", { count: pending.length })}
                    </span>
                )}
            </div>

            <ul className="space-y-2">
                {pending.map((item) => (
                    <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-black/20"
                    >
                        <span className="truncate font-mono font-medium">{item.barcode}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                            <Clock size={12} />
                            {t("pendingBadge")}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
