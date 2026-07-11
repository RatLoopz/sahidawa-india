"use client";

import { Clock, Search } from "lucide-react";
import type { QueuedSearch } from "@/lib/db/searchQueue";
import { useTranslations } from "next-intl";

export function PendingSearchQueue({
    pending,
    isSyncing,
}: {
    pending: QueuedSearch[];
    isSyncing?: boolean;
}) {
    const t = useTranslations("ScanQueue"); // Reusing ScanQueue translations for stylistic consistency

    if (pending.length === 0) return null;

    return (
        <section
            aria-label="Pending Searches"
            className="mx-auto mb-4 w-full max-w-2xl rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-(--color-text-primary)"
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-bold text-blue-700 dark:text-blue-300">
                        Queued Searches
                    </h2>
                    <p className="text-xs text-blue-800/80 dark:text-blue-200/80">
                        Will execute when you are back online
                    </p>
                </div>
                {isSyncing && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs font-semibold text-blue-800 dark:text-blue-200">
                        Syncing...
                    </span>
                )}
            </div>

            <ul className="space-y-2">
                {pending.map((item) => (
                    <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-black/20"
                    >
                        <span className="flex items-center gap-2 truncate font-mono font-medium">
                            <Search size={14} className="text-blue-500" />
                            {item.query}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-200">
                            <Clock size={12} />
                            Pending
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
