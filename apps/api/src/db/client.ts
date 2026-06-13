import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import logger from "../utils/logger";
import { CONNECTION_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, fetchWithRetry } from "./fetchUtils";

export const dbConfig = {
    isSupabaseOffline: false,
};

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
if (!process.env.SUPABASE_URL) {
    dotenv.config();
}

// ── Environment resolution ────────────────────────────────────────────────────

if (!process.env.SUPABASE_URL) {
    throw new Error(
        "Missing required environment variable: SUPABASE_URL. " +
            "Set it in your .env file (e.g. https://<project>.supabase.co)."
    );
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. " +
            "The API backend requires the service_role key to bypass RLS for server-side writes. " +
            "Do not use SUPABASE_ANON_KEY here — it is subject to RLS and will silently drop writes."
    );
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Connection pool config ────────────────────────────────────────────────────
// Supabase JS uses HTTP fetch under the hood (not raw pg sockets).
// We simulate pool-like behaviour by:
//   - Capping concurrent requests via a semaphore
//   - Enforcing a hard per-request timeout (connectionTimeoutMillis equivalent)
//   - Retrying transient network errors automatically

const MAX_CONNECTIONS = 20; // max concurrent DB requests
const IDLE_TIMEOUT_MS = 30_000; // 30 s — matches pg idleTimeoutMillis

// ── Semaphore (concurrency limiter) ──────────────────────────────────────────

class ConnectionPool {
    private active = 0;
    private queue: Array<() => void> = [];
    private readonly max: number;

    constructor(max: number) {
        this.max = max;
    }

    async acquire(): Promise<void> {
        if (this.active < this.max) {
            this.active++;
            return;
        }
        // Queue the request with a timeout
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const idx = this.queue.indexOf(resolver);
                if (idx !== -1) this.queue.splice(idx, 1);
                reject(
                    new Error(
                        `Database connection pool exhausted — waited ${IDLE_TIMEOUT_MS}ms for a free slot`
                    )
                );
            }, IDLE_TIMEOUT_MS);

            const resolver = () => {
                clearTimeout(timeout);
                this.active++;
                resolve();
            };

            this.queue.push(resolver);
        });
    }

    release(): void {
        this.active = Math.max(0, this.active - 1);
        const next = this.queue.shift();
        if (next) next();
    }

    get stats() {
        return { active: this.active, queued: this.queue.length, max: this.max };
    }
}

export const pool = new ConnectionPool(MAX_CONNECTIONS);

// ── Pool-aware fetch ──────────────────────────────────────────────────────────

async function pooledFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    await pool.acquire();
    try {
        return await fetchWithRetry(input, init);
    } finally {
        pool.release();
    }
}

// ── Supabase client ───────────────────────────────────────────────────────────

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
    global: {
        fetch: pooledFetch as typeof fetch,
    },
    auth: {
        persistSession: false, // server-side — no browser storage
        autoRefreshToken: false,
    },
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function gracefulShutdown(signal: string) {
    logger.warn(
        `Received ${signal} — waiting for ${pool.stats.active} active DB connection(s) to drain...`
    );

    const check = setInterval(() => {
        if (pool.stats.active === 0) {
            clearInterval(check);
            logger.info("All DB connections drained. Shutting down.");
            process.exit(0);
        }
    }, 200);

    // Force exit after 10 s if connections don't drain
    setTimeout(() => {
        clearInterval(check);
        logger.error("Forced shutdown — connections did not drain in time.");
        process.exit(1);
    }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Log pool exhaustion warnings
if (process.env.NODE_ENV !== "test") {
    setInterval(() => {
        const { active, queued, max } = pool.stats;
        if (queued > 0) {
            logger.warn(`DB pool pressure: ${active}/${max} active, ${queued} queued`);
        }
    }, 5_000);
}

// Quick check on startup to see if Supabase is offline
if (process.env.NODE_ENV !== "test") {
    const checkTimeout = AbortSignal.timeout ? AbortSignal.timeout(1500) : undefined;
    fetch(`${supabaseUrl}/auth/v1/health`, { signal: checkTimeout })
        .then((res) => {
            if (!res.ok) {
                dbConfig.isSupabaseOffline = true;
                logger.warn(
                    "Supabase database health check failed. Setting database state to offline fallback mode."
                );
            } else {
                logger.info("Supabase database health check passed. Supabase is online.");
            }
        })
        .catch(() => {
            dbConfig.isSupabaseOffline = true;
            logger.warn(
                "Supabase database is offline. Setting database state to offline fallback mode."
            );
        });
}
