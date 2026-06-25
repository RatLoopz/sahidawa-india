import { toast } from "sonner";

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
        if (error && typeof error === "object" && "status" in error) {
            const status = (error as any).status;
            if ([400, 401, 403, 404].includes(status)) {
                return false;
            }
        }
        return attemptNumber <= 3;
    },
};

function getBackoffDelay(attemptNumber: number, config: Required<RetryConfig>): number {
    const exponentialDelay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1),
        config.maxDelayMs
    );
    const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);
    return Math.max(0, exponentialDelay + jitter);
}

export async function fetchWithRetry(
    url: string,
    options: FetchOptions = {},
    retryConfig: RetryConfig = {}
): Promise<Response> {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
        throw new Error("You are currently offline. Please check your internet connection.");
    }

    const config = { ...DEFAULT_CONFIG, ...retryConfig };

    // Extend timeout on slow networks — 2G users need more time
    const baseTimeout = options.timeout || 10000;
    const isSlowNetwork =
        typeof navigator !== "undefined" &&
        typeof (navigator as any).connection !== "undefined" &&
        (["slow-2g", "2g"].includes((navigator as any).connection?.effectiveType) ||
            (navigator as any).connection?.saveData === true);
    const timeout = isSlowNetwork ? Math.min(baseTimeout * 2, 30000) : baseTimeout;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        if (typeof window !== "undefined" && !window.navigator.onLine) {
            throw new Error("You are currently offline. Please check your internet connection.");
        }

        let isTimeout = false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            isTimeout = true;
            controller.abort();
        }, timeout);

        let listener: (() => void) | null = null;
        if (options.signal) {
            if (options.signal.aborted) {
                clearTimeout(timeoutId);
                throw options.signal.reason || new Error("Request was cancelled.");
            }
            listener = () => {
                controller.abort();
            };
            options.signal.addEventListener("abort", listener);
        }

        try {
            const fetchOptions = { ...options };
            delete fetchOptions.timeout;

            const response = await fetch(url, {
                ...fetchOptions,
                credentials: fetchOptions.credentials ?? "include",
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            if (listener && options.signal) {
                options.signal.removeEventListener("abort", listener);
            }

            if (!response.ok) {
                if (attempt <= config.maxRetries && config.shouldRetry(response, attempt)) {
                    const delay = getBackoffDelay(attempt, config);
                    await sleep(delay);
                    continue;
                }
                return response;
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (listener && options.signal) {
                options.signal.removeEventListener("abort", listener);
            }

            lastError = error instanceof Error ? error : new Error(String(error));

            if (options.signal?.aborted && !isTimeout) {
                throw lastError.name === "AbortError"
                    ? new Error("Request was cancelled.")
                    : lastError;
            }

            const shouldRetry = config.shouldRetry(lastError, attempt);

            if (attempt > config.maxRetries || !shouldRetry) {
                if (typeof window !== "undefined") {
                    toast.error("Network Request Failed. Please try again.");
                }
                if (isTimeout) {
                    throw new Error("Request timed out. Please try again.");
                }
                if (
                    lastError.name === "TypeError" &&
                    typeof window !== "undefined" &&
                    !window.navigator.onLine
                ) {
                    throw new Error(
                        "You are currently offline. Please check your internet connection."
                    );
                }
                throw lastError;
            }

            const delay = getBackoffDelay(attempt, config);

            if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
                console.log(
                    `[API Retry] Attempt ${attempt}/${config.maxRetries + 1} failed. ` +
                        `Retrying in ${Math.round(delay)}ms... Error: ${lastError.message}`
                );
            }

            await sleep(delay);
        }
    }

    throw lastError || new Error("All retry attempts failed");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const OFFLINE_QUEUE_STORAGE_KEY = "offline-request-queue";

class OfflineRequestQueue {
    private queue: Array<{
        id: string;
        url: string;
        options: FetchOptions;
        timestamp: number;
        retryCount: number;
    }> = [];

    private listeners: Set<() => void> = new Set();

    constructor() {
        if (typeof window === "undefined") return;

        try {
            const stored = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
            if (stored) {
                this.queue = JSON.parse(stored);
            }
        } catch {
            this.queue = [];
            this.persist();
        }
    }

    add(url: string, options: FetchOptions): string {
        const id = `${Date.now()}-${Math.random()}`;
        this.queue.push({
            id,
            url,
            options,
            timestamp: Date.now(),
            retryCount: 0,
        });
        this.persist();
        this.notify();
        return id;
    }

    remove(id: string): void {
        this.queue = this.queue.filter((req) => req.id !== id);
        this.persist();
        this.notify();
    }

    getAll() {
        return [...this.queue];
    }

    clear(): void {
        this.queue = [];
        this.persist();
        this.notify();
    }

    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private persist(): void {
        if (typeof window === "undefined") return;

        try {
            localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
        } catch {
            // Ignore storage failures
        }
    }

    private notify(): void {
        this.listeners.forEach((listener) => listener());
    }
}

export const offlineRequestQueue = new OfflineRequestQueue();
