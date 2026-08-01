/**
 * Centralized Rate Limit Configuration
 *
 * All rate-limit knobs live here so they can be adjusted at runtime
 * via the PATCH /admin/rate-limits endpoint without redeploying.
 */

export interface EndpointLimit {
    /** Sliding window duration in milliseconds */
    windowMs: number;
    /** Maximum requests allowed within the window for the anonymous tier */
    maxRequests: number;
    /** Human-readable label for logging / admin UI */
    label: string;
    /** Redis key prefix (keeps counters isolated per endpoint) */
    prefix: string;
}

/**
 * Default limits — overridable at runtime via in-memory store.
 * Anonymous tier values; multiplied by the resolved user-tier multiplier.
 */
const defaults: Record<string, EndpointLimit> = {
    verify: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 20,
        label: "Medicine Verification",
        prefix: "verify",
    },
    batch: { windowMs: 60 * 60 * 1000, maxRequests: 100, label: "Batch Lookup", prefix: "batch" },
    general: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        label: "General API",
        prefix: "general",
    },
    report: {
        windowMs: 10 * 60 * 1000,
        maxRequests: 3,
        label: "Report Submission",
        prefix: "report",
    },
    lasa: { windowMs: 15 * 60 * 1000, maxRequests: 30, label: "LASA Drug Check", prefix: "lasa" },
    scan: { windowMs: 15 * 60 * 1000, maxRequests: 30, label: "Scan Query", prefix: "scan" },
    compare: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 30,
        label: "Medicine Comparison",
        prefix: "compare",
    },
    interactions: {
        windowMs: 60 * 1000,
        maxRequests: 10,
        label: "Interaction Check",
        prefix: "interactions",
    },
    interactions_ids: {
        windowMs: 60 * 1000,
        maxRequests: 5,
        label: "Interaction IDs Lookup",
        prefix: "interactions_ids",
    },
    eligibility: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 20,
        label: "Eligibility Check",
        prefix: "eligibility",
    },
    triage: { windowMs: 60 * 1000, maxRequests: 15, label: "Triage", prefix: "triage" },
    analytics: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 10,
        label: "Analytics",
        prefix: "analytics",
    },
    auth: { windowMs: 60 * 1000, maxRequests: 5, label: "Authentication", prefix: "auth" },
    auth_target: {
        windowMs: 10 * 60 * 1000,
        maxRequests: 5,
        label: "Auth Target",
        prefix: "auth_target",
    },
    notification_register: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        label: "Notification Registration",
        prefix: "notification_register",
    },
    tracking: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 60,
        label: "Medicine Tracking",
        prefix: "tracking",
    },
    webhook: { windowMs: 60 * 1000, maxRequests: 10, label: "Webhook", prefix: "webhook" },
    barcode: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 15,
        label: "Barcode Lookup",
        prefix: "barcode",
    },
    schedules: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 60,
        label: "Medicine Schedules",
        prefix: "schedules",
    },
    alerts_read: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 60,
        label: "Alerts Read",
        prefix: "alerts_read",
    },
    api_keys: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 30,
        label: "API Key Management",
        prefix: "api_keys",
    },
    admin: { windowMs: 15 * 60 * 1000, maxRequests: 200, label: "Admin API", prefix: "admin" },
};

// ── Mutable runtime store ─────────────────────────────────────────────────────
// Allows PATCH /admin/rate-limits to adjust limits without redeploying.
const runtimeLimits: Map<string, EndpointLimit> = new Map(Object.entries(defaults));

/** Return current limit config for an endpoint. */
export function getEndpointLimit(endpoint: string): EndpointLimit | undefined {
    return runtimeLimits.get(endpoint);
}

/** Return all current limits (for admin read). */
export function getAllLimits(): Record<string, EndpointLimit> {
    return Object.fromEntries(runtimeLimits);
}

/**
 * Patch one or more endpoint limits at runtime.
 * Returns the updated config for the patched endpoints.
 */
export function patchLimits(
    patches: Record<string, { windowMs?: number; maxRequests?: number }>
): Record<string, EndpointLimit> {
    const updated: Record<string, EndpointLimit> = {};
    for (const [endpoint, patch] of Object.entries(patches)) {
        const existing = runtimeLimits.get(endpoint);
        if (!existing || !patch) continue;
        if (patch.windowMs !== undefined) existing.windowMs = patch.windowMs;
        if (patch.maxRequests !== undefined) existing.maxRequests = patch.maxRequests;
        runtimeLimits.set(endpoint, existing);
        updated[endpoint] = { ...existing };
    }
    return updated;
}

/** Reset all limits to their defaults. */
export function resetLimits(): void {
    runtimeLimits.clear();
    for (const [k, v] of Object.entries(defaults)) {
        runtimeLimits.set(k, { ...v });
    }
}

// ── Global aggregate threshold ────────────────────────────────────────────────
// Per-IP total requests across ALL endpoints within a 1-minute sliding window.
export const GLOBAL_AGGREGATE = {
    windowMs: 60 * 1000,
    maxRequests: 300, // sum of all single-endpoint maxRequests is ~550; 300 is a reasonable global cap
    prefix: "agg_global",
};

// ── Progressive penalty thresholds ────────────────────────────────────────────
export const PENALTY_THRESHOLDS = [
    { violations: 5, blockMinutes: 5 },
    { violations: 10, blockMinutes: 60 },
    { violations: 20, blockMinutes: 360 }, // 6 hours
] as const;
