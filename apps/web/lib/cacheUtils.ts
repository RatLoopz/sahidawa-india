/**
 * Generic Stale-While-Revalidate (SWR) cache factory with
 * concurrent Promise deduplication for client-side fetch operations.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface SWRCache<T> {
    get: (key: string, fetcher: () => Promise<T>) => Promise<T>;
    clear: (key?: string) => void;
}

/**
 * Creates a typed SWR cache instance.
 *
 * @param ttlMs   Time-to-live in milliseconds. Stale data older than
 *                this is served immediately while revalidating in background.
 * @returns       An object with `get` and `clear` methods.
 */
export function createSWRCache<T>(ttlMs: number = 60_000): SWRCache<T> {
    const cache = new Map<string, CacheEntry<T>>();
    const inFlight = new Map<string, Promise<T>>();

    const get = async (key: string, fetcher: () => Promise<T>): Promise<T> => {
        const now = Date.now();
        const cached = cache.get(key);

        // Fresh cache hit — return immediately, no network call
        if (cached && now - cached.timestamp < ttlMs) {
            return cached.data;
        }

        // Stale cache hit — return stale data immediately, revalidate in background
        if (cached && now - cached.timestamp >= ttlMs) {
            if (!inFlight.has(key)) {
                const revalidation = fetcher()
                    .then((data) => {
                        cache.set(key, { data, timestamp: Date.now() });
                        inFlight.delete(key);
                        return data;
                    })
                    .catch(() => {
                        inFlight.delete(key);
                        return cached.data;
                    });
                inFlight.set(key, revalidation);
            }
            return cached.data;
        }

        // In-flight deduplication — reuse existing Promise for same key
        if (inFlight.has(key)) {
            return inFlight.get(key)!;
        }

        // No cache — fetch fresh, deduplicate concurrent requests
        const promise = fetcher()
            .then((data) => {
                cache.set(key, { data, timestamp: Date.now() });
                inFlight.delete(key);
                return data;
            })
            .catch((err) => {
                inFlight.delete(key);
                throw err;
            });

        inFlight.set(key, promise);
        return promise;
    };

    const clear = (key?: string) => {
        if (key) {
            cache.delete(key);
            inFlight.delete(key);
        } else {
            cache.clear();
            inFlight.clear();
        }
    };

    return { get, clear };
}
