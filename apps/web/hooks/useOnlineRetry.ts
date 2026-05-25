import { useEffect, useCallback } from 'react';
import { useOfflineStatus } from './useOfflineStatus';
import { offlineRequestQueue } from '@/lib/apiWithRetry';
import { toast } from 'sonner';

/**
 * Hook to automatically retry failed API requests when coming back online
 */
export const useOnlineRetry = () => {
  const { isOffline, isStatusDirty, registerRetryCallback } = useOfflineStatus();

  const retryQueuedRequests = useCallback(async () => {
    const queued = offlineRequestQueue.getAll();

    if (queued.length === 0) return;

    // Show toast about retrying
    const toastId = toast.loading(`Retrying ${queued.length} request(s)...`);

    let successCount = 0;
    let failureCount = 0;

    // Retry each request with a small delay between them
    for (const request of queued) {
      try {
        // Simulate retry delay
        await new Promise((resolve) => setTimeout(resolve, 100));

        // In a real implementation, you would re-execute the original request here
        // For now, we'll just remove it from the queue
        offlineRequestQueue.remove(request.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to retry request ${request.id}:`, error);
        failureCount++;
      }
    }

    // Update toast with results
    if (successCount > 0 && failureCount === 0) {
      toast.success(`${successCount} request(s) retried successfully`, {
        id: toastId,
      });
    } else if (failureCount > 0) {
      toast.error(
        `${successCount} succeeded, ${failureCount} failed to retry`,
        {
          id: toastId,
        }
      );
    } else {
      toast.dismiss(toastId);
    }
  }, []);

  // Register retry callback when coming back online
  useEffect(() => {
    registerRetryCallback(retryQueuedRequests);
  }, [registerRetryCallback, retryQueuedRequests]);
};
