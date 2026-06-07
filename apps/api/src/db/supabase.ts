import { createClient, SupabaseClient } from "@supabase/supabase-js";
import logger from "../utils/logger";
import { CONNECTION_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, fetchWithRetry } from "./fetchUtils";

// Validate required environment variables at startup
if (!process.env.SUPABASE_URL) {
    throw new Error("Missing environment variable: SUPABASE_URL");
}
if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error("Missing environment variable: SUPABASE_ANON_KEY");
}

// ── Singleton client ──────────────────────────────────────────────────────────

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
    if (!supabaseInstance) {
        supabaseInstance = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
            global: {
                fetch: fetchWithRetry as typeof fetch,
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
        logger.info("Supabase client initialized with connection timeout and retry config");
    }
    return supabaseInstance;
}

const supabase = getSupabaseClient();
export default supabase;
