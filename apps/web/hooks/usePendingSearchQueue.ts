"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSearchQueue, type QueuedSearch, removeFromSearchQueue } from "@/lib/db/searchQueue";
import { toast } from "sonner";

export function usePendingSearchQueue(onSync?: (query: string) => void | Promise<void>) {
    const [pendingSearches, setPendingSearches] = useState<QueuedSearch[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [executingId, setExecutingId] = useState<string | null>(null);
    const inFlightRef = useRef<string | null>(null);
    const processingOnlineRef = useRef(false);
    const onSyncRef = useRef(onSync);

    useEffect(() => {
        onSyncRef.current = onSync;
    }, [onSync]);

    const refresh = useCallback(async () => {
        try {
            setPendingSearches(await getSearchQueue());
        } catch (error) {
            toast.error("Could not load saved searches");
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const execute = useCallback(
        async (item: QueuedSearch) => {
            const sync = onSyncRef.current;
            if (!sync || inFlightRef.current !== null) return false;

            inFlightRef.current = item.id;
            setExecutingId(item.id);
            try {
                await sync(item.query);
            } catch {
                toast.error(`Could not run saved search: "${item.query}"`);
                return false;
            }

            try {
                await removeFromSearchQueue(item.id);
            } catch {
                toast.error(`Could not remove saved search: "${item.query}"`);
                return false;
            }

            setPendingSearches((current) => current.filter(({ id }) => id !== item.id));
            void refresh().catch(() => undefined);
            return true;
        },
        [refresh]
    );

    const executeWithLockRelease = useCallback(
        async (item: QueuedSearch) => {
            try {
                return await execute(item);
            } finally {
                if (inFlightRef.current === item.id) {
                    inFlightRef.current = null;
                    setExecutingId(null);
                }
            }
        },
        [execute]
    );

    useEffect(() => {
        void refresh().catch(() => undefined);

        const handleOnline = async () => {
            if (processingOnlineRef.current || inFlightRef.current) return;
            processingOnlineRef.current = true;
            setIsSyncing(true);
            try {
                const currentQueue = await getSearchQueue();
                if (currentQueue.length > 0) {
                    const mostRecent = [...currentQueue].sort(
                        (a, b) => b.timestamp - a.timestamp
                    )[0];
                    const succeeded = await executeWithLockRelease(mostRecent);
                    if (succeeded) {
                        toast.success(`Restored queued search: "${mostRecent.query}"`);
                    }
                }
            } catch {
                toast.error("Could not process saved searches");
            } finally {
                processingOnlineRef.current = false;
                setIsSyncing(false);
            }
        };

        window.addEventListener("online", handleOnline);

        return () => {
            window.removeEventListener("online", handleOnline);
        };
    }, [executeWithLockRelease, refresh]);

    return {
        pendingSearches,
        isSyncing,
        isLoading,
        executingId,
        execute: executeWithLockRelease,
        refresh,
    };
}
