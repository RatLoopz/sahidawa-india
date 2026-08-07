/**
 * Rate Limit Tiers
 *
 * Defines request limits per tier. Each tier multiplies the base
 * anonymous limits so that authenticated and privileged users get
 * proportionally more headroom.
 */

export interface RateLimitTier {
    /** Display name for logging / admin UI */
    name: string;
    /** Multiplier applied to the base anonymous limits */
    multiplier: number;
    /** Optional: list of endpoint prefixes that get special treatment */
    exemptEndpoints?: string[];
}

export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
    anonymous: {
        name: "Anonymous",
        multiplier: 1,
    },
    authenticated: {
        name: "Authenticated",
        multiplier: 3,
    },
    pharmacy: {
        name: "Pharmacy",
        multiplier: 5,
    },
    admin: {
        name: "Admin",
        multiplier: 10,
        exemptEndpoints: ["/admin"],
    },
};

/**
 * Resolve the tier for a given request.
 *
 * The function inspects `req.user` (set by `requireAuth` / `requireRole`)
 * and returns the matching tier key. If no user is present, it returns
 * `"anonymous"`.
 */
export function resolveTier(user?: { role?: string; pharmacy_id?: string }): string {
    if (!user) return "anonymous";
    if (user.role === "admin") return "admin";
    if (user.pharmacy_id) return "pharmacy";
    return "authenticated";
}

/**
 * Return the multiplier for the given tier, defaulting to 1 if the tier
 * is unknown.
 */
export function getTierMultiplier(tier: string): number {
    return RATE_LIMIT_TIERS[tier]?.multiplier ?? 1;
}
