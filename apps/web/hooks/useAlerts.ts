import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getCsrfToken } from "@/lib/api";
import { toast } from "sonner";
import { Alert } from "@/app/[locale]/alerts/page";

export interface UseAlertsParams {
    debouncedBrandSearch: string;
    debouncedRegionSearch: string;
}

export function useAlerts({ debouncedBrandSearch, debouncedRegionSearch }: UseAlertsParams) {
    const queryClient = useQueryClient();

    const fetchAlertsPage = async ({ pageParam = 1 }) => {
        let url = `${API_BASE}/api/v1/alerts?page=${pageParam}&limit=50`;
        if (debouncedBrandSearch) url += `&brand=${encodeURIComponent(debouncedBrandSearch)}`;
        if (debouncedRegionSearch) url += `&region=${encodeURIComponent(debouncedRegionSearch)}`;

        const res = await fetch(url);
        if (!res.ok) {
            throw new Error("Failed to fetch alerts");
        }
        return res.json();
    };

    const queryKey = ["alerts", debouncedBrandSearch, debouncedRegionSearch];

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
        useInfiniteQuery({
            queryKey,
            queryFn: fetchAlertsPage,
            getNextPageParam: (lastPage, allPages) => {
                const totalCount = lastPage?.totalCount || 0;
                const fetchedCount = allPages.length * 50;
                return fetchedCount < totalCount ? allPages.length + 1 : undefined;
            },
            initialPageParam: 1,
        });

    const snoozeAlertMutation = useMutation({
        mutationFn: async ({ id, days }: { id: string; days: number }) => {
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
                throw new Error("Failed to snooze alert");
            }
            return res.json();
        },
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey });

            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically update
            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        data: page.data ? page.data.filter((alert: Alert) => alert.id !== id) : [],
                        totalCount: Math.max(0, (page.totalCount || 1) - 1),
                    })),
                };
            });

            return { previousData };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(queryKey, context?.previousData);
            console.error(err);
            toast.error("Failed to snooze alert. Please try again.");
        },
        onSuccess: (data, variables) => {
            toast.success(`Alert snoozed for ${variables.days} days`);
        },
    });

    const snoozeAlert = (id: string, days: number = 7) => {
        snoozeAlertMutation.mutate({ id, days });
    };

    const allAlerts = data?.pages.flatMap((page) => page.data || []) || [];
    const totalCount = data?.pages[0]?.totalCount || 0;

    return {
        allAlerts,
        loading: isLoading,
        loadingMore: isFetchingNextPage,
        error: !!error,
        fetchNextPage,
        hasNextPage,
        totalCount,
        snoozeAlert,
        refetch,
    };
}
