/**
 * Returns `true` when the process is running on Vercel.  Vercel sets
 * `VERCEL=1` automatically on every deployment; the header
 * `x-vercel-forwarded-for` is only trustworthy when this flag is present
 * because Vercel overwrites it at the edge — it cannot be forged by
 * end-users.  On a plain Node server the header is attacker-controlled.
 *
 * Mirrors the cloud-platform detection pattern in apps/api/src/utils/env.ts.
 */
function isVercel(): boolean {
    return process.env.VERCEL === "1";
}

/**
 * Returns `true` when the deployment explicitly opts into reading
 * client IPs from forwarded-for headers (X-Forwarded-For, X-Real-IP).
 *
 * Defaults to **false** so that forged headers never influence rate
 * limiting. Set `TRUST_PROXY_HEADERS=true` in production behind a
 * reverse proxy (Nginx, Cloudflare, etc.).
 *
 * Mirrors the ML service's `TRUST_PROXY_HEADERS` env-var pattern.
 * @see apps/ml/utils/rate_limiter.py
 */
function trustProxyHeaders(): boolean {
    return process.env.TRUST_PROXY_HEADERS?.trim().toLowerCase() === "true";
}

/**
 * How many trusted reverse-proxy hops sit between the internet and
 * this application.  Used to pick the correct entry from a multi-hop
 * `X-Forwarded-For` chain — reading from `[-hops]` (right side)
 * rather than from the left, which is attacker-controlled.
 *
 * Defaults to 1 (single load balancer / Nginx).  Values < 1 are
 * clamped to 1 so that proxy trust is never silently disabled.
 *
 * Mirrors the ML service's `TRUSTED_PROXY_HOPS` env-var pattern.
 * @see apps/ml/utils/rate_limiter.py
 */
function trustedProxyHops(): number {
    const raw = process.env.TRUSTED_PROXY_HOPS?.trim() ?? "1";
    const hops = parseInt(raw, 10);
    if (Number.isNaN(hops)) {
        return 1;
    }
    return Math.max(hops, 1);
}

/**
 * Quick validation that `value` looks like an IPv4 or IPv6 address.
 * Rejects obviously spoofed or malformed values that should never
 * be used as a rate-limit key.
 */
function isValidIp(value: string): boolean {
    // IPv4: four dot-decimal octets 0-255
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
        return value.split(".").every((octet) => {
            const num = parseInt(octet, 10);
            return num >= 0 && num <= 255;
        });
    }
    // IPv6: contains at least one colon (sufficient for a safety check)
    if (value.includes(":")) {
        return true;
    }
    return false;
}

/**
 * Extract the client IP for rate-limiting.
 *
 * The function follows a safe-by-default strategy:
 *
 * 1. **Vercel** — `x-vercel-forwarded-for` is only trusted when the
 *    `VERCEL` env-var is set (Vercel sets it automatically).  On a
 *    plain Node server this header is attacker-controlled and is
 *    therefore skipped.
 *
 * 2. **Self-hosted / Docker behind Nginx** — Forwarding headers
 *    (`X-Forwarded-For`, `X-Real-IP`) are only consulted when the
 *    operator explicitly sets `TRUST_PROXY_HEADERS=true`.  The IP
 *    is then read from position `[-hops]` (the *right* side of the
 *    chain), matching the ML service's secure pattern.
 *
 * 3. **Local development / no proxy** — The function returns
 *    `"127.0.0.1"` because no forwarding header can be trusted.
 *
 * This prevents the rate-limit bypass described in Issue #4110:
 * an attacker who forges `X-Forwarded-For: 203.0.113.N` on each
 * request can no longer obtain a fresh rate-limit bucket.
 */
export function getClientIp(req: Request): string {
    // ── 1. Vercel edge — only when VERCEL env-var is set ─────────
    if (isVercel()) {
        const vercelForwardedFor = req.headers.get("x-vercel-forwarded-for");
        if (vercelForwardedFor) {
            const ips = vercelForwardedFor
                .split(",")
                .map((ip) => ip.trim())
                .filter(Boolean);
            if (ips.length > 0 && isValidIp(ips[0]!)) {
                return ips[0]!;
            }
        }
    }

    // ── 2. Non-Vercel — only trust headers when opted-in ────────
    if (!trustProxyHeaders()) {
        return "127.0.0.1";
    }

    const hops = trustedProxyHops();

    // Read from the RIGHT side of X-Forwarded-For (the position
    // our trusted proxies wrote), not from the left (attacker-
    // controlled).  This is the same strategy the ML service uses.
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const ips = forwardedFor
            .split(",")
            .map((ip) => ip.trim())
            .filter(Boolean);
        if (ips.length >= hops) {
            const candidate = ips[ips.length - hops]!;
            if (isValidIp(candidate)) {
                return candidate;
            }
        }
    }

    // X-Real-IP is only safe when explicitly trusted (see above).
    const realIp = req.headers.get("x-real-ip");
    if (realIp && isValidIp(realIp.trim())) {
        return realIp.trim();
    }

    return "127.0.0.1";
}
