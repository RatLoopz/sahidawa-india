import type { MedicineSafetyProfile } from "@/components/medicine/MedicineSafetyData";
import { getStaticSafetyProfile } from "@/components/medicine/MedicineSafetyData";

// No base URL needed — Next.js proxy at /api/medicine/safety forwards to Render.
// Using a relative path keeps this working on both Vercel and local dev.
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

/**
 * Enriches an API profile with description/commonUses from the bundled static
 * dataset when those fields are missing (e.g. older Supabase cached profiles).
 * This guarantees the Overview & Usage tab always has content for known medicines.
 */
function enrichWithStaticData(
    apiProfile: MedicineSafetyProfile,
    query: string
): MedicineSafetyProfile {
    if (apiProfile.description && apiProfile.commonUses?.length) {
        return apiProfile; // Already complete — nothing to do
    }
    const staticProfile = getStaticSafetyProfile(query);
    if (!staticProfile) return apiProfile;

    return {
        ...apiProfile,
        description: apiProfile.description || staticProfile.description,
        commonUses: apiProfile.commonUses?.length
            ? apiProfile.commonUses
            : staticProfile.commonUses,
    };
}

// ── Main fetch function ────────────────────────────────────────────────────
/**
 * Fetches live safety data from the backend API.
 * Falls back to bundled static data if:
 *   - The device is offline
 *   - The API returns a non-OK response
 *   - The API times out (30 seconds)
 *   - The response shape is invalid
 *
 * When the API returns valid data but description/commonUses are missing,
 * they are transparently backfilled from the bundled static profiles.
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

    // 3. Attempt API fetch (30s timeout — first-ever request triggers LLM generation)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        const res = await fetch(`/api/medicine/safety?q=${encodeURIComponent(query.trim())}`, {
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 404) {
            try {
                const body = await res.clone().json();
                if (body && body.code === "NOT_A_MEDICINE") {
                    return { isMedicine: false } as any;
                }
            } catch {
                // fall through
            }
        }

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

        // 5. Backfill description/commonUses from static data if the LLM cache is stale
        const enriched = enrichWithStaticData(data, query);

        // 6. Cache and return the enriched result
        setCache(cacheKey, enriched);
        return enriched;
    } catch (err) {
        // AbortError = timeout; TypeError = network failure
        const reason = err instanceof Error ? err.name : "Unknown";
        console.warn(`[medicineSafetyService] Fetch failed (${reason}) — using static fallback`);
        return getStaticSafetyProfile(query);
    }
}
