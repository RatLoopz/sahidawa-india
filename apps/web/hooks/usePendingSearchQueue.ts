"use client";

import { useCallback, useEffect, useState } from "react";
import { getSearchQueue, type QueuedSearch, clearSearchQueue } from "@/lib/db/searchQueue";
import { toast } from "sonner";

export function usePendingSearchQueue(onSync?: (query: string) => void) {
    const [pendingSearches, setPendingSearches] = useState<QueuedSearch[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const refresh = useCallback(async () => {
        setPendingSearches(await getSearchQueue());
    }, []);

    useEffect(() => {
        void refresh();

        const handleOnline = async () => {
            setIsSyncing(true);
            const currentQueue = await getSearchQueue();
            if (currentQueue.length > 0) {
                // Sort by most recent first
                const sorted = currentQueue.sort((a, b) => b.timestamp - a.timestamp);
                const mostRecent = sorted[0];

                if (onSync) {
                    onSync(mostRecent.query);
                }

                toast.success(`Restored queued search: "${mostRecent.query}"`);

                await clearSearchQueue();
                void refresh();
            }
            setIsSyncing(false);
        };

        window.addEventListener("online", handleOnline);

        return () => {
            window.removeEventListener("online", handleOnline);
        };
    }, [refresh, onSync]);

    return { pendingSearches, isSyncing, refresh };
}
