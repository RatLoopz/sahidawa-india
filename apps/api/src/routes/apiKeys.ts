import { Router, Response } from "express";
import crypto, { pbkdf2 } from "crypto";
import { promisify } from "util";
import { requireApiKey, ApiKeyRequest } from "../middleware/apiKeyAuth";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { apiKeyLimiter } from "../middleware/rateLimit";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { redisClient } from "../utils/redis";
import { sendNotificationToUser } from "../services/notifications";
import { smsService } from "../services/sms-service";
import { subscriberRepository } from "../repositories/subscriber.repository";

const router = Router();
const pbkdf2Async = promisify(pbkdf2);

// ML workers subscribe to this Redis Pub/Sub channel and force-close a user's
// active WebSocket streams when they receive their user_id here. Must match
// API_KEY_REVOKED_CHANNEL in apps/ml/utils/ws_registry.py.
const API_KEY_REVOKED_CHANNEL = "api_key_revoked_channel";

// The `id` column is a Postgres uuid, which rejects a non-uuid value with a
// syntax error (22P02) that would otherwise surface as a 500. Validating the
// shape here keeps malformed input on the 404 path instead — the same response
// an unknown id gets — so user input never reaches the 500 branch.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Best-effort alert so the key owner can detect an unauthorized rotation.
 * Delivery failures are logged but must never fail the rotation itself — the
 * security fix that matters is the session requirement on the endpoint.
 */
async function notifyApiKeyRotation(userId: string, keyId: string): Promise<void> {
    try {
        const message =
            "Your SahiDawa API key was rotated. If you did not do this, sign in and revoke the key immediately.";

        await sendNotificationToUser(userId, {
            title: "API key rotated",
            body: message,
            url: "/settings",
        });

        const subscriber = await subscriberRepository.findByUserId(userId);
        if (subscriber?.phone && subscriber?.channels?.includes("sms")) {
            await smsService.send(
                subscriber.phone,
                `SahiDawa alert: ${message}`,
                subscriber.language || "en"
            );
        }
    } catch (error) {
        logger.error("Failed to notify user of API key rotation", { error, userId, keyId });
    }
}

/**
 * @swagger
 * /api/keys/rotate:
 *   post:
 *     summary: Rotate API key
 *     description: Rotates the current API key by generating a new secret, updating the hash in the database, and returning the new secret. The existing key ID remains the same. Requires both the current API key in the `x-api-secret` header and a valid user session, so only the key's legitimate owner can rotate it — possession of the secret alone is not enough. The owner is notified (web push/SMS) of the rotation.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully rotated API key
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: The authenticated user does not own the presented API key
 *       500:
 *         description: Internal server error
 */
