import { supabase } from "../db/client";
import { redisClient } from "./redis";
import logger from "./logger";

// Redis cache key prefix for token revocations
const TOKEN_REVOCATION_CACHE_PREFIX = "token_revoked:";
const CACHE_TTL = 3600; // 1 hour

/**
 * Check if a token has been revoked (uses Redis cache + DB fallback)
 */
export async function isTokenRevoked(
    userId: string,
    tokenJti?: string,
    tokenExp?: number
): Promise<boolean> {
    try {
        const cacheKey = `${TOKEN_REVOCATION_CACHE_PREFIX}${userId}`;

        // Try Redis cache first (per-user revocation marker)
        if (redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached === "revoked") {
                return true;
            }
        }

        // Query database for revocation
        const { data: revocation, error } = await supabase
            .from("token_revocations")
            .select("id, expires_at")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();

        if (error && error.code !== "PGRST116") {
            logger.error("Error checking token revocation", { error, userId });
            return false;
        }

        const isRevoked = !!revocation;

        // Cache revocation status in Redis for 1 hour
        if (redisClient.isOpen && isRevoked) {
            await redisClient.setex(cacheKey, CACHE_TTL, "revoked");
        }

        return isRevoked;
    } catch (err) {
        logger.error("Error in isTokenRevoked", { error: err, userId });
        return false;
    }
}

/**
 * Revoke a specific token (by JTI claim)
 */
export async function revokeToken(
    userId: string,
    tokenJti: string,
    tokenExp: number,
    reason: string = "user_logout"
): Promise<boolean> {
    try {
        const expiresAt = new Date(tokenExp * 1000);

        const { error } = await supabase.from("token_revocations").insert([
            {
                user_id: userId,
                token_jti: tokenJti,
                reason,
                expires_at: expiresAt,
            },
        ]);

        if (error && error.code !== "23505") {
            // Ignore duplicate key errors
            logger.error("Error revoking token", { error, userId, tokenJti });
            return false;
        }

        // Clear Redis cache to force DB lookup
        if (redisClient.isOpen) {
            const cacheKey = `${TOKEN_REVOCATION_CACHE_PREFIX}${userId}`;
            await redisClient.del(cacheKey);
        }

        return true;
    } catch (err) {
        logger.error("Error in revokeToken", { error: err, userId, tokenJti });
        return false;
    }
}

/**
 * Revoke all tokens for a user (used for account deactivation, password reset, etc.)
 */
export async function revokeAllUserTokens(
    userId: string,
    reason: string = "account_deactivation"
): Promise<boolean> {
    try {
        // Call Supabase function to revoke all tokens
        const { data, error } = await supabase.rpc("revoke_user_tokens", {
            target_user_id: userId,
            revocation_reason: reason,
        });

        if (error) {
            logger.error("Error revoking all user tokens", { error, userId, reason });
            return false;
        }

        // Clear Redis cache
        if (redisClient.isOpen) {
            const cacheKey = `${TOKEN_REVOCATION_CACHE_PREFIX}${userId}`;
            await redisClient.del(cacheKey);
        }

        logger.info("Revoked all tokens for user", { userId, reason });
        return true;
    } catch (err) {
        logger.error("Error in revokeAllUserTokens", { error: err, userId });
        return false;
    }
}

/**
 * Clear revocation cache for a user (when they log in again)
 */
export async function clearRevocationCache(userId: string): Promise<void> {
    try {
        if (redisClient.isOpen) {
            const cacheKey = `${TOKEN_REVOCATION_CACHE_PREFIX}${userId}`;
            await redisClient.del(cacheKey);
        }
    } catch (err) {
        logger.error("Error clearing revocation cache", { error: err, userId });
    }
}
