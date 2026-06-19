import type { MedicineSafetyProfile } from "@/components/medicine/MedicineSafetyData";
import { getStaticSafetyProfile } from "@/components/medicine/MedicineSafetyData";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

// ── In-memory cache ────────────────────────────────────────────────────────
// Keeps the last successful API response so the panel never flickers
// on re-search of the same medicine within the same session.
const profileCache = new Map<string, { profile: MedicineSafetyProfile; fetchedAt: number }>();

function getCached(key: string): MedicineSafetyProfile | null {
    const entry = profileCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
        profileCache.delete(key);
        return null;
    }
    return entry.profile;
}

function setCache(key: string, profile: MedicineSafetyProfile) {
    profileCache.set(key, { profile, fetchedAt: Date.now() });
}

// ── Main fetch function ────────────────────────────────────────────────────
/**
 * Fetches live safety data from the backend API.
 * Falls back to bundled static data if:
 *   - The device is offline
 *   - The API returns a non-OK response
 *   - The API times out (5 seconds)
 *   - The response shape is invalid
 *
 * Never throws — always returns a profile or null.
 */
export async function fetchSafetyProfile(
    query: string | undefined | null
): Promise<MedicineSafetyProfile | null> {
    if (!query?.trim()) return null;

    const cacheKey = query.toLowerCase().trim();

    // 1. Return from in-memory cache if still fresh
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // 2. Skip network entirely if browser reports offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
        console.info("[medicineSafetyService] Offline — using static fallback");
        return getStaticSafetyProfile(query);
    }

    // 3. Attempt API fetch with a 5-second timeout
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(
            `${API_BASE}/api/medicine/safety?q=${encodeURIComponent(query.trim())}`,
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!res.ok) {
            console.warn(
                `[medicineSafetyService] API returned ${res.status} — using static fallback`
            );
            return getStaticSafetyProfile(query);
        }

        const data: MedicineSafetyProfile = await res.json();

        // 4. Validate the shape minimally before trusting it
        if (!data?.activeIngredient || !Array.isArray(data?.sideEffects)) {
            console.warn(
                "[medicineSafetyService] Invalid API response shape — using static fallback"
            );
            return getStaticSafetyProfile(query);
        }

        // 5. Cache and return the live result
        setCache(cacheKey, data);
        return data;
    } catch (err) {
        // AbortError = timeout; TypeError = network failure
        const reason = err instanceof Error ? err.name : "Unknown";
        console.warn(`[medicineSafetyService] Fetch failed (${reason}) — using static fallback`);
        return getStaticSafetyProfile(query);
    }
}
