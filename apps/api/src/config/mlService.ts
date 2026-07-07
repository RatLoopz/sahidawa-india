import logger from "../utils/logger";

const MISSING_ML_SERVICE_URL_MESSAGE =
    "ML_SERVICE_URL is not configured. Set it to the ML service origin before using ML-backed routes.";

// RFC-1918 private address ranges, loopback, and link-local prefixes that must
// never be used as ML service endpoints. A misconfigured or injected value
// pointing at these addresses would allow the API server to reach cloud instance
// metadata services or internal network resources (SSRF).
const BLOCKED_HOSTNAME_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
];

/**
 * Returns true when the hostname is a safe external address, false for any
 * private, loopback, or link-local hostname.
 */
function isAllowedHostname(hostname: string): boolean {
    if (process.env.NODE_ENV !== "production" && /^localhost$/i.test(hostname)) {
        return true;
    }
    return !BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Validates that the supplied URL string is a well-formed absolute URL and that
 * its hostname is not an internal network address. Returns a validation result
 * so callers can surface a descriptive error rather than silently failing.
 */
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
    const { valid, reason } = validateMlServiceUrl(trimmed);

    if (!valid) {
        logger.error(`Invalid ML_SERVICE_URL: ${reason}`, {
            url: trimmed,
            environment: process.env.NODE_ENV || "development",
        });
        return null;
    }

    return trimmed;
}

export function validateMlServiceConfig(): void {
    if (getMlServiceUrl()) return;

    const metadata = {
        missingVars: { ML_SERVICE_URL: true },
        environment: process.env.NODE_ENV || "development",
    };

    if (process.env.NODE_ENV === "production") {
        logger.error(`CRITICAL ERROR: ${MISSING_ML_SERVICE_URL_MESSAGE}`, metadata);
        process.exit(1);
    }

    logger.warn(MISSING_ML_SERVICE_URL_MESSAGE, metadata);
}

export { MISSING_ML_SERVICE_URL_MESSAGE };
