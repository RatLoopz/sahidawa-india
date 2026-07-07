import { Router, Response } from "express";
import crypto, { pbkdf2 } from "crypto";
import { promisify } from "util";
import { requireApiKey, ApiKeyRequest } from "../middleware/apiKeyAuth";
import { supabase } from "../db/client";
import logger from "../utils/logger";

const router = Router();
const pbkdf2Async = promisify(pbkdf2);

/**
 * @swagger
 * /api/keys/rotate:
 *   post:
 *     summary: Rotate API key
 *     description: Rotates the current API key by generating a new secret, updating the hash in the database, and returning the new secret. The existing key ID remains the same. Requires the current API key to be passed in the `x-api-secret` header.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully rotated API key
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/rotate", requireApiKey, async (req: ApiKeyRequest, res: Response) => {
    try {
        const keyId = req.apiKey?.keyId;
        if (!keyId) {
            res.status(401).json({ error: "Unauthorized" });
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

        // Update the key in the database
        const { error } = await supabase
            .from("api_keys")
            .update({
                key_hash: newHash,
                key_salt: newSalt,
                expires_at: expiresAt.toISOString(),
            })
            .eq("id", keyId);

        if (error) {
            logger.error("Failed to update API key during rotation", { error, keyId });
            res.status(500).json({ error: "Internal server error" });
            return;
        }

        logger.info("API key rotated successfully", { keyId });

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
});

export default router;
