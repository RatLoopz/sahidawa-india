import { supabase } from "../db/client";

export type LasaMatchType = "sound-alike" | "look-alike";

export interface LasaMatch {
    name: string;
    type: LasaMatchType;
    score?: number;
}

// ── In-process TTL cache ────────────────────────────────────────────────────
//
// The find_lasa_conflicts RPC performs string-distance comparisons across the
// full medicines table. Calling it on every request without a cache exhausts
// the Supabase connection pool under concurrent load.
//
// Caching strategy:
// - Cache key: normalized (trimmed, lower-cased) medicine name.
// - Cache value: the resolved LasaMatch[] result.
// - TTL: 5 minutes. LASA conflict lists change only when the medicines
//   dataset is updated, so a short TTL is safe.
// - Race condition prevention: inflight requests for the same key share a
//   single Promise stored in `inFlight`. When two concurrent requests for
//   the same name arrive before the first resolves, the second awaits the
//   same Promise rather than issuing a second RPC call. This eliminates the
//   TOCTOU window where two requests both miss the cache and both hit the DB.

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;
const MAX_INFLIGHT = 100;

interface CacheEntry {
    value: LasaMatch[];
    expiresAt: number;
}

interface LasaConflictRow {
    name: string;
    match_type: LasaMatchType;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<LasaMatch[]>>();

function getCached(key: string): LasaMatch[] | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

function setCached(key: string, value: LasaMatch[]): void {
    if (cache.size >= MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
            cache.delete(oldestKey);
        }
    }
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Service ─────────────────────────────────────────────────────────────────

export const detectLasaConflicts = async (medicineName: string): Promise<LasaMatch[]> => {
    const targetName = medicineName.trim();

    if (!targetName) return [];

    const cacheKey = targetName.toLowerCase();

    // Return immediately if a valid cached result exists.
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // If another request for the same name is already in progress, await its
    // result instead of issuing a duplicate RPC call (prevents TOCTOU race).
    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const promise = (async (): Promise<LasaMatch[]> => {
        try {
            const { data, error } = await supabase.rpc("find_lasa_conflicts", {
                target_name: targetName,
            });

            if (error) {
                throw new Error(`Failed to check LASA conflicts: ${error.message}`);
            }

            const result: LasaMatch[] = (data || []).map((row: LasaConflictRow) => ({
                name: row.name,
                type: row.match_type,
                score: row.match_type === "sound-alike" ? 1.0 : 0.85,
            }));

            setCached(cacheKey, result);
            return result;
        } finally {
            inFlight.delete(cacheKey);
        }
    })();

    inFlight.set(cacheKey, promise);
    return promise;
};

export const clearLasaCache = (): void => {
    cache.clear();
    inFlight.clear();
};
