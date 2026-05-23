/**
 * API retry mechanism with exponential backoff
 * Handles offline scenarios and automatic retries when connection is restored
 */

export interface RetryConfig {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error | Response, attemptNumber: number) => boolean;
}

export interface FetchOptions extends RequestInit {
    timeout?: number;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    shouldRetry: (error: Error | Response, attemptNumber: number) => {
        // Don't retry on 400/401/403 errors
        if (error instanceof Response) {
            const status = error.status;
            if ([400, 401, 403, 404].includes(status)) {
                return false;
            }
        }
        return attemptNumber <= 3;
    },
};

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attemptNumber: number, config: Required<RetryConfig>): number {
    const exponentialDelay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1),
        config.maxDelayMs
    );

    // Add jitter (±10%)
    const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);
    return Math.max(0, exponentialDelay + jitter);
}

/**
 * Fetch wrapper with retry logic and timeout support
 */
export async function fetchWithRetry(
    url: string,
    options: FetchOptions = {},
    retryConfig: RetryConfig = {}
): Promise<Response> {
    const config = { ...DEFAULT_CONFIG, ...retryConfig };
    const timeout = options.timeout || 10000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    // Check if we should retry based on status code
                    if (
                        attempt <= config.maxRetries &&
                        config.shouldRetry(new Response(null, { status: response.status }), attempt)
                    ) {
                        const delay = getBackoffDelay(attempt, config);
                        await sleep(delay);
                        continue;
                    }

                    return response;
                }

                return response;
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Handle offline/network errors
            const isNetworkError =
                error instanceof Error &&
                (error.name === "TypeError" ||
                    error.name === "AbortError" ||
                    error.message.includes("fetch"));

            const isTimeoutError = error instanceof Error && error.name === "AbortError";

            const shouldRetry = config.shouldRetry(lastError, attempt);

            // Don't retry if we're on last attempt or shouldn't retry
            if (attempt > config.maxRetries || !shouldRetry) {
                throw lastError;
            }

            // Calculate backoff delay
            const delay = getBackoffDelay(attempt, config);

            // Log retry attempt in development
            if (process.env.NODE_ENV === "development") {
                console.log(
                    `[API Retry] Attempt ${attempt}/${config.maxRetries + 1} failed. ` +
                        `Retrying in ${Math.round(delay)}ms... Error: ${lastError.message}`
                );
            }

            // Wait before retrying
            await sleep(delay);
        }
    }

    throw lastError || new Error("All retry attempts failed");
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Request queue for failed requests when offline
 * These requests will be retried when connection is restored
 */
class OfflineRequestQueue {
    private queue: Array<{
        id: string;
        url: string;
        options: FetchOptions;
        timestamp: number;
        retryCount: number;
    }> = [];

    private listeners: Set<() => void> = new Set();

    /**
     * Add a request to the queue (when offline)
     */
    add(url: string, options: FetchOptions): string {
        const id = `${Date.now()}-${Math.random()}`;
        this.queue.push({
            id,
            url,
            options,
            timestamp: Date.now(),
            retryCount: 0,
        });
        return id;
    }

    /**
     * Remove a request from the queue
     */
    remove(id: string): void {
        this.queue = this.queue.filter((req) => req.id !== id);
    }

    /**
     * Get all queued requests
     */
    getAll() {
        return [...this.queue];
    }

    /**
     * Clear the queue
     */
    clear(): void {
        this.queue = [];
    }

    /**
     * Register listener for queue changes
     */
    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify listeners of queue changes
     */
    private notify(): void {
        this.listeners.forEach((listener) => listener());
    }
}

export const offlineRequestQueue = new OfflineRequestQueue();
