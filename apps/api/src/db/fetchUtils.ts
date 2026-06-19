import logger from "../utils/logger";

export const RESPONSE_TIMEOUT_MS = 15_000;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 500;

export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit,
    timeoutMs: number = RESPONSE_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
        if ((err as Error).name === "AbortError") {
            throw new Error(`Supabase request timed out after ${timeoutMs}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    retries = MAX_RETRIES,
    timeoutMs: number = RESPONSE_TIMEOUT_MS
): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fetchWithTimeout(input, init, timeoutMs);
        } catch (err) {
            const isLast = attempt === retries;
            const msg = err instanceof Error ? err.message : String(err);
            if (isLast) {
                logger.error(`Supabase fetch failed after ${retries} attempts: ${msg}`);
                throw err;
            }
            logger.warn(
                `Supabase fetch attempt ${attempt}/${retries} failed: ${msg}. Retrying in ${RETRY_DELAY_MS * attempt}ms...`
            );
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
    }
    throw new Error("Unexpected retry loop exit");
}
