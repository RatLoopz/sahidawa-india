import { useState, useCallback, useEffect } from "react";
import { API_BASE, getCsrfToken } from "@/lib/api";
import { toast } from "sonner";
import { Alert } from "@/app/[locale]/alerts/page";

export interface UseAlertsParams {
    debouncedBrandSearch: string;
    debouncedRegionSearch: string;
    refreshTrigger: number;
}

export function useAlerts({
    debouncedBrandSearch,
    debouncedRegionSearch,
    refreshTrigger,
}: UseAlertsParams) {
    const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);

    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const fetchAlerts = useCallback(
        async (pageNum: number, append = false) => {
            try {
                let url = `${API_BASE}/api/v1/alerts?page=${pageNum}&limit=50`;
                if (debouncedBrandSearch)
                    url += `&brand=${encodeURIComponent(debouncedBrandSearch)}`;
                if (debouncedRegionSearch)
                    url += `&region=${encodeURIComponent(debouncedRegionSearch)}`;

                const res = await fetch(url);
                if (!res.ok) {
                    setError(true);
                    return;
                }
                const data = await res.json();

                if (append) {
                    setAllAlerts((prev) => [...prev, ...(data.data || [])]);
                } else {
                    setAllAlerts(data.data || []);
                }

                setTotalCount(data.totalCount || 0);
                setHasMore(pageNum * 50 < (data.totalCount || 0));
            } catch {
                setError(true);
            }
        },
        [debouncedBrandSearch, debouncedRegionSearch]
    );

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setPage(1);
            setHasMore(true);
            setError(false);
            await fetchAlerts(1, false);
            setLoading(false);
        };

        const timer = setTimeout(loadData, 400);
        return () => clearTimeout(timer);
    }, [fetchAlerts, refreshTrigger]);

    useEffect(() => {
        if (page > 1 && !loading) {
            const loadMore = async () => {
                setLoadingMore(true);
                await fetchAlerts(page, true);
                setLoadingMore(false);
            };
            loadMore();
        }
    }, [page, fetchAlerts, loading]);

    const snoozeAlert = async (id: string, days: number = 7) => {
        try {
            // Optimistic update
            setAllAlerts((prev) => prev.filter((alert) => alert.id !== id));
            setTotalCount((prev) => Math.max(0, prev - 1));

            const csrfToken = await getCsrfToken();
            const res = await fetch(`${API_BASE}/api/v1/alerts/${id}/snooze`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-token": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify({ days }),
            });

            if (!res.ok) {
                // If it fails, we might want to revert the optimistic update, but keeping it simple for now
                throw new Error("Failed to snooze alert");
            }

            toast.success(`Alert snoozed for ${days} days`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to snooze alert. Please try again.");
            // Re-fetch to revert optimistic update
            fetchAlerts(1, false);
        }
    };

    return {
        allAlerts,
        loading,
        loadingMore,
        error,
        page,
        setPage,
        totalCount,
        hasMore,
        snoozeAlert,
    };
}
