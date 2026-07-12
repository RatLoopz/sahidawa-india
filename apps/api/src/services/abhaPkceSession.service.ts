import { redisClient } from "../utils/redis";

export interface AbhaPkceSession {
    codeVerifier: string;
    userId: string;
}

export const ABHA_PKCE_SESSION_TTL_SECONDS = 300;
const ABHA_PKCE_SESSION_KEY_PREFIX = "abha:pkce:";

function getSessionKey(state: string): string {
    return `${ABHA_PKCE_SESSION_KEY_PREFIX}${state}`;
}

function parseSession(value: string): AbhaPkceSession | null {
    try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed !== "object" || parsed === null) {
            return null;
        }

        const session = parsed as Record<string, unknown>;
        if (
            typeof session.codeVerifier !== "string" ||
            session.codeVerifier.trim().length === 0 ||
            typeof session.userId !== "string" ||
            session.userId.trim().length === 0
        ) {
            return null;
        }

        return {
            codeVerifier: session.codeVerifier,
            userId: session.userId,
        };
    } catch {
        return null;
    }
}

/** Stores a short-lived ABHA PKCE session in shared Redis storage. */
export async function storeAbhaPkceSession(state: string, session: AbhaPkceSession): Promise<void> {
    await redisClient.set(getSessionKey(state), JSON.stringify(session), {
        EX: ABHA_PKCE_SESSION_TTL_SECONDS,
    });
}

/** Atomically reads and removes an ABHA PKCE session to prevent callback replay. */
export async function consumeAbhaPkceSession(state: string): Promise<AbhaPkceSession | null> {
    const serializedSession = await redisClient.getDel(getSessionKey(state));
    return serializedSession === null ? null : parseSession(serializedSession);
}
