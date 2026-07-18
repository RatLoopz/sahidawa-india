import { useEffect, useCallback } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineRequestQueue } from "@/lib/apiWithRetry";
import { toast } from "sonner";

/**
 * Hook to automatically retry failed API requests when coming back online
 */
export const useOnlineRetry = () => {
    const { registerRetryCallback, unregisterRetryCallback } = useOfflineStatus();

    const scheduleRetryRegistration = useCallback(
        (callback: () => void) => {
            void Promise.resolve().then(() => registerRetryCallback(callback));
        },
        [registerRetryCallback]
    );

    const retryQueuedRequests = useCallback(
        async function retryQueuedRequests() {
            const queued = offlineRequestQueue.getAll();

            if (queued.length === 0) {
                scheduleRetryRegistration(retryQueuedRequests);
                return;
            }

            // Show toast about retrying
            const toastId = toast.loading(`Retrying ${queued.length} request(s)...`);

            let successCount = 0;
            let failureCount = 0;

            // Retry each request and keep failures queued for a later attempt.
            for (const request of queued) {
                try {
                    const response = await fetch(request.url, { ...request.options });

                    if (!response.ok) {
                        throw new Error(`Server returned status ${response.status}`);
                    }
                    // Await the database removal to prevent batching race conditions
                    await offlineRequestQueue.remove(request.id);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to retry request ${request.id}:`, error);
                    failureCount++;
                }
            }

            // Update toast with results
            if (successCount > 0 && failureCount === 0) {
                toast.success(`All ${successCount} request(s) synced successfully`, {
                    id: toastId,
                });
            } else if (failureCount > 0) {
                toast.error(
                    `${successCount} synced, ${failureCount} failed to retry. Will attempt later.`,
                    {
                        id: toastId,
                    }
                );
            } else {
                toast.dismiss(toastId);
            }
            // Re-schedule registration only after processing current batch completely
            scheduleRetryRegistration(retryQueuedRequests);
        },
        [scheduleRetryRegistration]
    );

    // Register retry callback when coming back online
    useEffect(() => {
        registerRetryCallback(retryQueuedRequests);
        return () => unregisterRetryCallback(retryQueuedRequests);
    }, [registerRetryCallback, unregisterRetryCallback, retryQueuedRequests]);
};
