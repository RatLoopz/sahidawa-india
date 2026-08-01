import logger from "../utils/logger";
import { isBlockedOutboundHost } from "../utils/security/urlValidator";

const MISSING_ML_SERVICE_URL_MESSAGE =
    "ML_SERVICE_URL is not configured. Set it to the ML service origin before using ML-backed routes.";

/**
 * Extract the embedded IPv4 address from an IPv6-mapped IPv4 address.
 *
 * Example:
 *   ::ffff:127.0.0.1   -> 127.0.0.1
 *   ::FFFF:10.0.0.5    -> 10.0.0.5
 */
function getMappedIpv4(hostname: string): string | null {
    const match = hostname.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    return match ? match[1] : null;
}

/**
 * Returns true when the hostname is a safe external address, false for any
 * private, loopback, or link-local hostname.
 *
 * IPv6 literals arrive from `URL.hostname` with their brackets intact (e.g.
 * "[fd00::1]"), so they are stripped before matching against the shared
 * blocked-pattern list used by `validateOutboundUrl`.
 */
function isAllowedHostname(hostname: string): boolean {
    const strippedHostname = hostname.replace(/^\[|\]$/g, "");
    const mappedIpv4 = getMappedIpv4(strippedHostname);
    const normalizedHostname = mappedIpv4 ?? strippedHostname;

    if (
        process.env.NODE_ENV !== "production" &&
        /^(localhost|127\.0\.0\.1)$/i.test(normalizedHostname)
    ) {
        return true;
    }

    return !isBlockedOutboundHost(normalizedHostname);
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

/**
 * Auth header for outbound calls to the ML service. The ML service requires
 * x-api-key on every route except "/" and "/health", so any request made
 * without this will come back 401.
 */
export function getMlAuthHeaders(): Record<string, string> {
    const apiKey = process.env.ML_API_KEY?.trim();
    if (!apiKey) {
        logger.warn("ML_API_KEY is not set; ML service calls will be rejected.");
        return {};
    }

    return { "x-api-key": apiKey };
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
