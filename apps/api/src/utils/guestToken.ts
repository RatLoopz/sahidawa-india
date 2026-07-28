import jwt, { JwtPayload } from "jsonwebtoken";

/**
 * Short-lived proof-of-phone-ownership token for the guest notification flow.
 *
 * A guest has no account, so the API used to trust a bare `phone` query
 * parameter to decide which subscriber's data to read, update or delete. That
 * let anyone act on anyone else's subscription just by knowing their number.
 * Instead, once a guest proves control of the number by verifying the OTP we
 * mint one of these tokens, and the guest read/write endpoints only trust the
 * phone number carried inside a valid token — never a raw request parameter.
 *
 * The token is a standard JWT signed with `process.env.JWT_SECRET` so it is
 * stateless (no server-side session table) and self-expiring.
 */

const GUEST_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const GUEST_TOKEN_SCOPE = "guest-notification";

function getSecret(): string | null {
    return process.env.JWT_SECRET?.trim() || null;
}

/** True when the server is configured to issue and verify guest tokens. */
export function isGuestTokenConfigured(): boolean {
    return getSecret() !== null;
}

/**
 * Sign a token that proves the holder verified ownership of `phone`.
 * Throws if JWT_SECRET is unset — callers must gate on isGuestTokenConfigured().
 */
export function signGuestToken(phone: string): string {
    const secret = getSecret();
    if (!secret) {
        throw new Error("Cannot sign a guest token: JWT_SECRET is not configured.");
    }
    return jwt.sign({ scope: GUEST_TOKEN_SCOPE, phone }, secret, {
        expiresIn: GUEST_TOKEN_TTL_SECONDS,
    });
}

/**
 * Return the phone number a token proves ownership of, or null when the token
 * is missing, malformed, expired, tampered with, wrong-scoped, or when the
 * server has no JWT_SECRET. Never throws, so route handlers can treat a null
 * result as "no verified guest identity" and answer with 401.
 */
export function verifyGuestPhone(token: string | null | undefined): string | null {
    const secret = getSecret();
    if (!secret || !token) {
        return null;
    }

    try {
        // Pin the algorithm to HS256. The secret is symmetric, so jsonwebtoken
        // already restricts verification to HMAC and rejects `alg: none`; naming
        // the algorithm makes that invariant explicit and future-proof rather
        // than relying on the key type staying a string.
        const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
        if (
            typeof decoded === "object" &&
            decoded !== null &&
            (decoded as JwtPayload).scope === GUEST_TOKEN_SCOPE &&
            typeof (decoded as JwtPayload).phone === "string"
        ) {
            return (decoded as JwtPayload).phone as string;
        }
    } catch {
        // Invalid, expired or tampered token — fall through to null.
    }

    return null;
}
