import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getCsrfToken } from "@/lib/api";
import { toast } from "sonner";
import { Alert } from "@/app/[locale]/alerts/page";
import { useSession } from "@/src/components/AuthProvider";
import { useState } from "react";

export interface UseAlertsParams {
    debouncedBrandSearch: string;
    debouncedRegionSearch: string;
}

export function useAlerts({ debouncedBrandSearch, debouncedRegionSearch }: UseAlertsParams) {
    const queryClient = useQueryClient();
    const { token } = useSession();

    // Pagination state
    const [page, setPage] = useState(1);

    const fetchAlertsPage = async () => {
        let url = `/api/v1/alerts?page=${page}&limit=50`;
        if (debouncedBrandSearch) url += `&brand=${encodeURIComponent(debouncedBrandSearch)}`;
        if (debouncedRegionSearch) url += `&region=${encodeURIComponent(debouncedRegionSearch)}`;

        const res = await fetch(url);
        if (!res.ok) {
            throw new Error("Failed to fetch alerts");
        }
        return res.json();
    };

    const queryKey = ["alerts", debouncedBrandSearch, debouncedRegionSearch, page];

    const { data, error, isLoading, isFetching, refetch } = useQuery({
        queryKey,
        queryFn: fetchAlertsPage,
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
                    data: old.data ? old.data.filter((alert: Alert) => alert.id !== id) : [],
                    totalCount: Math.max(0, (old.totalCount || 1) - 1),
                };
            });

            return { previousData };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(queryKey, context?.previousData);
            console.error(err);
            const message =
                err instanceof Error && err.message.includes("401")
                    ? "Your session expired. Please sign in again."
                    : "Failed to snooze alert. Please try again.";
            toast.error(message);
        },
        onSuccess: (data, variables) => {
            toast.success(`Alert snoozed for ${variables.days} days`);
        },
    });

    const snoozeAlert = (id: string, days: number = 7) => {
        if (!token) {
            toast.error("Please sign in to snooze alerts.");
            return;
        }
        snoozeAlertMutation.mutate({ id, days });
    };

    // Reset page to 1 if search filters change
    // Handled in the component typically, but we can also do it via useEffect here,
    // though it's safer to handle it where debounced values are defined or let the query handle it.

    const allAlerts: Alert[] = data?.data || [];
    const totalCount = data?.totalCount || 0;
    const totalPages = data?.totalPageCount || 1;
    const totalCriticalCount = data?.totalCriticalCount || 0;
    const totalImpactedRegionsCount = data?.totalImpactedRegionsCount || 0;

    return {
        allAlerts,
        loading: isLoading || isFetching,
        error: !!error,
        page,
        setPage,
        totalPages,
        totalCount,
        totalCriticalCount,
        totalImpactedRegionsCount,
        snoozeAlert,
        refetch,
    };
}
