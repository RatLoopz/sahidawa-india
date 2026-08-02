import { supabase } from "../db/client";
import type { LasaMatch, LasaMatchType } from "@sahidawa/types";
import DoubleMetaphone from "natural/lib/natural/phonetics/double_metaphone";
import { LevenshteinDistance } from "natural/lib/natural/distance/levenshtein_distance";
import logger from "../utils/logger";

const doubleMetaphone = new DoubleMetaphone();

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

// ── Local phonetic fallback vocabulary ──────────────────────────────────────
// Used only when the primary Supabase RPC returns empty/errors (e.g. DB
// connection pressure or network latency). Cached separately from match
// results since the underlying medicine name list changes far less often.
const VOCAB_TTL_MS = 30 * 60 * 1000;

interface VocabItem {
    name: string;
    lower: string;
    primary: string;
    alt: string;
}

let vocabCache: { items: VocabItem[]; expiresAt: number } | null = null;

async function getVocabulary(): Promise<VocabItem[]> {
    if (vocabCache && Date.now() < vocabCache.expiresAt) {
        return vocabCache.items;
    }
    const { data, error } = await supabase.from("medicines").select("brand_name, generic_name");

    if (error || !data) {
        return vocabCache?.items ?? [];
    }

    const names = new Set<string>();
    for (const row of data as { brand_name: string | null; generic_name: string | null }[]) {
        if (row.brand_name) names.add(row.brand_name.trim());
        if (row.generic_name) names.add(row.generic_name.trim());
    }

    const items: VocabItem[] = [];
    for (const name of names) {
        const [primary, alt] = doubleMetaphone.process(name);
        items.push({
            name,
            lower: name.toLowerCase(),
            primary: primary || "",
            alt: alt || "",
        });
    }

    vocabCache = { items, expiresAt: Date.now() + VOCAB_TTL_MS };
    return vocabCache.items;
}

const LEVENSHTEIN_THRESHOLD = 2;

function phoneticFallback(targetName: string, vocabulary: VocabItem[]): LasaMatch[] {
    const targetLower = targetName.toLowerCase();
    const [targetPrimary, targetAlt] = doubleMetaphone.process(targetName);

    const matches: LasaMatch[] = [];

    for (const candidate of vocabulary) {
        if (candidate.lower === targetLower) continue;

        const distance = LevenshteinDistance(targetLower, candidate.lower);
        const soundsAlike =
            candidate.primary === targetPrimary ||
            candidate.primary === targetAlt ||
            candidate.alt === targetPrimary;

        if (soundsAlike) {
            matches.push({ name: candidate.name, type: "sound-alike", score: 1.0 });
        } else if (distance <= LEVENSHTEIN_THRESHOLD) {
            // Closer edit distance → higher score, capped at 0.85 to rank
            // below true phonetic matches, matching the primary RPC's scoring.
            const score = Math.max(0.5, 0.85 - distance * 0.15);
            matches.push({ name: candidate.name, type: "look-alike", score });
        }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 5);
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

            let result: LasaMatch[];

            if (error) {
                logger.warn("LASA RPC failed, using phonetic fallback", { error: error.message });
                const vocabulary = await getVocabulary();
                result = phoneticFallback(targetName, vocabulary);
            } else {
                result = (data || []).map((row: LasaConflictRow) => ({
                    name: row.name,
                    type: row.match_type,
                    score: row.match_type === "sound-alike" ? 1.0 : 0.85,
                }));

                if (result.length === 0) {
                    const vocabulary = await getVocabulary();
                    result = phoneticFallback(targetName, vocabulary);
                }
            }

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
