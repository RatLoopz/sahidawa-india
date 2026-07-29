const BLOCKED_HOSTNAME_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^\[?::1\]?$/,
    /^\[?fc00:/i,
    /^\[?fe80:/i,
];

function isAllowedHostname(hostname: string): boolean {
    return !BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function validateMlServiceUrl(rawUrl: string): { valid: boolean; reason?: string } {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { valid: false, reason: "ML_SERVICE_URL is not a valid URL" };
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return {
            valid: false,
            reason: `ML_SERVICE_URL uses disallowed scheme '${parsed.protocol}'. Only http: and https: are permitted.`,
        };
    }

    if (!isAllowedHostname(parsed.hostname)) {
        return {
            valid: false,
            reason: `ML_SERVICE_URL hostname '${parsed.hostname}' resolves to a private or loopback address and is not permitted.`,
        };
    }

    return { valid: true };
}

export function getMlServiceUrl(): string | null {
    const configuredUrl = process.env.ML_SERVICE_URL?.trim();
    if (!configuredUrl) return null;

    const trimmed = configuredUrl.replace(/\/+$/, "");
    const { valid } = validateMlServiceUrl(trimmed);

    return valid ? trimmed : null;
}

/**
 * Auth header for server-side calls to the ML service.
 *
 * Server-only. ML_API_KEY deliberately has no NEXT_PUBLIC_ prefix so it is
 * never bundled into the browser. Browser code reaches the ML socket with a
 * short-lived ticket from the API instead (see voice/lib/streaming.ts).
 */
export function getMlAuthHeaders(): Record<string, string> {
    const apiKey = process.env.ML_API_KEY?.trim();
    return apiKey ? { "x-api-key": apiKey } : {};
}
