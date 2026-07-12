"use client";

import { Clock, Search } from "lucide-react";
import type { QueuedSearch } from "@/lib/db/searchQueue";

export function PendingSearchQueue({
    pending,
    isSyncing,
    isLoading,
    executingId,
    onExecute,
}: {
    pending: QueuedSearch[];
    isSyncing?: boolean;
    isLoading?: boolean;
    executingId?: string | null;
    onExecute: (item: QueuedSearch) => void | Promise<unknown>;
}) {
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

            {isLoading ? (
                <p className="text-sm text-blue-800/80 dark:text-blue-200/80">
                    Loading saved searches...
                </p>
            ) : pending.length === 0 ? (
                <p className="text-sm text-blue-800/80 dark:text-blue-200/80">
                    No saved offline searches
                </p>
            ) : (
                <ul className="space-y-2">
                    {pending.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-black/20"
                        >
                            <button
                                type="button"
                                onClick={() => void onExecute(item)}
                                disabled={executingId != null}
                                aria-label={`Run saved search for ${item.query}`}
                                className="flex min-w-0 cursor-pointer items-center gap-2 truncate rounded-md font-mono font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-wait disabled:opacity-60"
                            >
                                <Search size={14} className="shrink-0 text-blue-500" />
                                <span className="truncate">{item.query}</span>
                            </button>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-200">
                                <Clock size={12} />
                                {executingId === item.id ? "Running..." : "Pending"}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
