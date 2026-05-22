import { createClient, SupabaseClient } from "@supabase/supabase-js";
import logger from "../utils/logger";

// Validate required environment variables at startup
if (!process.env.SUPABASE_URL) {
    throw new Error("Missing environment variable: SUPABASE_URL");
}
if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error("Missing environment variable: SUPABASE_ANON_KEY");
}

// ── Connection config ─────────────────────────────────────────────────────────

const CONNECTION_TIMEOUT_MS = 2_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// ── Fetch with timeout + retry ────────────────────────────────────────────────

async function fetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        CONNECTION_TIMEOUT_MS
    );

    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
        if ((err as Error).name === "AbortError") {
            throw new Error(
                `Supabase request timed out after ${CONNECTION_TIMEOUT_MS}ms`
            );
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    retries = MAX_RETRIES
): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fetchWithTimeout(input, init);
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

// ── Singleton client ──────────────────────────────────────────────────────────

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
    if (!supabaseInstance) {
        supabaseInstance = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!,
            {
                global: {
                    fetch: fetchWithRetry as typeof fetch,
                },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            }
        );
        logger.info("Supabase client initialized with connection timeout and retry config");
    }
    return supabaseInstance;
}

const supabase = getSupabaseClient();
export default supabase;