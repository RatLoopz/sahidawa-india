import { getRequestId } from "../middleware/requestId";
import logger from "./logger";

/**
 * Default timeout for outgoing service calls (milliseconds).
 */
export const SERVICE_TIMEOUT_MS = 15_000;

/**
 * A thin wrapper around the global `fetch` that automatically propagates the
 * current request's `x-request-id` header to downstream services.
 *
 * Usage is identical to `fetch()`:
 * ```ts
 * import { serviceFetch } from "../utils/serviceClient";
 * const res = await serviceFetch(`${mlUrl}/analyze`, { method: "POST", body });
 * ```
 *
 * The caller can still pass their own `x-request-id` header — the explicitly
 * supplied value takes precedence over the one from AsyncLocalStorage.
 */
export async function serviceFetch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const requestId = getRequestId();
    const headers = new Headers(init?.headers);

    // Only inject if the caller didn't already set one
    if (requestId && !headers.has("x-request-id")) {
        headers.set("x-request-id", requestId);
    }

    logger.debug("Outgoing service call", {
        url: typeof input === "string" ? input : input.toString(),
        method: init?.method ?? "GET",
        requestId,
    });

    return fetch(input, { ...init, headers });
}

export async function serviceFetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit,
    timeoutMs: number = SERVICE_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // If the caller supplied their own signal, abort our controller when it fires
    if (init?.signal) {
        init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
        return await serviceFetch(input, { ...init, signal: controller.signal });
    } catch (err) {
        if ((err as Error).name === "AbortError") {
            throw new Error(`Service request timed out after ${timeoutMs}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}
