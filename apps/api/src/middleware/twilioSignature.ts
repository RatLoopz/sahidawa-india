import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import logger from "../utils/logger";

/**
 * Twilio signs every webhook request with an X-Twilio-Signature header.
 * The signature is the base64-encoded HMAC-SHA1 of:
 *   - the full URL Twilio requested, followed by
 *   - each POST parameter, sorted alphabetically by key, as key+value with no separators,
 * keyed with the account's Auth Token.
 *
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function computeTwilioSignature(
    authToken: string,
    url: string,
    params: Record<string, unknown>
): string {
    const data = Object.keys(params)
        .sort()
        .reduce((acc, key) => acc + toFormUrlEncodedParam(key, params[key]), url);

    return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

/**
 * Serializes a single parameter the way Twilio does when building the signed
 * payload: scalars become `name + value`; repeated keys (array values) are
 * de-duplicated, sorted, and concatenated. Mirrors Twilio's own SDK so the
 * reconstructed signature matches byte-for-byte.
 */
function toFormUrlEncodedParam(name: string, value: unknown): string {
    if (Array.isArray(value)) {
        return Array.from(new Set(value))
            .sort()
            .reduce((acc, val) => acc + toFormUrlEncodedParam(name, val), "");
    }
    return name + String(value);
}

/**
 * Constant-time comparison of two base64 signatures. Returns false on any
 * length mismatch so an attacker cannot learn the expected length via timing.
 */
export function signaturesMatch(expected: string, provided: string): boolean {
    const expectedBuf = Buffer.from(expected, "utf-8");
    const providedBuf = Buffer.from(provided, "utf-8");

    if (expectedBuf.length !== providedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Builds the candidate public URL(s) Twilio may have used to reach this
 * endpoint, in priority order.
 *
 * Set TWILIO_WEBHOOK_PUBLIC_URL to the externally visible origin (e.g.
 * "https://api.sahidawa.in") to pin reconstruction exactly; when present it is
 * the only candidate. Otherwise the URL is derived from the request. The host
 * comes from the (proxy-preserved) Host header, but the scheme is unreliable
 * behind a proxy: nginx forwards X-Forwarded-Proto as its own $scheme, so if
 * TLS is terminated upstream the request reaches the app as http even though
 * Twilio signed the external https URL. We therefore try both https and http
 * variants. This leaks nothing — every candidate still has to match the HMAC
 * keyed with the secret auth token, which an attacker does not have.
 */
function buildCandidateUrls(req: Request): string[] {
    const publicBase = process.env.TWILIO_WEBHOOK_PUBLIC_URL?.trim();
    if (publicBase) {
        return [`${publicBase.replace(/\/+$/, "")}${req.originalUrl}`];
    }

    const host = req.get("host");
    const schemes = Array.from(new Set([req.protocol, "https", "http"]));
    return schemes.map((scheme) => `${scheme}://${host}${req.originalUrl}`);
}

/**
 * Express middleware that rejects any request to a Twilio webhook that does not
 * carry a valid X-Twilio-Signature. Must run after the body parser so the form
 * parameters are available for signature reconstruction.
 *
 * Fails closed: if TWILIO_AUTH_TOKEN is not configured the endpoint cannot
 * verify anything, so every request is rejected rather than silently trusted.
 */
export function verifyTwilioSignature(req: Request, res: Response, next: NextFunction): void {
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
        logger.error(
            "Rejecting Twilio webhook request: TWILIO_AUTH_TOKEN is not configured, signatures cannot be verified."
        );
        res.status(403).send("Forbidden");
        return;
    }

    const signature = req.get("X-Twilio-Signature");
    if (!signature) {
        logger.warn("Rejecting Twilio webhook request: missing X-Twilio-Signature header.");
        res.status(403).send("Forbidden");
        return;
    }

    const params = (req.body ?? {}) as Record<string, unknown>;
    const candidateUrls = buildCandidateUrls(req);
    const isValid = candidateUrls.some((url) =>
        signaturesMatch(computeTwilioSignature(authToken, url, params), signature)
    );

    if (!isValid) {
        logger.warn("Rejecting Twilio webhook request: invalid X-Twilio-Signature.", {
            candidateUrls,
        });
        res.status(403).send("Forbidden");
        return;
    }

    next();
}