router.post(
    "/rotate",
    apiKeyLimiter,
    requireAuth,
    requireApiKey,
    async (req: ApiKeyRequest & AuthenticatedRequest, res: Response) => {
        try {
            const keyId = req.apiKey?.keyId;
            const keyOwnerId = req.apiKey?.userId;
            const sessionUserId = req.user?.id;

            if (!keyId || !keyOwnerId || !sessionUserId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            // A valid API key proves only that the caller possesses the secret.
            // Authenticating rotation with the key alone would let an attacker
            // who stole the key rotate it into a secret only they know. The
            // session must belong to the key's owner, mirroring the revoke
            // endpoint's security model.
            if (keyOwnerId !== sessionUserId) {
                res.status(403).json({ error: "You do not own this API key" });
                return;
            }

            // Generate a new secret and salt
            const newSecret = crypto.randomBytes(32).toString("base64url");
            const newSalt = crypto.randomBytes(16).toString("hex");

            // Hash the new secret
            const hashBuffer = await pbkdf2Async(newSecret, newSalt, 100000, 64, "sha512");
            const newHash = hashBuffer.toString("hex");

            // Calculate new expiry (30 days from now)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            // Update the key in the database. The update is additionally scoped
            // to the session owner so a stale or buggy key row can never be
            // rotated across users.
            const { error } = await supabase
                .from("api_keys")
                .update({
                    key_hash: newHash,
                    key_salt: newSalt,
                    expires_at: expiresAt.toISOString(),
                })
                .eq("id", keyId)
                .eq("user_id", sessionUserId);

            if (error) {
                logger.error("Failed to update API key during rotation", { error, keyId });
                res.status(500).json({ error: "Internal server error" });
                return;
            }

            logger.info("API key rotated successfully", { keyId, userId: sessionUserId });

            await notifyApiKeyRotation(sessionUserId, keyId);

            res.status(200).json({
                message: "API key rotated successfully",
                keyId: keyId,
                newSecret: newSecret,
                expiresAt: expiresAt.toISOString(),
            });
        } catch (error) {
            logger.error("Unexpected error during API key rotation", { error });
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

/**
 * @swagger
 * /api/keys:
 *   get:
 *     summary: List the authenticated user's API keys
 *     description: Returns the caller's API keys with metadata only (never the secret or hash). Authenticated by the user's session, so a leaked key cannot be used to enumerate or manage its owner's keys.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: The caller's API keys
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", apiKeyLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    try {
        const { data, error } = await supabase
            .from("api_keys")
            .select("id, scopes, is_active, created_at, expires_at, last_used_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            logger.error("Failed to list API keys", { error, userId });
            res.status(500).json({ error: "Internal server error" });
            return;
        }

        res.status(200).json({ keys: data ?? [] });
    } catch (error) {
        logger.error("Unexpected error listing API keys", { error });
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/keys/{id}/revoke:
 *   post:
 *     summary: Revoke an API key
 *     description: Marks one of the caller's keys inactive so it can no longer authenticate. Authenticated by the user's session rather than the key itself, so the legitimate owner can disable a leaked key even though an attacker holds the secret. Idempotent.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Key revoked
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Key not found
 *       500:
 *         description: Internal server error
 */
router.post(
    "/:id/revoke",
    apiKeyLimiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { id } = req.params;
        if (typeof id !== "string" || !UUID_RE.test(id)) {
            res.status(404).json({ error: "API key not found" });
            return;
        }

        try {
            // Scope to the caller's own rows. The service-role client bypasses RLS,
            // so ownership must be enforced here with the user_id filter.
            const { data, error } = await supabase
                .from("api_keys")
                .update({ is_active: false })
                .eq("id", id)
                .eq("user_id", userId)
                .select("id")
                .maybeSingle();

            if (error) {
                logger.error("Failed to revoke API key", { error, keyId: id, userId });
                res.status(500).json({ error: "Internal server error" });
                return;
            }

            if (!data) {
                // Unknown id or a key owned by someone else — the two are not
                // distinguished so key ownership is not leaked.
                res.status(404).json({ error: "API key not found" });
                return;
            }

            logger.info("API key revoked", { keyId: id, userId });

            // Best-effort: tell the ML workers to force-close this user's active
            // WebSocket streams. A Redis hiccup must not fail the revoke itself —
            // re-connection is still blocked by the handshake either way.
            if (redisClient.isOpen) {
                try {
                    await redisClient.publish(
                        API_KEY_REVOKED_CHANNEL,
                        JSON.stringify({ user_id: userId })
                    );
                } catch (pubErr) {
                    logger.error("Failed to publish API key revocation signal", {
                        error: pubErr,
                        keyId: id,
                        userId,
                    });
                }
            }

            res.status(200).json({ message: "API key revoked", keyId: id });
        } catch (error) {
            logger.error("Unexpected error revoking API key", { error });
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

/**
 * @swagger
 * /api/keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     description: Permanently removes one of the caller's keys. Authenticated by the user's session. Prefer revoke when an audit trail of the key is worth keeping.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Key deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Key not found
 *       500:
 *         description: Internal server error
 */
router.delete(
    "/:id",
    apiKeyLimiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { id } = req.params;
        if (typeof id !== "string" || !UUID_RE.test(id)) {
            res.status(404).json({ error: "API key not found" });
            return;
        }

        try {
            const { data, error } = await supabase
                .from("api_keys")
                .delete()
                .eq("id", id)
                .eq("user_id", userId)
                .select("id")
                .maybeSingle();

            if (error) {
                logger.error("Failed to delete API key", { error, keyId: id, userId });
                res.status(500).json({ error: "Internal server error" });
                return;
            }

            if (!data) {
                res.status(404).json({ error: "API key not found" });
                return;
            }

            logger.info("API key deleted", { keyId: id, userId });
            res.status(200).json({ message: "API key deleted", keyId: id });
        } catch (error) {
            logger.error("Unexpected error deleting API key", { error });
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

export default router;
